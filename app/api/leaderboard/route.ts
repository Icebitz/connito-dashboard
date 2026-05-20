import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { NextResponse } from "next/server";

const SOURCE_URL = "https://dashboard-api.connito.ai/api/v1/leaderboard";
const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 2;
const CACHE_FILE = join(process.cwd(), ".next", "cache", "connito-leaderboard.json");

type CachedLeaderboard = {
  fetchedAt: string;
  data: unknown;
};

let cachedLeaderboard: CachedLeaderboard | null = null;

export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store"
  };
}

async function readCache() {
  if (cachedLeaderboard) {
    return cachedLeaderboard;
  }

  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as CachedLeaderboard;
    if (parsed && typeof parsed.fetchedAt === "string" && "data" in parsed) {
      cachedLeaderboard = parsed;
    }
  } catch {
    // Cache is best-effort. Cold starts can legitimately have no cache yet.
  }

  return cachedLeaderboard;
}

async function writeCache(entry: CachedLeaderboard) {
  cachedLeaderboard = entry;

  try {
    await mkdir(dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(entry), "utf8");
  } catch {
    // The in-memory cache is enough for the current process if disk writes fail.
  }
}

async function parseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "application/json";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function emptyLeaderboard(error: string, status?: number) {
  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      ok: true,
      source: SOURCE_URL,
      data: {
        data: {
          leaderboard: [],
          subnet: {
            netuid: 102,
            total_miners: 0,
            validator_count: 0
          },
          phase: {
            name: "Waiting",
            blocks_remaining: null
          },
          round: {
            baseline_loss: null,
            stats: {
              roster: 0,
              scored: 0,
              pending: 0,
              failed: 0
            }
          }
        }
      },
      empty: true,
      stale: true,
      status,
      warning: `Waiting for the source API: ${error}`
    },
    {
      headers: noStoreHeaders()
    }
  );
}

async function fallbackResponse(error: string, status?: number) {
  const cached = await readCache();
  if (!cached) {
    return emptyLeaderboard(error, status);
  }

  return NextResponse.json(
    {
      fetchedAt: cached.fetchedAt,
      ok: true,
      source: SOURCE_URL,
      data: cached.data,
      stale: true,
      status,
      warning: `Using cached leaderboard because the source API is slow or unavailable: ${error}`
    },
    {
      headers: noStoreHeaders()
    }
  );
}

export async function GET() {
  let lastError = "Unknown leaderboard fetch error.";
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const fetchedAt = new Date().toISOString();

    try {
      const response = await fetch(SOURCE_URL, {
        cache: "no-store",
        headers: {
          accept: "application/json"
        },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      });

      const body = await parseBody(response);

      if (!response.ok) {
        lastStatus = response.status;
        lastError = `Leaderboard API returned HTTP ${response.status}.`;
        break;
      }

      await writeCache({
        fetchedAt,
        data: body
      });

      return NextResponse.json(
        {
          fetchedAt,
          ok: true,
          source: SOURCE_URL,
          data: body
        },
        {
          headers: noStoreHeaders()
        }
      );
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown leaderboard fetch error.";
      lastStatus = 504;
    }
  }

  return fallbackResponse(lastError, lastStatus);
}
