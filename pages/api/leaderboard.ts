import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";

import { LEADERBOARD_SOURCE } from "../../src/dashboard/constants";

const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 2;
const HISTORY_DIR = join(process.cwd(), ".next", "cache");
const HISTORY_ROUND_LIMIT = 8;

type SourceConfig = {
  version: "v2";
  sourceUrl: string;
  cacheFile: string;
  currentHistoryFile: string;
};

type CachedLeaderboard = {
  fetchedAt: string;
  data: unknown;
};

type LeaderboardHistorySnapshot = {
  fetchedAt: string;
  roundId: number;
  phaseStartedAtBlock: number | null;
  data: unknown;
};

const cachedLeaderboards = new Map<"v2", CachedLeaderboard>();

type ApiResult = {
  body: unknown;
  headers?: Record<string, string>;
  status: number;
};

const NextResponse = {
  json(body: unknown, init?: { headers?: Record<string, string>; status?: number }): ApiResult {
    return { body, headers: init?.headers, status: init?.status ?? 200 };
  }
};

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store"
  };
}

function getSourceConfig(): SourceConfig {
  const version = "v2";

  return {
    version,
    sourceUrl: LEADERBOARD_SOURCE,
    cacheFile: join(process.cwd(), ".next", "cache", `connito-leaderboard-${version}.json`),
    currentHistoryFile: join(HISTORY_DIR, `leaderboard-${version}.json`)
  };
}

async function readCache(config: SourceConfig) {
  const memoryCache = cachedLeaderboards.get(config.version);
  if (memoryCache) {
    return memoryCache;
  }

  try {
    const raw = await readFile(config.cacheFile, "utf8");
    const parsed = JSON.parse(raw) as CachedLeaderboard;
    if (parsed && typeof parsed.fetchedAt === "string" && "data" in parsed) {
      cachedLeaderboards.set(config.version, parsed);
    }
  } catch {
    // Cache is best-effort. Cold starts can legitimately have no cache yet.
  }

  return cachedLeaderboards.get(config.version) ?? null;
}

async function writeCache(config: SourceConfig, entry: CachedLeaderboard) {
  cachedLeaderboards.set(config.version, entry);

  try {
    await mkdir(dirname(config.cacheFile), { recursive: true });
    await writeFile(config.cacheFile, JSON.stringify(entry), "utf8");
  } catch {
    // The in-memory cache is enough for the current process if disk writes fail.
  }
}

async function parseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "application/json";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asText(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function unwrapDashboardData(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) {
    return payload.data;
  }

  return isRecord(payload) ? payload : {};
}

function isDistributePhase(payload: unknown) {
  const data = unwrapDashboardData(payload);
  const phase = isRecord(data.phase) ? data.phase : null;
  const phaseName = asText(phase?.name) ?? asText(phase?.phase_name);

  return phaseName?.trim().toLowerCase().includes("distribute") ?? false;
}

function getPhaseStartedAtBlock(payload: unknown) {
  const data = unwrapDashboardData(payload);
  const phase = isRecord(data.phase) ? data.phase : null;

  return asNumber(phase?.started_at_block)
    ?? asNumber(phase?.phase_start_block)
    ?? asNumber(phase?.start_block);
}

function getRoundId(payload: unknown) {
  const data = unwrapDashboardData(payload);
  const round = isRecord(data.round) ? data.round : null;

  return asNumber(round?.id) ?? asNumber(round?.round_id);
}

function getHistoryFile(config: SourceConfig, index: number) {
  return join(HISTORY_DIR, `leaderboard-${config.version}-${index}.json`);
}

function getSnapshotKey(snapshot: Pick<LeaderboardHistorySnapshot, "roundId" | "phaseStartedAtBlock">) {
  return `${snapshot.roundId}::${snapshot.phaseStartedAtBlock ?? ""}`;
}

function sortHistorySnapshots(snapshots: LeaderboardHistorySnapshot[]) {
  return [...snapshots].sort((a, b) => (
    a.roundId - b.roundId
    || (a.phaseStartedAtBlock ?? Number.MAX_SAFE_INTEGER) - (b.phaseStartedAtBlock ?? Number.MAX_SAFE_INTEGER)
    || new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime()
  ));
}

function getLatestRoundSnapshots(snapshots: LeaderboardHistorySnapshot[]) {
  const latestByRound = new Map<number, LeaderboardHistorySnapshot>();

  for (const snapshot of sortHistorySnapshots(snapshots)) {
    latestByRound.set(snapshot.roundId, snapshot);
  }

  return Array.from(latestByRound.values()).slice(-HISTORY_ROUND_LIMIT);
}

function normalizeHistorySnapshot(value: unknown): LeaderboardHistorySnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const roundId = asNumber(value.roundId) ?? asNumber(value.round_id);

  if (roundId === null || !("data" in value)) {
    return null;
  }

  return {
    fetchedAt: asText(value.fetchedAt) ?? asText(value.fetched_at) ?? "",
    roundId,
    phaseStartedAtBlock: asNumber(value.phaseStartedAtBlock) ?? asNumber(value.phase_started_at_block),
    data: value.data
  };
}

