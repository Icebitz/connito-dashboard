"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { VALIDATOR_COLUMNS } from "../constants";
import { formatInteger, formatMetricNumber, formatRepoRevision, getHuggingFaceRepoUrl, shortText } from "../format";
import { statusTone } from "../status";
import type { MinerRow, ValidatorHealth, ValidatorMetric } from "../types";
import { CopyHotkeyButton } from "./copy-hotkey-button";
import { MinerDetailsModal } from "./miner-details-modal";

const PAGE_SIZE_OPTIONS = [25, 50, 100, "all"] as const;

type LeaderboardSectionProps = {
  allRows: MinerRow[];
  filteredRows: MinerRow[];
  query: string;
  validatorHealth: ValidatorHealth[];
  onQueryChange: (value: string) => void;
};

type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export function LeaderboardSection({ allRows, filteredRows, query, validatorHealth, onQueryChange }: LeaderboardSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(25);
  const [detailUid, setDetailUid] = useState<string | null>(null);

  const sortedRows = useMemo(() => [...filteredRows].sort((a, b) => a.rank - b.rank), [filteredRows]);
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const pageStart = pageSize === "all" ? 0 : (safePage - 1) * pageSize;
  const pageRows = pageSize === "all" ? sortedRows : sortedRows.slice(pageStart, pageStart + pageSize);
  const visibleStart = sortedRows.length ? pageStart + 1 : 0;
  const visibleEnd = pageSize === "all" ? sortedRows.length : Math.min(pageStart + pageSize, sortedRows.length);
  const selectedRow = useMemo(() => detailUid ? allRows.find((row) => row.uid === detailUid) ?? null : null, [allRows, detailUid]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  return (
    <section className="lb-leaderboard lb-panel">
      <div className="lb-leaderboard-top">
        <div className="lb-leaderboard-head">
          <div className="lb-section-title">
            <span>Leaderboard</span>
          </div>

          <small>
            Showing {visibleStart}-{visibleEnd} of {filteredRows.length}
          </small>

          <div className="lb-leaderboard-controls">
            <label className="lb-search-field lb-search-field-wide">
              <Search size={15} />
              <input
                aria-label="Search miners by UID, hotkey, or repo"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search UID, Hotkey, Repo"
              />
              {query ? (
                <button type="button" className="lb-clear-button" onClick={() => onQueryChange("")} aria-label="Clear search">
                  <X size={14} />
                </button>
              ) : null}
            </label>

            <label className="lb-page-size-field">
              <span>Rows</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(parsePageSizeOption(event.target.value));
                  setCurrentPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option === "all" ? "All" : option}</option>
                ))}
              </select>
            </label>

            <div className="lb-pagination lb-pagination-inline" aria-label="Leaderboard pagination">
              <button
                type="button"
                className="lb-page-button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                aria-label="Previous leaderboard page"
              >
                <ChevronLeft size={16} />
              </button>
              <strong>{safePage} / {pageCount}</strong>
              <button
                type="button"
                className="lb-page-button"
                disabled={safePage >= pageCount}
                onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                aria-label="Next leaderboard page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lb-table-frame">
        <table className="lb-table">
          <thead>
            <tr>
              <th className="lb-col-rank">Rank</th>
              <th className="lb-col-uid">UID</th>
              <th className="lb-col-group">Group</th>
              <th className="lb-col-model">Miner</th>
              <th className="lb-col-num">Incentive</th>
              <th className="lb-col-trend">Trend</th>
              <th className="lb-col-commit">Commit</th>
              <th className="lb-col-validator-metrics">Validator Metrics</th>
              <th className="lb-col-status">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <LeaderboardRow
                key={row.uid}
                row={row}
                onInspectRow={() => setDetailUid(row.uid)}
              />
            ))}
            {!filteredRows.length ? (
              <tr>
                <td colSpan={9} className="lb-empty-cell">No miners match the current search.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedRow ? (
        <MinerDetailsModal
          row={selectedRow}
          validatorHealth={validatorHealth}
          onClose={() => setDetailUid(null)}
        />
      ) : null}
    </section>
  );
}

