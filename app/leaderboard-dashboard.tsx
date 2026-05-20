"use client";

import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Gauge,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Trophy,
  Users,
  X
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

const REFRESH_MS = 30_000;
const LEADERBOARD_SOURCE = "https://dashboard-api.connito.ai/api/v1/leaderboard";
const THEME_STORAGE_KEY = "connito-dashboard-theme";
const VALIDATOR_COLUMN_COUNT = 5;
const LEADERBOARD_COLUMN_COUNT = 5 + VALIDATOR_COLUMN_COUNT * 2;
const VALIDATOR_COLUMNS = Array.from({ length: VALIDATOR_COLUMN_COUNT }, (_, index) => index);

type ApiResponse = {
  fetchedAt?: string;
  ok?: boolean;
  source?: unknown;
  data?: unknown;
  stale?: boolean;
  empty?: boolean;
  warning?: string;
  error?: string;
};

type MinerRow = {
  rank: number;
  uid: string;
  hotkey: string;
  repo: string;
  revision: string;
  score: number | null;
  loss: number | null;
  deltaLoss: number | null;
  weight: number | null;
  evaluations: number | null;
  assigned: boolean | null;
  validatorMetrics: ValidatorMetric[];
};

type ValidatorMetric = {
  label: string;
  slot: number | null;
  uid: number | null;
  chainUid: number | null;
  hotkey: string;
  score: number | null;
  valLoss: number | null;
  weightSubmitted: number | null;
  extractedAtBlock: number | null;
};

type HistoryPoint = {
  round: number;
  value: number;
  timestamp: number | null;
};

type UpcomingPhase = {
  name: string;
  startBlock: number;
  endBlock: number;
  blocksUntilStart: number;
  duration: number | null;
};

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

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (Math.abs(value) >= 1_000_000) {
    return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  }

  if (Math.abs(value) >= 1_000) {
    return Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
  }

  if (Math.abs(value) > 0 && Math.abs(value) < 0.001) {
    return value.toExponential(2);
  }

  return Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(value);
}

