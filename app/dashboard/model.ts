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

function asTextArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(asText).filter((item): item is string => item !== null)
    : [];
}

function averageNumbers(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
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
      const score = asNumber(metric.score)
        ?? asNumber(metric.score_avg)
        ?? asNumber(metric.avg_score)
        ?? asNumber(metric.score_latest)
        ?? asNumber(metric.latest_score);
      const scoreLatest = asNumber(metric.score_latest) ?? asNumber(metric.latest_score);
      const scoreAverage = asNumber(metric.score_avg) ?? asNumber(metric.avg_score) ?? asNumber(metric.score);

      return {
        label: asText(metric.validator_label) ?? asText(metric.label) ?? (slot === null ? `Validator ${index + 1}` : `val-${String(slot).padStart(2, "0")}`),
        slot,
        uid: asNumber(metric.validator_uid) ?? asNumber(metric.uid),
        chainUid: asNumber(metric.validator_chain_uid),
        hotkey: asText(metric.validator_hotkey) ?? "-",
        score,
        scoreLatest,
        scoreAverage,
        scoreSamples: asNumber(metric.score_samples),
        valLoss: asNumber(metric.val_loss) ?? asNumber(metric.validation_loss) ?? asNumber(metric.loss),
        weightSubmitted: asNumber(metric.weight_submitted) ?? asNumber(metric.weight),
        extractedAtBlock: asNumber(metric.extracted_at_block) ?? asNumber(metric.block),
        validatorStatus: asText(metric.validator_status),
        evalStatusCode: asNumber(metric.eval_status_code),
        evalStatusLabel: asText(metric.eval_status_label),
        failureReasons: asTextArray(metric.observed_failure_reasons)
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
      scoreLatest: null,
      scoreAverage: null,
      scoreSamples: null,
      valLoss: null,
      weightSubmitted: null,
      extractedAtBlock: null,
      validatorStatus: null,
      evalStatusCode: null,
      evalStatusLabel: null,
      failureReasons: []
    };
  });
}

