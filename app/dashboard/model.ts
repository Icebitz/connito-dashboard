import { LEADERBOARD_SOURCE } from "./constants";
import type { ApiResponse, DashboardModel, HistoryPoint, MinerRow, UpcomingPhase, ValidatorMetric } from "./types";

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

function asBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1 ? true : value === 0 ? false : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1", "active"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "0", "inactive"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function unwrapDashboardData(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) {
    return payload.data;
  }

  return isRecord(payload) ? payload : {};
}

export function getMinerKey(row: Pick<MinerRow, "uid" | "hotkey" | "repo" | "revision">) {
  return `${row.uid}::${row.hotkey}::${row.repo}::${row.revision}`;
}

function isBurnRow(row: Pick<MinerRow, "uid">) {
  return row.uid === "0";
}

function getValidatorMetrics(row: Record<string, unknown>): ValidatorMetric[] {
  const metrics = Array.isArray(row.validator_metrics) ? row.validator_metrics.filter(isRecord) : [];

  if (metrics.length) {
    return metrics.map((metric, index) => {
      const slot = asNumber(metric.validator_slot) ?? asNumber(metric.slot);

      return {
        label: asText(metric.validator_label) ?? asText(metric.label) ?? (slot === null ? `Validator ${index + 1}` : `val-${String(slot).padStart(2, "0")}`),
        slot,
        uid: asNumber(metric.validator_uid) ?? asNumber(metric.uid),
        chainUid: asNumber(metric.validator_chain_uid),
        hotkey: asText(metric.validator_hotkey) ?? "-",
        score: asNumber(metric.score),
        valLoss: asNumber(metric.val_loss) ?? asNumber(metric.validation_loss) ?? asNumber(metric.loss),
        weightSubmitted: asNumber(metric.weight_submitted) ?? asNumber(metric.weight),
        extractedAtBlock: asNumber(metric.extracted_at_block) ?? asNumber(metric.block)
      };
    });
  }

  const labels = Array.isArray(row.evaluated_by_validator_labels) ? row.evaluated_by_validator_labels : [];
  const slots = Array.isArray(row.evaluated_by_validator_slots) ? row.evaluated_by_validator_slots : [];
  const uids = Array.isArray(row.evaluated_by_validator_uids) ? row.evaluated_by_validator_uids : [];
  const count = Math.max(labels.length, slots.length, uids.length);

  return Array.from({ length: count }, (_, index) => {
    const slot = asNumber(slots[index]);

    return {
      label: asText(labels[index]) ?? (slot === null ? `Validator ${index + 1}` : `val-${String(slot).padStart(2, "0")}`),
      slot,
      uid: asNumber(uids[index]),
      chainUid: null,
      hotkey: "-",
      score: null,
      valLoss: null,
      weightSubmitted: null,
      extractedAtBlock: null
    };
  });
}

function getLeaderboardRows(data: Record<string, unknown>): MinerRow[] {
  const records = Array.isArray(data.leaderboard) ? data.leaderboard.filter(isRecord) : [];

  return records
    .map((row) => ({
      uid: asText(row.uid) ?? asText(row.miner_uid) ?? "-",
      hotkey: asText(row.hotkey) ?? "-",
      repo: asText(row.hf_repo_id) ?? "-",
      revision: asText(row.hf_revision) ?? "-",
      score: asNumber(row.score),
      loss: asNumber(row.val_loss) ?? asNumber(row.loss) ?? asNumber(row.validation_loss),
      deltaLoss: asNumber(row.delta_loss) ?? asNumber(row.loss_delta) ?? asNumber(row.deltaLoss),
      weight: asNumber(row.chain_weight_stake_weighted) ?? asNumber(row.weight_submitted),
      evaluations: asNumber(row.evaluation_count) ?? asNumber(row.scored_by_count),
      assigned: asBoolean(row.in_assignment),
      validatorMetrics: getValidatorMetrics(row)
    }))
    .sort((a, b) => {
      const weightDelta = (b.weight ?? Number.NEGATIVE_INFINITY) - (a.weight ?? Number.NEGATIVE_INFINITY);
      if (weightDelta !== 0) {
        return weightDelta;
      }

      return (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY);
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1
    }));
}

