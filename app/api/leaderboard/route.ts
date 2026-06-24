import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { NextResponse } from "next/server";

import { LEADERBOARD_SOURCE } from "../../dashboard/constants";

const SOURCE_URL = LEADERBOARD_SOURCE;
const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 2;
const CACHE_VERSION = "v3";
const CACHE_FILE = join(process.cwd(), ".next", "cache", `connito-leaderboard-${CACHE_VERSION}.json`);
const HISTORY_DIR = join(process.cwd(), ".next", "cache");
const CURRENT_HISTORY_FILE = join(HISTORY_DIR, `leaderboard-${CACHE_VERSION}.json`);
const HISTORY_ROUND_LIMIT = 8;

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

function getHistoryFile(index: number) {
  return join(HISTORY_DIR, `leaderboard-${CACHE_VERSION}-${index}.json`);
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

async function readLeaderboardHistory() {
  const snapshots: LeaderboardHistorySnapshot[] = [];

  for (let index = 1; index <= HISTORY_ROUND_LIMIT - 1; index += 1) {
    const snapshot = await readHistorySnapshot(getHistoryFile(index));
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  const current = await readHistorySnapshot(CURRENT_HISTORY_FILE);
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

async function rotateLeaderboardHistory() {
  await unlink(getHistoryFile(1)).catch(() => undefined);

  for (let index = 2; index <= HISTORY_ROUND_LIMIT - 1; index += 1) {
    await rename(getHistoryFile(index), getHistoryFile(index - 1)).catch(() => undefined);
  }

  await rename(CURRENT_HISTORY_FILE, getHistoryFile(HISTORY_ROUND_LIMIT - 1)).catch(() => undefined);
}

async function writeHistorySnapshot(snapshot: LeaderboardHistorySnapshot) {
  await mkdir(HISTORY_DIR, { recursive: true });
  await writeFile(CURRENT_HISTORY_FILE, JSON.stringify(snapshot), "utf8");
}

async function updateLeaderboardHistory(payload: unknown, fetchedAt: string) {
  if (!isDistributePhase(payload)) {
    return readLeaderboardHistory();
  }

  const incomingSnapshot = createHistorySnapshot(payload, fetchedAt);
  if (!incomingSnapshot) {
    return readLeaderboardHistory();
  }

  const currentSnapshot = await readHistorySnapshot(CURRENT_HISTORY_FILE);
  if (currentSnapshot && getSnapshotKey(currentSnapshot) === getSnapshotKey(incomingSnapshot)) {
    return readLeaderboardHistory();
  }

  if (currentSnapshot) {
    await rotateLeaderboardHistory();
  }

  await writeHistorySnapshot(incomingSnapshot);
  return readLeaderboardHistory();
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
      leaderboardHistory: [],
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

  const leaderboardHistory = getHistoryResponse(await readLeaderboardHistory());

  return NextResponse.json(
    {
      fetchedAt: cached.fetchedAt,
      ok: true,
      source: SOURCE_URL,
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
      const leaderboardHistory = getHistoryResponse(await updateLeaderboardHistory(body, fetchedAt));

      return NextResponse.json(
        {
          fetchedAt,
          ok: true,
          source: SOURCE_URL,
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

  return fallbackResponse(lastError, lastStatus);
}