function getLeaderboardRows(data: Record<string, unknown>): MinerRow[] {
  const records = Array.isArray(data.leaderboard) ? data.leaderboard.filter(isRecord) : [];

  return records
    .map((row) => {
      const validatorMetrics = getValidatorMetrics(row);

      return {
        uid: asText(row.uid) ?? asText(row.miner_uid) ?? "-",
        hotkey: asText(row.hotkey) ?? "-",
        repo: asText(row.hf_repo_id) ?? "-",
        revision: asText(row.hf_revision) ?? "-",
        score: asNumber(row.score)
          ?? asNumber(row.score_avg)
          ?? asNumber(row.avg_score)
          ?? asNumber(row.score_latest)
          ?? asNumber(row.latest_score)
          ?? averageNumbers(validatorMetrics.map((metric) => metric.score)),
        loss: asNumber(row.val_loss) ?? asNumber(row.loss) ?? asNumber(row.validation_loss),
        deltaLoss: asNumber(row.delta_loss) ?? asNumber(row.loss_delta) ?? asNumber(row.deltaLoss),
        weight: asNumber(row.chain_weight_stake_weighted) ?? asNumber(row.weight_submitted),
        evaluations: asNumber(row.evaluation_count) ?? asNumber(row.scored_by_count),
        assigned: asBoolean(row.in_assignment),
        validatorMetrics
      };
    })
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

function completeUpcomingPhases(phases: UpcomingPhase[]) {
  return phases
    .sort((a, b) => a.blocksUntilStart - b.blocksUntilStart || a.startBlock - b.startBlock || a.name.localeCompare(b.name))
    .map((phase, index, sortedPhases) => {
      if (phase.endBlock !== null) {
        return phase;
      }

      const nextStartBlock = sortedPhases[index + 1]?.startBlock ?? null;
      const endBlock = nextStartBlock !== null && nextStartBlock > phase.startBlock ? nextStartBlock - 1 : null;

      return {
        ...phase,
        endBlock,
        duration: endBlock === null ? phase.duration : endBlock - phase.startBlock + 1
      };
    });
}

function getUpcomingPhases(phase: Record<string, unknown> | null, headBlock: number | null): UpcomingPhase[] {
  const upcoming = Array.isArray(phase?.upcoming) ? phase.upcoming.filter(isRecord) : [];

  const phases = upcoming
    .map((rawPhase) => {
      const name = asText(rawPhase.name) ?? asText(rawPhase.phase_name);
      const startBlock = asNumber(rawPhase.start_block) ?? asNumber(rawPhase.phase_start_block) ?? asNumber(rawPhase.start);
      const endBlock = asNumber(rawPhase.end_block) ?? asNumber(rawPhase.phase_end_block) ?? asNumber(rawPhase.end);
      const blocksUntilStart = asNumber(rawPhase.blocks_until_start)
        ?? asNumber(rawPhase.blocks_until)
        ?? asNumber(rawPhase.blocks_remaining)
        ?? (headBlock === null || startBlock === null ? null : startBlock - headBlock);

      if (name === null || startBlock === null || blocksUntilStart === null || blocksUntilStart < 0) {
        return null;
      }

      return {
        name,
        startBlock,
        endBlock,
        blocksUntilStart,
        duration: endBlock !== null && endBlock >= startBlock ? endBlock - startBlock + 1 : null,
        actor: asText(rawPhase.actor)
      };
    })
    .filter((phase): phase is UpcomingPhase => phase !== null);

  return completeUpcomingPhases(phases);
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

export function buildDashboardModel(leaderboard: ApiResponse | null): DashboardModel {
  const data = unwrapDashboardData(leaderboard?.data);
  const subnet = isRecord(data.subnet) ? data.subnet : null;
  const phase = isRecord(data.phase) ? data.phase : null;
  const round = isRecord(data.round) ? data.round : null;
  const roundStats = isRecord(round?.stats) ? round.stats : null;
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
  const phaseName = asText(phase?.name) ?? "-";
  const headBlock = asNumber(phase?.head_block);
  const phaseStart = asNumber(phase?.started_at_block);
  const phaseEnd = asNumber(phase?.ends_at_block);
  const blocksInto = headBlock !== null && phaseStart !== null ? headBlock - phaseStart : null;
  const blocksRemaining = asNumber(phase?.blocks_remaining);
  const cycleIndex = asNumber(phase?.cycle_index);
  const cycleLength = asNumber(phase?.cycle_length);
  const cycleStart = cycleIndex !== null && cycleLength !== null ? cycleIndex * cycleLength : null;
  const cycleBlockFromIndex = headBlock !== null && cycleStart !== null ? headBlock - cycleStart : null;
  const cycleBlock = cycleBlockFromIndex !== null && cycleBlockFromIndex >= 0
    ? cycleBlockFromIndex
    : headBlock !== null && phaseStart !== null ? headBlock - phaseStart : null;
  const upcomingPhases = getUpcomingPhases(phase, headBlock);
  const scores = rows.map((row) => row.score).filter((value): value is number => value !== null);
  const weights = rows.map((row) => row.weight).filter((value): value is number => value !== null);
  const assigned = rows.filter((row) => row.assigned === true).length;

  return {
    source: typeof leaderboard?.source === "string" ? leaderboard.source : LEADERBOARD_SOURCE,
    fetchedAt: leaderboard?.fetchedAt ?? null,
    stale: Boolean(leaderboard?.stale),
    empty: Boolean(leaderboard?.empty),
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
      topWeight: weights.length ? Math.max(...weights) : null,
      totalWeight: weights.length ? weights.reduce((sum, value) => sum + value, 0) : null,
      burnPercent: getBurnPercent(burnRow?.weight, totalWeightIncludingBurn || null)
    },
    rows
  };
}