function getBurnPercent(burnWeight: number | null | undefined, totalWeight: number | null | undefined) {
  if (burnWeight === null || burnWeight === undefined || !Number.isFinite(burnWeight)) {
    return null;
  }

  if (totalWeight !== null && totalWeight !== undefined && Number.isFinite(totalWeight) && totalWeight > 0) {
    return (burnWeight / totalWeight) * 100;
  }

  return burnWeight <= 1 ? burnWeight * 100 : burnWeight;
}

function getRoundHistory(round: Record<string, unknown> | null): HistoryPoint[] {
  const history = Array.isArray(round?.baseline_loss_history) ? round.baseline_loss_history.filter(isRecord) : [];

  return history
    .map((point) => {
      const roundId = asNumber(point.round_id);
      const value = asNumber(point.baseline_loss);

      if (roundId === null || value === null) {
        return null;
      }

      return {
        round: roundId,
        value,
        timestamp: asNumber(point.timestamp)
      };
    })
    .filter((point): point is HistoryPoint => point !== null)
    .sort((a, b) => {
      if (a.timestamp !== null && b.timestamp !== null && a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }

      return a.round - b.round;
    })
    .slice(-48);
}

function getUpcomingPhases(cycleData: Record<string, unknown>, headBlock: number | null): UpcomingPhase[] {
  const windows = isRecord(cycleData.blocksUntilNextPhase) ? cycleData.blocksUntilNextPhase : {};

  return Object.entries(windows)
    .map(([name, rawWindow]) => {
      let startBlock: number | null = null;
      let endBlock: number | null = null;
      let blocksUntilStart: number | null = null;

      if (Array.isArray(rawWindow)) {
        startBlock = asNumber(rawWindow[0]);
        endBlock = asNumber(rawWindow[1]);
        blocksUntilStart = asNumber(rawWindow[2]);
      } else if (isRecord(rawWindow)) {
        startBlock = asNumber(rawWindow.start_block) ?? asNumber(rawWindow.phase_start_block) ?? asNumber(rawWindow.start);
        endBlock = asNumber(rawWindow.end_block) ?? asNumber(rawWindow.phase_end_block) ?? asNumber(rawWindow.end);
        blocksUntilStart = asNumber(rawWindow.blocks_until_start) ?? asNumber(rawWindow.blocks_until) ?? asNumber(rawWindow.blocks_remaining);
      }

      if (startBlock === null || endBlock === null) {
        return null;
      }

      const resolvedBlocksUntilStart = blocksUntilStart ?? (headBlock === null ? null : startBlock - headBlock);
      if (resolvedBlocksUntilStart === null || resolvedBlocksUntilStart < 0) {
        return null;
      }

      return {
        name,
        startBlock,
        endBlock,
        blocksUntilStart: resolvedBlocksUntilStart,
        duration: endBlock >= startBlock ? endBlock - startBlock + 1 : null
      };
    })
    .filter((phase): phase is UpcomingPhase => phase !== null)
    .sort((a, b) => a.blocksUntilStart - b.blocksUntilStart || a.startBlock - b.startBlock || a.name.localeCompare(b.name));
}

function getProgress(into: number | null, remaining: number | null, start: number | null, end: number | null, head: number | null) {
  if (into !== null && remaining !== null && into + remaining > 0) {
    return Math.max(0, Math.min(100, (into / (into + remaining)) * 100));
  }

  if (start !== null && end !== null && head !== null && end > start) {
    return Math.max(0, Math.min(100, ((head - start) / (end - start)) * 100));
  }

  return 0;
}