async function readHistorySnapshot(file: string) {
  try {
    return normalizeHistorySnapshot(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return null;
  }
}

async function readLeaderboardHistory(config: SourceConfig) {
  const snapshots: LeaderboardHistorySnapshot[] = [];

  for (let index = 1; index <= HISTORY_ROUND_LIMIT - 1; index += 1) {
    const snapshot = await readHistorySnapshot(getHistoryFile(config, index));
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  const current = await readHistorySnapshot(config.currentHistoryFile);
  if (current) {
    snapshots.push(current);
  }

  return getLatestRoundSnapshots(snapshots);
}

function getHistoryResponse(snapshots: LeaderboardHistorySnapshot[]) {
  return snapshots.map((snapshot) => ({
    fetchedAt: snapshot.fetchedAt,
    round: snapshot.roundId,
    phaseStartedAtBlock: snapshot.phaseStartedAtBlock,
    data: snapshot.data
  }));
}

function createHistorySnapshot(payload: unknown, fetchedAt: string): LeaderboardHistorySnapshot | null {
  const roundId = getRoundId(payload);

  if (roundId === null) {
    return null;
  }

  return {
    fetchedAt,
    roundId,
    phaseStartedAtBlock: getPhaseStartedAtBlock(payload),
    data: payload
  };
}

async function rotateLeaderboardHistory(config: SourceConfig) {
  await unlink(getHistoryFile(config, 1)).catch(() => undefined);

  for (let index = 2; index <= HISTORY_ROUND_LIMIT - 1; index += 1) {
    await rename(getHistoryFile(config, index), getHistoryFile(config, index - 1)).catch(() => undefined);
  }

  await rename(config.currentHistoryFile, getHistoryFile(config, HISTORY_ROUND_LIMIT - 1)).catch(() => undefined);
}

async function writeHistorySnapshot(config: SourceConfig, snapshot: LeaderboardHistorySnapshot) {
  await mkdir(HISTORY_DIR, { recursive: true });
  await writeFile(config.currentHistoryFile, JSON.stringify(snapshot), "utf8");
}

async function updateLeaderboardHistory(config: SourceConfig, payload: unknown, fetchedAt: string) {
  if (!isDistributePhase(payload)) {
    return readLeaderboardHistory(config);
  }

  const incomingSnapshot = createHistorySnapshot(payload, fetchedAt);
  if (!incomingSnapshot) {
    return readLeaderboardHistory(config);
  }

  const currentSnapshot = await readHistorySnapshot(config.currentHistoryFile);
  if (currentSnapshot && getSnapshotKey(currentSnapshot) === getSnapshotKey(incomingSnapshot)) {
    return readLeaderboardHistory(config);
  }

  if (currentSnapshot) {
    await rotateLeaderboardHistory(config);
  }

  await writeHistorySnapshot(config, incomingSnapshot);
  return readLeaderboardHistory(config);
}

function emptyLeaderboard(config: SourceConfig, error: string, status?: number) {
  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      ok: true,
      apiVersion: config.version,
      source: config.sourceUrl,
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
      leaderboardHistory: [],
      warning: `Waiting for the source API: ${error}`
    },
    {
      headers: noStoreHeaders()
    }
  );
}

async function fallbackResponse(config: SourceConfig, error: string, status?: number) {
  const cached = await readCache(config);
  if (!cached) {
    return emptyLeaderboard(config, error, status);
  }

  const leaderboardHistory = getHistoryResponse(await readLeaderboardHistory(config));

  return NextResponse.json(
    {
      fetchedAt: cached.fetchedAt,
      ok: true,
      apiVersion: config.version,
      source: config.sourceUrl,
      data: cached.data,
      leaderboardHistory,
      stale: true,
      status,
      warning: `Using cached leaderboard because the source API is slow or unavailable: ${error}`
    },
    {
      headers: noStoreHeaders()
    }
  );
}

function getUpstreamError(body: unknown) {
  if (!isRecord(body) || typeof body.error !== "string" || "data" in body) {
    return null;
  }

  return body.error;
}

async function getLeaderboardResponse() {
  const config = getSourceConfig();
  let lastError = "Unknown leaderboard fetch error.";
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const fetchedAt = new Date().toISOString();

    try {
      const response = await fetch(config.sourceUrl, {
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

      const upstreamError = getUpstreamError(body);
      if (upstreamError) {
        lastStatus = response.status;
        lastError = upstreamError;
        break;
      }

      await writeCache(config, {
        fetchedAt,
        data: body
      });
      const leaderboardHistory = getHistoryResponse(await updateLeaderboardHistory(config, body, fetchedAt));

      return NextResponse.json(
        {
          fetchedAt,
          ok: true,
          apiVersion: config.version,
          source: config.sourceUrl,
          data: body,
          leaderboardHistory
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

  return fallbackResponse(config, lastError, lastStatus);
}

export default async function handler(_request: NextApiRequest, response: NextApiResponse) {
  const result = await getLeaderboardResponse();

  for (const [name, value] of Object.entries(result.headers ?? {})) {
    response.setHeader(name, value);
  }

  response.status(result.status).json(result.body);
}