function LeaderboardRow({
  row,
  onInspectRow
}: {
  row: MinerRow;
  onInspectRow: () => void;
}) {
  const repoRevisionUrl = getHuggingFaceRepoUrl(row.repo);
  const repoRevisionLabel = formatRepoRevision(row.repo, row.revision);
  const statusLabel = getRowStatusLabel(row);
  const commitLabel = getCommitLabel(row);
  const groupLabel = row.cohortGroup?.trim() ?? "-";
  const groupClassName = getGroupClassName(groupLabel);

  return (
    <tr
      className={`lb-row lb-row-${statusTone(statusLabel)}`}
      role="button"
      tabIndex={0}
      onClick={onInspectRow}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onInspectRow();
        }
      }}
    >
      <td className="lb-col-rank">{row.rank}</td>
      <td className="lb-col-uid">{row.uid}</td>
      <td className="lb-col-group">
        <span
          className={`lb-pill lb-pill-neutral lb-group-pill${groupClassName ? ` ${groupClassName}` : ""}`}
        >
          {groupLabel}
        </span>
      </td>
      <td className="lb-col-model">
        <div className="lb-model-copy" title={`${row.hotkey} ${repoRevisionLabel}`}>
          <CopyHotkeyButton value={row.hotkey} className="lb-copy-button" start={8} end={6} />
          {repoRevisionUrl ? (
            <a
              className="lb-model-repo"
              href={repoRevisionUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {shortText(row.repo, 28, 0)}
            </a>
          ) : (
            <span className="lb-model-repo">{shortText(row.repo, 28, 0)}</span>
          )}
        </div>
      </td>
      <td className={`lb-col-num${row.incentive !== null && row.incentive > 0 ? " lb-col-num-positive" : ""}`}>
        {formatMetricNumber(row.incentive, 4)}
      </td>
      <td className="lb-col-trend">
        <TrendSparkline values={row.lossTrend} />
      </td>
      <td className="lb-col-commit">
        <span className={`lb-pill lb-pill-${getCommitTone(commitLabel)}`}>{commitLabel}</span>
      </td>
      <td className="lb-col-validator-metrics">
        <ValidatorMetricSummary metrics={row.validatorMetrics} />
      </td>
      <td className="lb-col-status">
        <span className={`lb-pill lb-pill-${statusTone(statusLabel)}`}>{statusLabel}</span>
      </td>
    </tr>
  );
}