export function buildDashboardModel(leaderboard: ApiResponse | null, cycle: ApiResponse | null): DashboardModel {
  const data = unwrapDashboardData(leaderboard?.data);
  const cycleData = isRecord(cycle?.data) ? cycle.data : {};
  const subnet = isRecord(data.subnet) ? data.subnet : null;
  const phase = isRecord(data.phase) ? data.phase : null;
  const round = isRecord(data.round) ? data.round : null;
  const roundStats = isRecord(round?.stats) ? round.stats : null;
  const cyclePhase = isRecord(cycleData.phase) ? cycleData.phase : null;
  const allRows = getLeaderboardRows(data);
  const burnRow = allRows.find(isBurnRow) ?? null;
  const totalWeightIncludingBurn = allRows
    .map((row) => row.weight)
    .filter((value): value is number => value !== null)
    .reduce((sum, value) => sum + value, 0);
  const rows = allRows
    .filter((row) => !isBurnRow(row))
    .map((row, index) => ({
      ...row,
      rank: index + 1
    }));
  const history = getRoundHistory(round);
  const phaseName = asText(cyclePhase?.phase_name) ?? asText(phase?.name) ?? "-";
  const headBlock = asNumber(cyclePhase?.block) ?? asNumber(phase?.head_block);
  const phaseStart = asNumber(cyclePhase?.phase_start_block) ?? asNumber(phase?.started_at_block);
  const phaseEnd = asNumber(cyclePhase?.phase_end_block) ?? asNumber(phase?.ends_at_block);
  const blocksInto = asNumber(cyclePhase?.blocks_into_phase);
  const blocksRemaining = asNumber(cyclePhase?.blocks_remaining_in_phase) ?? asNumber(phase?.blocks_remaining);
  const cycleIndex = asNumber(cyclePhase?.cycle_index) ?? asNumber(phase?.cycle_index);
  const cycleLength = asNumber(cyclePhase?.cycle_length) ?? asNumber(phase?.cycle_length);
  const cycleBlock = asNumber(cyclePhase?.cycle_block_index);
  const upcomingPhases = getUpcomingPhases(cycleData, headBlock);
  const scores = rows.map((row) => row.score).filter((value): value is number => value !== null);
  const weights = rows.map((row) => row.weight).filter((value): value is number => value !== null);
  const assigned = rows.filter((row) => row.assigned === true).length;

  return {
    source: typeof leaderboard?.source === "string" ? leaderboard.source : LEADERBOARD_SOURCE,
    fetchedAt: leaderboard?.fetchedAt ?? cycle?.fetchedAt ?? null,
    stale: Boolean(leaderboard?.stale || cycle?.stale),
    empty: Boolean(leaderboard?.empty || cycle?.empty),
    subnet: {
      netuid: asNumber(subnet?.netuid) ?? 102,
      miners: asNumber(subnet?.total_miners) ?? rows.length,
      validators: asNumber(subnet?.validator_count)
    },
    phase: {
      name: phaseName,
      headBlock,
      phaseStart,
      phaseEnd,
      blocksInto,
      blocksRemaining,
      cycleIndex,
      cycleLength,
      cycleBlock,
      progress: getProgress(blocksInto, blocksRemaining, phaseStart, phaseEnd, headBlock),
      upcoming: upcomingPhases
    },
    round: {
      id: asNumber(round?.id),
      baselineLoss: asNumber(round?.baseline_loss),
      roster: asNumber(roundStats?.roster),
      scored: asNumber(roundStats?.scored),
      pending: asNumber(roundStats?.pending),
      failed: asNumber(roundStats?.failed),
      downloaded: asNumber(roundStats?.downloaded),
      claimed: asNumber(roundStats?.claimed),
      history
    },
    metrics: {
      rows: rows.length,
      assigned,
      topScore: scores.length ? Math.max(...scores) : null,
      averageScore: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null,
      totalWeight: weights.length ? weights.reduce((sum, value) => sum + value, 0) : null,
      burnPercent: getBurnPercent(burnRow?.weight, totalWeightIncludingBurn || null)
    },
    rows
  };
}
