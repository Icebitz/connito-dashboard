import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { NextResponse } from "next/server";

const CYCLE_SOURCES = {
  phase: "https://cycle-api.connito.ai/get_phase",
  blocksUntilNextPhase: "https://cycle-api.connito.ai/blocks_until_next_phase",
  previousPhaseBlocks: "https://cycle-api.connito.ai/previous_phase_blocks",
  validatorWhitelist: "https://cycle-api.connito.ai/get_validator_whitelist"
} as const;
const UPSTREAM_TIMEOUT_MS = 10_000;
const CACHE_FILE = join(process.cwd(), ".next", "cache", "connito-cycle.json");

type CycleCache = {
  fetchedAt: string;
  data: Record<keyof typeof CYCLE_SOURCES, unknown>;
};

let cachedCycle: CycleCache | null = null;

export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store"
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json"
    },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.json();
}

async function readCache() {
  if (cachedCycle) {
    return cachedCycle;
  }

  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as CycleCache;
    if (parsed && typeof parsed.fetchedAt === "string" && parsed.data) {
      cachedCycle = parsed;
    }
  } catch {
    // Cache is optional.
  }

  return cachedCycle;
}

async function writeCache(entry: CycleCache) {
  cachedCycle = entry;

  try {
    await mkdir(dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(entry), "utf8");
  } catch {
    // In-memory cache still protects the current process.
  }
}

function emptyCycle(error: string) {
  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      ok: true,
      source: CYCLE_SOURCES,
      data: {
        phase: null,
        blocksUntilNextPhase: {},
        previousPhaseBlocks: {},
        validatorWhitelist: []
      },
      empty: true,
      stale: true,
      warning: `Waiting for cycle APIs: ${error}`
    },
    {
      headers: noStoreHeaders()
    }
  );
}

async function fallback(error: string) {
  const cached = await readCache();
  if (!cached) {
    return emptyCycle(error);
  }

  return NextResponse.json(
    {
      fetchedAt: cached.fetchedAt,
      ok: true,
      source: CYCLE_SOURCES,
      data: cached.data,
      stale: true,
      warning: `Using cached cycle data because one or more cycle APIs failed: ${error}`
    },
    {
      headers: noStoreHeaders()
    }
  );
}

export async function GET() {
  const fetchedAt = new Date().toISOString();

  try {
    const entries = await Promise.all(
      Object.entries(CYCLE_SOURCES).map(async ([key, url]) => [key, await fetchJson(url)] as const)
    );
    const data = Object.fromEntries(entries) as CycleCache["data"];

    await writeCache({ fetchedAt, data });

    return NextResponse.json(
      {
        fetchedAt,
        ok: true,
        source: CYCLE_SOURCES,
        data
      },
      {
        headers: noStoreHeaders()
      }
    );
  } catch (error) {
    return fallback(error instanceof Error ? error.message : "Unknown cycle API error.");
  }
}