function formatMetricNumber(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (value === 0) {
    return "0";
  }

  if (Math.abs(value) > 0 && Math.abs(value) < 0.001) {
    return value.toExponential(2);
  }

  return Intl.NumberFormat("en", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function formatInteger(value: number | null | undefined) {
  return formatNumber(value, 0);
}

function formatPercent(value: number | null | undefined, digits = 2) {
  const formatted = formatNumber(value, digits);
  return formatted === "-" ? "-" : `${formatted}%`;
}

function formatBlock(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
}

function shortText(value: string, start = 8, end = 6) {
  if (!value || value === "-") {
    return "-";
  }

  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${end > 0 ? value.slice(-end) : ""}`;
}

function getHuggingFaceRepoUrl(repo: string) {
  return repo && repo !== "-" ? `https://huggingface.co/${repo.split("/").map(encodeURIComponent).join("/")}` : null;
}

function getHotkeyUrl(hotkey: string) {
  return hotkey && hotkey !== "-" ? `https://taostats.io/hotkey/${encodeURIComponent(hotkey)}` : null;
}

function getMinerKey(row: Pick<MinerRow, "uid" | "hotkey" | "repo" | "revision">) {
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

function DataCard({
  label,
  value,
  detail,
  icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="data-card">
      <div className="card-top">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function MetricBarChart({
  title,
  label,
  rows,
  metric,
  digits
}: {
  title: string;
  label: string;
  rows: MinerRow[];
  metric: "score" | "weight";
  digits: number;
}) {
  const leaders = rows
    .filter((row) => row[metric] !== null)
    .sort((a, b) => (b[metric] ?? Number.NEGATIVE_INFINITY) - (a[metric] ?? Number.NEGATIVE_INFINITY))
    .slice(0, 10);
  const max = Math.max(...leaders.map((row) => row[metric] ?? 0), 0);

  return (
    <article className="metric-chart-card">
      <div className="metric-chart-head">
        <span>{label}</span>
        <strong>{title}</strong>
      </div>
      {leaders.length ? (
        <div className="metric-bars">
          {leaders.map((row, index) => {
            const value = row[metric] ?? 0;
            const width = max > 0 ? Math.max(2, (value / max) * 100) : 0;

            return (
              <div className="metric-bar-row" key={`${metric}-${row.uid}-${row.hotkey}`} title={`UID ${row.uid} ${label.toLowerCase()} ${formatNumber(value, digits)}`}>
                <span>{index + 1}</span>
                <strong>UID {row.uid}</strong>
                <div className="metric-bar-track">
                  <i style={{ width: `${width}%` }} />
                </div>
                <em>{formatNumber(value, digits)}</em>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">Waiting for leaderboard data</div>
      )}
    </article>
  );
}

function MinerValidatorDetails({ row }: { row: MinerRow }) {
  const hotkeyUrl = getHotkeyUrl(row.hotkey);
  const repoUrl = getHuggingFaceRepoUrl(row.repo);

  return (
    <div className="miner-details">
      <div className="miner-details-head">
        <div>
          <span>Validator Breakdown</span>
          <strong>UID {row.uid}</strong>
        </div>
        <em>{formatInteger(row.validatorMetrics.length)} validators</em>
      </div>

      <div className="miner-summary-grid">
        <div className="miner-summary-item">
          <span>Revision</span>
          <strong title={row.revision}>{shortText(row.revision, 10, 0)}</strong>
        </div>
        <div className="miner-summary-item miner-summary-important">
          <span>Score</span>
          <strong>{formatMetricNumber(row.score, 4)}</strong>
        </div>
        <div className="miner-summary-item miner-summary-important">
          <span>Val Loss</span>
          <strong>{formatMetricNumber(row.loss, 6)}</strong>
        </div>
        <div className="miner-summary-item miner-summary-important">
          <span>Weight</span>
          <strong>{formatMetricNumber(row.weight, 4)}</strong>
        </div>
        <div className="miner-summary-item miner-summary-important">
          <span>Delta Loss</span>
          <strong>{formatMetricNumber(row.deltaLoss, 6)}</strong>
        </div>
        <div className="miner-summary-item">
          <span>Assigned</span>
          <strong>{row.assigned === null ? "-" : row.assigned ? "Yes" : "No"}</strong>
        </div>
        <div className="miner-summary-item miner-summary-wide">
          <span>Hotkey</span>
          <strong title={row.hotkey}>
            {hotkeyUrl ? (
              <a className="table-link" href={hotkeyUrl} target="_blank" rel="noreferrer">
                {shortText(row.hotkey, 10, 7)}
              </a>
            ) : shortText(row.hotkey, 10, 7)}
          </strong>
        </div>
        <div className="miner-summary-item miner-summary-wide">
          <span>Repository</span>
          <strong title={row.repo}>
            {repoUrl ? (
              <a className="table-link" href={repoUrl} target="_blank" rel="noreferrer">
                {shortText(row.repo, 18, 0)}
              </a>
            ) : shortText(row.repo, 18, 0)}
          </strong>
        </div>
      </div>

      <div className="validator-detail-frame">
        <table className="validator-detail-table" aria-label={`Validator metrics for UID ${row.uid}`}>
          <thead>
            <tr>
              <th>Label</th>
              <th>Slot</th>
              <th>Score</th>
              <th>Val Loss</th>
            </tr>
          </thead>
          <tbody>
            {row.validatorMetrics.length ? (
              row.validatorMetrics.map((metric, index) => (
                <tr key={`${metric.label}-${metric.uid ?? "uid"}-${metric.slot ?? "slot"}-${index}`}>
                  <td>{metric.label}</td>
                  <td>{formatInteger(metric.slot)}</td>
                  <td>{formatMetricNumber(metric.score, 4)}</td>
                  <td title={metric.valLoss === null ? undefined : String(metric.valLoss)}>{formatMetricNumber(metric.valLoss, 6)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>No validator metrics reported for this miner.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniLineChart({ points }: { points: HistoryPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 960, height: 190 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const syncSize = (rect: DOMRectReadOnly) => {
      const nextWidth = Math.round(rect.width);
      const nextHeight = Math.round(rect.height);

      if (nextWidth > 0 && nextHeight > 0) {
        setChartSize((current) => (
          current.width === nextWidth && current.height === nextHeight
            ? current
            : { width: nextWidth, height: nextHeight }
        ));
      }
    };

    syncSize(svg.getBoundingClientRect());

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      syncSize(entry.contentRect);
    });

    observer.observe(svg);
    return () => observer.disconnect();
  }, [points.length]);

  if (points.length < 2) {
    return <div className="empty-state">Waiting for round history</div>;
  }

  const { width, height } = chartSize;
  const padX = 34;
  const padTop = 18;
  const padBottom = 28;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const graphWidth = width - padX * 2;
  const graphHeight = height - padTop - padBottom;
  const xFor = (index: number) => padX + graphWidth * (index / Math.max(1, points.length - 1));
  const yFor = (value: number) => padTop + ((max - value) / range) * graphHeight;
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(point.value).toFixed(2)}`).join(" ");
  const area = `${line} L ${xFor(points.length - 1).toFixed(2)} ${height - padBottom} L ${xFor(0).toFixed(2)} ${height - padBottom} Z`;
  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((value, index, array) => array.indexOf(value) === index);
  const latest = points[points.length - 1];
  const hovered = hoverIndex === null ? latest : points[hoverIndex];
  const hoveredX = xFor(hoverIndex ?? points.length - 1);
  const hoveredY = yFor(hovered.value);
  const tooltipX = hoveredX > width - 220 ? hoveredX - 172 : hoveredX + 14;
  const tooltipY = Math.max(10, Math.min(height - 62, hoveredY - 42));

  const updateHover = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round(((relativeX - padX) / graphWidth) * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, index)));
  };

  return (
    <div className="chart-box">
      <div className="chart-summary">
        <span>Baseline loss</span>
        <strong>{formatNumber(hovered.value, 4)}</strong>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Baseline loss history"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={updateHover}
      >
        <path className="chart-area" d={area} />
        <path className="chart-line" d={line} />
        {hoverIndex !== null ? (
          <>
            <line className="chart-hover-line" x1={hoveredX} x2={hoveredX} y1={padTop} y2={height - padBottom} />
            <circle className="chart-hover-dot" cx={hoveredX} cy={hoveredY} r="5" />
            <g className="chart-tooltip-svg" transform={`translate(${tooltipX} ${tooltipY})`}>
              <rect width="158" height="52" rx="8" />
              <text x="10" y="19">Round {formatInteger(hovered.round)}</text>
              <text x="10" y="39">Loss {formatNumber(hovered.value, 4)}</text>
            </g>
          </>
        ) : null}
        {ticks.map((index) => (
          <g key={points[index].round}>
            <line className="chart-tick" x1={xFor(index)} x2={xFor(index)} y1={height - padBottom} y2={height - padBottom + 5} />
            <text x={xFor(index)} y={height - 10} textAnchor="middle">
              {formatInteger(points[index].round)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function LeaderboardDashboard() {
  const [leaderboard, setLeaderboard] = useState<ApiResponse | null>(null);
  const [cycle, setCycle] = useState<ApiResponse | null>(null);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [selectedMinerKey, setSelectedMinerKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [leaderboardResponse, cycleResponse] = await Promise.all([
        fetch(`/api/leaderboard?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/cycle?t=${Date.now()}`, { cache: "no-store" })
      ]);

      const [leaderboardBody, cycleBody] = (await Promise.all([
        leaderboardResponse.json(),
        cycleResponse.json()
      ])) as [ApiResponse, ApiResponse];

      if (!leaderboardResponse.ok || !leaderboardBody.ok) {
        throw new Error(leaderboardBody.error ?? "Leaderboard request failed.");
      }

      if (!cycleResponse.ok || !cycleBody.ok) {
        throw new Error(cycleBody.error ?? "Cycle request failed.");
      }

      setLeaderboard(leaderboardBody);
      setCycle(cycleBody);
      setError(leaderboardBody.warning ?? cycleBody.warning ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to refresh dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : "dark";

    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) {
      return;
    }

    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, themeReady]);

  const model = useMemo(() => {
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
  }, [cycle, leaderboard]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return model.rows.slice(0, 100);
    }

    return model.rows
      .filter((row) => `${row.uid} ${row.hotkey} ${row.repo} ${row.revision}`.toLowerCase().includes(needle))
      .slice(0, 100);
  }, [model.rows, query]);

  useEffect(() => {
    if (selectedMinerKey && !model.rows.some((row) => getMinerKey(row) === selectedMinerKey)) {
      setSelectedMinerKey(null);
    }
  }, [model.rows, selectedMinerKey]);

  const toggleMinerDetails = useCallback((row: MinerRow) => {
    const rowKey = getMinerKey(row);
    setSelectedMinerKey((current) => current === rowKey ? null : rowKey);
  }, []);

  const handleMinerRowKeyDown = useCallback((event: KeyboardEvent<HTMLTableRowElement>, row: MinerRow) => {
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input")) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleMinerDetails(row);
    }
  }, [toggleMinerDetails]);

  const scoredPercent = model.round.roster && model.round.roster > 0
    ? Math.max(0, Math.min(100, ((model.round.scored ?? 0) / model.round.roster) * 100))
    : 0;
  const status = error ? "Degraded" : model.empty ? "Waiting" : model.stale ? "Cached" : "Live";
  const lastSync = model.fetchedAt ? new Date(model.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
  const topMiner = model.rows[0];
  const topMinerHotkeyUrl = topMiner ? getHotkeyUrl(topMiner.hotkey) : null;
  const topMinerRepoUrl = topMiner ? getHuggingFaceRepoUrl(topMiner.repo) : null;

  return (
    <main className="dashboard-shell">
      <header className="app-header">
        <div className="brand-block">
          <img className="brand-logo" src="/logo.svg" alt="" width="48" height="48" />
          <div className="brand-copy">
            <span className="eyebrow">Connito Subnet</span>
            <h1>Subnet {formatInteger(model.subnet.netuid)} Dashboard</h1>
          </div>
        </div>

        <div className="header-actions">
          <a className="api-button" href={model.source} target="_blank" rel="noreferrer" aria-label="Open leaderboard API source">
            <Database size={15} />
            API
            <ExternalLink size={13} />
          </a>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span className={`status-pill status-${status.toLowerCase()}`}>
            <span />
            {status}
          </span>
          <button type="button" onClick={() => void load()} disabled={loading} title="Refresh dashboard">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>
      </header>

      <section className="compact-meta" aria-label="Dashboard details">
        <span>Sync {lastSync}</span>
        <span>{formatInteger(filteredRows.length)} shown</span>
        <span>{formatInteger(model.metrics.rows)} rows</span>
        <span>{formatInteger(model.metrics.assigned)} assigned</span>
        <span>Burn {formatPercent(model.metrics.burnPercent, 2)}</span>
        <span>Top {formatNumber(model.metrics.topScore, 4)}</span>
        <span>Avg {formatNumber(model.metrics.averageScore, 4)}</span>
      </section>

      {error ? (
        <div className="notice" role="alert" aria-live="assertive">
          <span className="notice-indicator" aria-hidden="true" />
          <div className="notice-copy">
            <strong>Fetch failed</strong>
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      <section className="overview-grid" aria-label="Subnet overview">
        <DataCard label="Miners" value={formatInteger(model.subnet.miners)} detail="registered on subnet" icon={<Users size={17} />} />
        <DataCard label="Validators" value={formatInteger(model.subnet.validators)} detail="active validator set" icon={<ShieldCheck size={17} />} />
        <DataCard label="Phase" value={model.phase.name} detail={`${formatInteger(model.phase.blocksRemaining)} blocks remaining`} icon={<Clock3 size={17} />} />
        <DataCard label="Round" value={formatInteger(model.round.id)} detail={`synced ${lastSync}`} icon={<Trophy size={17} />} />
        <DataCard label="Top Score" value={formatNumber(model.metrics.topScore, 4)} detail={`avg ${formatNumber(model.metrics.averageScore, 4)}`} icon={<Gauge size={17} />} />
        <DataCard label="Weight" value={formatNumber(model.metrics.totalWeight, 3)} detail={`${formatInteger(model.metrics.assigned)} assigned`} icon={<BarChart3 size={17} />} />
      </section>

      <section className="work-grid">
        <article className="phase-panel">
          <div className="section-title">
            <span>Current Phase</span>
            <h2>{model.phase.name}</h2>
          </div>
          <div className="progress-track" title={`${formatNumber(model.phase.progress, 1)}%`}>
            <i style={{ width: `${model.phase.progress}%` }} />
          </div>
          <div className="phase-stats">
            <div>
              <span>Head</span>
              <strong>{formatBlock(model.phase.headBlock)}</strong>
            </div>
            <div>
              <span>Start</span>
              <strong>{formatBlock(model.phase.phaseStart)}</strong>
            </div>
            <div>
              <span>End</span>
              <strong>{formatBlock(model.phase.phaseEnd)}</strong>
            </div>
            <div>
              <span>Block</span>
              <strong>{formatInteger(model.phase.cycleBlock)} / {formatInteger(model.phase.cycleLength)}</strong>
            </div>
            <div>
              <span>Cycle</span>
              <strong>{formatInteger(model.phase.cycleIndex)}</strong>
            </div>
            <div>
              <span>Remain</span>
              <strong>{formatInteger(model.phase.blocksRemaining)}</strong>
            </div>
          </div>
        </article>

        <article className="round-panel">
          <div className="section-title">
            <span>Round Health</span>
            <h2>{formatNumber(scoredPercent, 1)}% scored</h2>
          </div>
          <div className="round-stats">
            <div>
              <Gauge size={16} />
              <span>Loss</span>
              <strong>{formatNumber(model.round.baselineLoss, 4)}</strong>
            </div>
            <div>
              <CheckCircle2 size={16} />
              <span>Scored</span>
              <strong>{formatInteger(model.round.scored)}</strong>
            </div>
            <div>
              <Activity size={16} />
              <span>Pending</span>
              <strong>{formatInteger(model.round.pending)}</strong>
            </div>
            <div>
              <X size={16} />
              <span>Failed</span>
              <strong>{formatInteger(model.round.failed)}</strong>
            </div>
            <div>
              <Users size={16} />
              <span>Roster</span>
              <strong>{formatInteger(model.round.roster)}</strong>
            </div>
            <div>
              <Database size={16} />
              <span>Claimed</span>
              <strong>{formatInteger(model.round.claimed)}</strong>
            </div>
          </div>
        </article>
      </section>

      {model.phase.upcoming.length ? (
        <section className="upcoming-phase-section" aria-label="Upcoming phases">
          <div className="section-title">
            <span>Phase Schedule</span>
            <h2>Upcoming Phases</h2>
          </div>
          <div className="phase-timeline">
            {model.phase.upcoming.map((phase, index) => (
              <article className={`phase-step${index === 0 ? " phase-step-next" : ""}`} key={`${phase.name}-${phase.startBlock}`}>
                <div className="phase-step-top">
                  <span>{index === 0 ? "Next" : `+${formatInteger(phase.blocksUntilStart)}`}</span>
                  <strong>{phase.name}</strong>
                </div>
                <div className="phase-step-meta">
                  <span>In {formatInteger(phase.blocksUntilStart)} blocks</span>
                  <span>{formatBlock(phase.startBlock)} - {formatBlock(phase.endBlock)}</span>
                  <span>{formatInteger(phase.duration)} blocks</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="round-chart-section">
        <div className="section-title">
          <span>Baseline Trend</span>
          <h2>Recent Round Loss</h2>
        </div>
        <MiniLineChart points={model.round.history} />
      </section>

      <section className="metric-chart-section">
        <div className="section-title">
          <span>Leaderboard Metrics</span>
          <h2>Scores and Weights</h2>
        </div>
        <div className="metric-chart-grid">
          <MetricBarChart title="Top Weights" label="Weight" rows={model.rows} metric="weight" digits={4} />
          <MetricBarChart title="Top Scores" label="Score" rows={model.rows} metric="score" digits={4} />
        </div>
      </section>

      <section className="leaderboard-section">
        <div className="leaderboard-header">
          <div className="section-title">
            <span>Leaderboard</span>
            <h2>Top Miners</h2>
          </div>
          <label className="search-field">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search UID, hotkey, repo" />
            {query ? (
              <button type="button" onClick={() => setQuery("")} title="Clear search">
                <X size={14} />
              </button>
            ) : null}
          </label>
        </div>

        <div className="top-miner-strip">
          <div className="top-miner-info">
            <BarChart3 size={17} />
            <span>Top weight</span>
            <strong>
              {topMiner && topMinerHotkeyUrl ? (
                <a className="table-link" href={topMinerHotkeyUrl} target="_blank" rel="noreferrer">
                  UID {topMiner.uid}
                </a>
              ) : topMiner ? `UID ${topMiner.uid}` : "-"}
            </strong>
            <em>{topMiner ? `Score: ${formatNumber(topMiner.weight, 4)}` : "-"}</em>
            <small>
              {topMiner && topMinerRepoUrl ? (
                <a className="table-link" href={topMinerRepoUrl} target="_blank" rel="noreferrer">
                  {shortText(topMiner.repo, 22, 0)}
                </a>
              ) : topMiner ? shortText(topMiner.repo, 22, 0) : "-"}
            </small>
          </div>
          <div className="burn-info">
            <span>Burn</span>
            <em>{formatPercent(model.metrics.burnPercent, 2)}</em>
          </div>
        </div>

        <div className="table-frame">
          <table>
            <thead>
              <tr>
                <th className="rank-column">#</th>
                <th className="uid-column">UID</th>
                <th className="hotkey-column">Hotkey</th>
                <th className="repo-column">Repository</th>
                <th className="weight-column">Weight</th>
                {VALIDATOR_COLUMNS.map((index) => (
                  <Fragment key={`validator-heading-${index}`}>
                    <th className={`validator-metric-heading validator-${index + 1}-column`} title={`Validator ${index + 1} score`}>
                      V{index + 1} S
                    </th>
                    <th className={`validator-metric-heading validator-${index + 1}-column`} title={`Validator ${index + 1} val loss`}>
                      V{index + 1} L
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                (() => {
                  const hotkeyUrl = getHotkeyUrl(row.hotkey);
                  const repoUrl = getHuggingFaceRepoUrl(row.repo);
                  const rowKey = getMinerKey(row);
                  const detailsId = `miner-details-${row.rank}-${row.uid}`;
                  const selected = selectedMinerKey === rowKey;
                  const rowWeight = formatMetricNumber(row.weight, 4);

                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className={`leaderboard-row${selected ? " leaderboard-row-selected" : ""}`}
                        tabIndex={0}
                        aria-expanded={selected}
                        aria-controls={detailsId}
                        title="Click for validator score and loss details"
                        onClick={() => toggleMinerDetails(row)}
                        onKeyDown={(event) => handleMinerRowKeyDown(event, row)}
                      >
                        <td className="rank-column">{row.rank}</td>
                        <td className="uid-column">{row.uid}</td>
                        <td className="hotkey-column" title={row.hotkey}>
                          {hotkeyUrl ? (
                            <a className="table-link" href={hotkeyUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                              {shortText(row.hotkey, 8, 6)}
                            </a>
                          ) : shortText(row.hotkey, 8, 6)}
                        </td>
                        <td className="repo-column" title={row.repo}>
                          {repoUrl ? (
                            <a className="table-link" href={repoUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                              {shortText(row.repo, 24, 0)}
                            </a>
                          ) : shortText(row.repo, 24, 0)}
                        </td>
                        <td className="weight-column">{rowWeight}</td>
                        {VALIDATOR_COLUMNS.map((index) => {
                          const metric = row.validatorMetrics[index];
                          const score = formatMetricNumber(metric?.score, 4);
                          const valLoss = formatMetricNumber(metric?.valLoss, 4);

                          return (
                            <Fragment key={`${rowKey}-validator-${index}`}>
                              <td
                                className={`validator-metric-cell validator-${index + 1}-column`}
                                title={metric ? `${metric.label} score ${score}` : undefined}
                              >
                                {score}
                              </td>
                              <td
                                className={`validator-metric-cell validator-${index + 1}-column`}
                                title={metric ? `${metric.label} val loss ${valLoss}` : undefined}
                              >
                                {valLoss}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                      {selected ? (
                        <tr className="leaderboard-details-row" id={detailsId}>
                          <td className="leaderboard-details-cell" colSpan={LEADERBOARD_COLUMN_COUNT}>
                            <MinerValidatorDetails row={row} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })()
              ))}
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={LEADERBOARD_COLUMN_COUNT}>No miners match the current search.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