function TrendSparkline({ values }: { values: Array<number | null> }) {
  const samples = values.slice(-12);
  const valid = samples.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));

  if (!valid.length) {
    return <span className="lb-sparkline-empty">-</span>;
  }

  const width = 120;
  const height = 24;
  const paddingX = 4;
  const paddingY = 4;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const step = samples.length > 1 ? innerWidth / (samples.length - 1) : 0;
  const segments = buildSparklineSegments(samples, step, min, range, paddingX, paddingY, innerHeight);
  const latestValue = [...samples].reverse().find((value): value is number => value !== null && value !== undefined && Number.isFinite(value));

  return (
    <div className="lb-sparkline" aria-label={`Loss trend mini graph${latestValue === undefined ? "" : `, latest ${formatMetricNumber(latestValue, 4)}`}`}>
      <svg className="lb-sparkline-svg" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {segments.map((segment, segmentIndex) => {
          const path = buildSparklinePath(segment);

          return (
            <g key={`sparkline-segment-${segmentIndex}`}>
              {segment.length > 1 ? (
                <path
                  className="lb-sparkline-area"
                  d={`${path} L ${segment[segment.length - 1].x} ${height - paddingY} L ${segment[0].x} ${height - paddingY} Z`}
                />
              ) : null}
              <path className="lb-sparkline-line" d={path} />
              {segment.map((point, pointIndex) => (
                <circle
                  key={`sparkline-point-${segmentIndex}-${pointIndex}`}
                  className="lb-sparkline-dot"
                  cx={point.x}
                  cy={point.y}
                  r={1.8}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type SparklinePoint = {
  x: number;
  y: number;
  value: number;
};

function buildSparklineSegments(
  values: Array<number | null>,
  step: number,
  min: number,
  range: number,
  paddingX: number,
  paddingY: number,
  innerHeight: number
) {
  const segments: SparklinePoint[][] = [];
  let currentSegment: SparklinePoint[] = [];

  values.forEach((value, index) => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      if (currentSegment.length) {
        segments.push(currentSegment);
        currentSegment = [];
      }
      return;
    }

    currentSegment.push({
      x: paddingX + index * step,
      y: paddingY + (1 - ((value - min) / range)) * innerHeight,
      value
    });
  });

  if (currentSegment.length) {
    segments.push(currentSegment);
  }

  return segments;
}

function buildSparklinePath(points: SparklinePoint[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function ValidatorMetricSummary({ metrics }: { metrics: ValidatorMetric[] }) {
  const slotMetrics = VALIDATOR_COLUMNS.map((index) => getValidatorMetricForColumn(metrics, index));

  return (
    <div className="lb-validator-metrics" aria-label="Validator metrics">
      {slotMetrics.map((metric, index) => {
        const lossLabel = formatMetricNumber(metric?.valLoss, 4);
        const weightLabel = formatMetricNumber(metric?.weightSubmitted, 4);
        const rankLabel = metric && metric.rank !== null ? `#${formatInteger(metric.rank)}` : "-";
        const rankDetail = formatValidatorRank(metric);
        const lossValid = hasMetricValue(metric?.valLoss);
        const weightValid = hasMetricValue(metric?.weightSubmitted);
        const rankValid = metric?.rank !== null && metric?.rank !== undefined;
        const hasData = Boolean(metric && (hasMetricValue(metric.valLoss) || hasMetricValue(metric.weightSubmitted) || metric.rank !== null));
        const title = metric
          ? `${metric.label}: loss ${lossLabel}, weight ${weightLabel}, rank ${rankDetail}`
          : `Validator ${index + 1}: no data`;

        return (
          <div key={`validator-metric-${index}`} className={`lb-validator-metric${hasData ? "" : " lb-validator-metric-empty"}`} title={title}>
            <span className="lb-validator-metric-item">
              <em className="lb-validator-metric-key">L</em>
              <strong className={`lb-validator-metric-value${lossValid ? " lb-validator-metric-value-loss" : ""}`}>{lossLabel}</strong>
            </span>
            <span className="lb-validator-metric-item">
              <em className="lb-validator-metric-key">W</em>
              <strong className={`lb-validator-metric-value${weightValid ? " lb-validator-metric-value-weight" : ""}`}>{weightLabel}</strong>
            </span>
            <span className="lb-validator-metric-item">
              <em className="lb-validator-metric-key">R</em>
              <strong className={`lb-validator-metric-value${rankValid ? " lb-validator-metric-value-rank" : ""}`}>{rankLabel}</strong>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function parsePageSizeOption(value: string): PageSizeOption {
  if (value === "all") {
    return "all";
  }

  const numericValue = Number(value);
  return PAGE_SIZE_OPTIONS.includes(numericValue as PageSizeOption) ? numericValue as PageSizeOption : 25;
}

function hasMetricValue(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function getRowStatusLabel(row: MinerRow) {
  if (row.uid === "0") {
    return "Burn";
  }

  if (row.weight === null || row.weight === 0) {
    return "No Weight";
  }

  if (row.evaluatedThisRound === false) {
    return "Pending";
  }

  return "OK";
}

function getCommitLabel(row: MinerRow) {
  if (row.committedRecently || row.committedThisCycle) {
    return "Fresh";
  }

  if (row.lastObservedCommitBlockLag !== null) {
    return "Lag";
  }

  return "Pending";
}

function getCommitTone(label: string) {
  if (label === "Fresh") {
    return "green";
  }

  if (label === "Lag") {
    return "violet";
  }

  return "amber";
}

function getGroupClassName(group: string) {
  const normalized = group.trim().toUpperCase();

  if (!normalized || normalized === "-") {
    return "";
  }

  if (normalized === "A") {
    return "lb-group-pill-a";
  }

  if (normalized === "B") {
    return "lb-group-pill-b";
  }

  if (normalized === "C") {
    return "lb-group-pill-c";
  }

  if (normalized === "D") {
    return "lb-group-pill-d";
  }

  if (normalized === "E") {
    return "lb-group-pill-e";
  }

  return "lb-group-pill-generic";
}

function getValidatorMetricForColumn(metrics: ValidatorMetric[], index: number) {
  const hasSlots = metrics.some((metric) => metric.slot !== null);
  return hasSlots ? metrics.find((metric) => metric.slot === index + 1) ?? null : metrics[index] ?? null;
}

function formatValidatorRank(metric: ValidatorMetric | null) {
  if (!metric || metric.rank === null) {
    return "-";
  }

  return metric.rankTotal === null
    ? `#${formatInteger(metric.rank)}`
    : `#${formatInteger(metric.rank)} / ${formatInteger(metric.rankTotal)}`;
}
