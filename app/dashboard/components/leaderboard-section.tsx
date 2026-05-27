import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Maximize2, Minimize2, Moon, Search, ShieldCheck, Sun, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { LEADERBOARD_COLUMN_COUNT, VALIDATOR_COLUMNS } from "../constants";
import { formatBlockDuration, formatInteger, formatMetricNumber, formatNumber, formatPercent, formatRepoRevision, getHotkeyUrl, getHuggingFaceRepoUrl, getHuggingFaceRevisionUrl, shortText } from "../format";
import { getMinerKey } from "../model";
import type { DashboardModel, MinerRow, Theme, ValidatorHealth, ValidatorMetric } from "../types";
import { SectionTitle } from "./section-title";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const NO_CHAIN_COMMIT_STATUS = "no_chain_commit";
const OK_STATUS = "ok";
const EMPTY_METRIC_VALUE = "-";

type LeaderboardSectionProps = {
  filteredRows: MinerRow[];
  query: string;
  selectedMinerKey: string | null;
  topMiner: MinerRow | undefined;
  burnPercent: number | null;
  phase: DashboardModel["phase"];
  theme: Theme;
  meta: DashboardModel["meta"];
  onQueryChange: (value: string) => void;
  onThemeToggle: () => void;
  onToggleMinerDetails: (row: MinerRow) => void;
};

export function LeaderboardSection({
  filteredRows,
  query,
  selectedMinerKey,
  topMiner,
  burnPercent,
  phase,
  theme,
  meta,
  onQueryChange,
  onThemeToggle,
  onToggleMinerDetails
}: LeaderboardSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [fullscreen, setFullscreen] = useState(false);
  const totalRows = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pageRows = useMemo(() => filteredRows.slice(pageStart, pageStart + pageSize), [filteredRows, pageSize, pageStart]);
  const visibleStart = totalRows ? pageStart + 1 : 0;
  const visibleEnd = Math.min(pageStart + pageSize, totalRows);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  useEffect(() => {
    if (!fullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullscreen]);

  return (
    <section className={`leaderboard-section${fullscreen ? " leaderboard-section-fullscreen" : ""}`}>
      <div className="leaderboard-header">
        <SectionTitle eyebrow="Leaderboard" title="Top Miners" />
        <FullscreenPhaseBar phase={phase} />
        <div className="leaderboard-actions">
          <label className="search-field">
            <Search size={15} />
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search UID, hotkey, repo" />
            {query ? (
              <button type="button" onClick={() => onQueryChange("")} title="Clear search">
                <X size={14} />
              </button>
            ) : null}
          </label>
          {fullscreen ? (
            <button
              type="button"
              className="table-icon-button leaderboard-theme-toggle"
              onClick={onThemeToggle}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          ) : null}
          <button
            type="button"
            className="table-icon-button"
            aria-label={fullscreen ? "Exit fullscreen leaderboard" : "Open fullscreen leaderboard"}
            aria-pressed={fullscreen}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen table"}
            onClick={() => setFullscreen((current) => !current)}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <LeaderboardSummaryStrip topMiner={topMiner} burnPercent={burnPercent} meta={meta} />

      <div className="table-frame">
        <table>
          <thead>
            <tr>
              <th className="rank-column"><span>Rank</span></th>
              <th className="uid-column"><span>UID</span></th>
              <th className="miner-column"><span>Miner</span><small>Hotkey + repo</small></th>
              <th className="loss-column" title="Loss"><span>Loss</span></th>
              <th className="delta-loss-column" title="Delta"><span>Delta</span></th>
              <th className="score-column" title="Leaderboard score"><span>Score</span></th>
              <th className="weight-column" title="Chain weight"><span>Weight</span></th>
              <th className="assigned-column"><span>Accepted</span></th>
              <th className="validator-grid-column"><span>Validators</span><small>Loss / weight</small></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <LeaderboardRow
                key={getMinerKey(row)}
                row={row}
                validatorHealth={meta.validatorHealth}
                selected={selectedMinerKey === getMinerKey(row)}
                onToggleMinerDetails={onToggleMinerDetails}
              />
            ))}
            {!totalRows ? (
              <tr>
                <td colSpan={LEADERBOARD_COLUMN_COUNT}>No miners match the current search.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="table-footer" aria-label="Leaderboard pagination">
        <span>
          Showing {visibleStart}-{visibleEnd} of {totalRows}
        </span>
        <div className="pagination-controls">
          <label className="page-size-field">
            <span>Rows</span>
            <select aria-label="Rows per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="pagination-button"
            disabled={safeCurrentPage <= 1}
            aria-label="Previous leaderboard page"
            title="Previous page"
            onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <strong>{safeCurrentPage} / {pageCount}</strong>
          <button
            type="button"
            className="pagination-button"
            disabled={safeCurrentPage >= pageCount}
            aria-label="Next leaderboard page"
            title="Next page"
            onClick={() => setCurrentPage(Math.min(pageCount, safeCurrentPage + 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function FullscreenPhaseBar({ phase }: { phase: DashboardModel["phase"] }) {
  const progress = Math.max(0, Math.min(100, phase.progress));

  return (
    <div className="leaderboard-fullscreen-phase" aria-label={`Current phase ${phase.name}, ${formatNumber(progress, 1)} percent complete`}>
      <div className="leaderboard-fullscreen-phase-title">
        <span>Current Phase</span>
        <strong>{phase.name}</strong>
      </div>
      <div className="leaderboard-fullscreen-phase-progress" title={`${formatNumber(progress, 1)}%`}>
        <div className="leaderboard-fullscreen-phase-meta">
          <span>{formatNumber(progress, 1)}%</span>
          <small>{formatBlockDuration(phase.cycleBlock)} / {formatBlockDuration(phase.blocksRemaining)}</small>
        </div>
        <div className="leaderboard-fullscreen-progress-track">
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

type LeaderboardSummaryStripProps = {
  topMiner: MinerRow | undefined;
  burnPercent: number | null;
  meta: DashboardModel["meta"];
};

function LeaderboardSummaryStrip({ topMiner, burnPercent, meta }: LeaderboardSummaryStripProps) {
  const topMinerHotkeyUrl = topMiner ? getHotkeyUrl(topMiner.hotkey) : null;
  const topMinerRepoUrl = topMiner ? getHuggingFaceRepoUrl(topMiner.repo) : null;
  const liveValidators = meta.validatorHealth.length
    ? meta.validatorHealth.filter((validator) => getValidatorTone(validator) === "live").length
    : meta.polledValidatorCount ?? 0;
  const validatorTotal = meta.validatorCount ?? meta.validatorHealth.length;
  const validatorLabel = validatorTotal ? `${liveValidators}/${validatorTotal}` : "-";

  return (
    <div className="leaderboard-summary-strip">
      <div className="leaderboard-summary-card leaderboard-summary-primary">
        <BarChart3 size={17} />
        <div>
          <span>Top Chain Weight</span>
          <strong>{topMiner ? `${formatNumber(topMiner.weight, 6)}` : "-"}</strong>
        </div>
        <div className="summary-miner-target">
          <em>
            {topMiner && topMinerHotkeyUrl ? (
              <a className="table-link" href={topMinerHotkeyUrl} target="_blank" rel="noreferrer">
                UID {topMiner.uid}
              </a>
            ) : topMiner ? `UID ${topMiner.uid}` : "-"}
          </em>
          <small>
            {topMiner && topMinerRepoUrl ? (
              <a className="table-link" href={topMinerRepoUrl} target="_blank" rel="noreferrer">
                {shortText(topMiner.repo, 24, 0)}
              </a>
            ) : topMiner ? shortText(topMiner.repo, 24, 0) : "-"}
          </small>
        </div>
      </div>

      <div className="leaderboard-summary-card leaderboard-summary-compact">
        <span>Burn</span>
        <strong>{formatPercent(burnPercent, 2)}</strong>
      </div>

      <div className="leaderboard-summary-card validator-health-summary">
        <ShieldCheck size={17} />
        <div>
          <span>Validators</span>
          <strong>{validatorLabel} live</strong>
        </div>
        <div className="validator-health-chips" aria-label="Validator slot health">
          {VALIDATOR_COLUMNS.map((index) => {
            const health = getValidatorHealthForSlot(meta.validatorHealth, index);
            const tone = getValidatorTone(health);

            return (
              <span className={`validator-health-chip validator-health-${tone}`} key={`validator-health-${index}`} title={`Validator ${index + 1}: ${formatValidatorStatus(health?.status)}`}>
                V{index + 1}
              </span>
            );
          })}
        </div>
      </div>

      <div className={`leaderboard-summary-card source-summary${meta.stale ? " source-summary-stale" : ""}`}>
        {meta.stale ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
        <div>
          <span>{meta.servedFrom ?? "API"}</span>
          <strong>{meta.staleReason ? formatValidatorStatus(meta.staleReason) : "Current"}</strong>
        </div>
      </div>
    </div>
  );
}

type LeaderboardRowProps = {
  row: MinerRow;
  validatorHealth: ValidatorHealth[];
  selected: boolean;
  onToggleMinerDetails: (row: MinerRow) => void;
};

function LeaderboardRow({ row, validatorHealth, selected, onToggleMinerDetails }: LeaderboardRowProps) {
  const hotkeyUrl = getHotkeyUrl(row.hotkey);
  const repoRevisionUrl = getHuggingFaceRevisionUrl(row.repo, row.revision);
  const repoRevisionLabel = formatRepoRevision(row.repo, row.revision);
  const rowKey = getMinerKey(row);
  const detailsId = `miner-details-${row.rank}-${row.uid}`;
  const rowScore = renderAggregateScoreMetric(row, 4);
  const rowWeight = formatLeaderboardMetricNumber(row.weight, 4);
  const rowLoss = formatLeaderboardMetricNumber(row.loss, 4);
  const rowDeltaLoss = formatLeaderboardMetricNumber(row.deltaLoss, 4);

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input")) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggleMinerDetails(row);
    }
  };

  return (
    <Fragment>
      <tr
        className={`leaderboard-row${selected ? " leaderboard-row-selected" : ""}`}
        tabIndex={0}
        aria-expanded={selected}
        aria-controls={detailsId}
        title={selected ? "Collapse validator details" : "Open validator details"}
        onClick={() => onToggleMinerDetails(row)}
        onKeyDown={handleKeyDown}
      >
        <td className="rank-column" data-label="Rank">
          <div className="rank-cell">
            <button
              type="button"
              className="row-toggle-button"
              aria-label={`${selected ? "Collapse" : "Open"} validator details for UID ${row.uid}`}
              aria-expanded={selected}
              aria-controls={detailsId}
              title={selected ? "Collapse details" : "Open details"}
              onClick={(event) => {
                event.stopPropagation();
                onToggleMinerDetails(row);
              }}
            >
              <ChevronRight size={14} />
            </button>
            <span>{row.rank}</span>
          </div>
        </td>
        <td className="uid-column" data-label="UID">{row.uid}</td>
        <td className="miner-column" data-label="Miner" title={`${row.hotkey} ${repoRevisionLabel}`}>
          <div className="miner-cell">
            <strong>
              {hotkeyUrl ? (
                <a className="table-link" href={hotkeyUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                  {shortText(row.hotkey, 8, 6)}
                </a>
              ) : shortText(row.hotkey, 8, 6)}
            </strong>
            <span>
              {repoRevisionUrl ? (
                <a className="table-link" href={repoRevisionUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                  {shortText(repoRevisionLabel, 30, 0)}
                </a>
              ) : shortText(repoRevisionLabel, 30, 0)}
            </span>
          </div>
        </td>
        <td className="loss-column" data-label="Loss">{rowLoss}</td>
        <td className="delta-loss-column" data-label="Delta">{rowDeltaLoss}</td>
        <td className="score-column" data-label="Score">{rowScore}</td>
        <td className="weight-column" data-label="Weight">{rowWeight}</td>
        <td className="assigned-column" data-label="Accepted">
          <span className={`assignment-pill assignment-${row.assigned === null ? "unknown" : row.assigned ? "yes" : "no"}`}>
            {row.assigned === null ? "-" : row.assigned ? "Yes" : "No"}
          </span>
        </td>
        <td className="validator-grid-column" data-label="Validators">
          <div className="validator-mini-grid" aria-label={`Validator metrics for UID ${row.uid}`}>
            {VALIDATOR_COLUMNS.map((index) => {
              const metric = getValidatorMetricForColumn(row, index);
              const health = getValidatorHealthForSlot(validatorHealth, index);
              const tone = getValidatorTone(health, metric);
              const metricClassName = getMetricClassName(metric?.evalStatusLabel);
              const isNoCommit = isNoChainCommitStatus(metric?.evalStatusLabel);
              const valLoss = renderMetricByEvalStatus(metric?.valLoss, metric?.evalStatusLabel, 4);
              const weight = renderMetricByEvalStatus(metric?.weightSubmitted, metric?.evalStatusLabel, 4);
              const valLossTitle = formatMetricByEvalStatus(metric?.valLoss, metric?.evalStatusLabel, 4);
              const weightTitle = formatMetricByEvalStatus(metric?.weightSubmitted, metric?.evalStatusLabel, 4);

              return (
                <span
                  className={`validator-mini-card validator-mini-${tone}${isNoCommit ? " validator-mini-status-only" : ""}`}
                  key={`${rowKey}-validator-${index}`}
                  title={metric ? isNoCommit ? `${metric.label}: ${formatShortEvalStatus(metric.evalStatusLabel)}` : `${metric.label}: loss ${valLossTitle}, weight ${weightTitle}` : `Validator ${index + 1}: ${formatValidatorStatus(health?.status)}`}
                >
                  <em>V{index + 1}</em>
                  {isNoCommit ? (
                    <strong className={`validator-mini-status ${metricClassName ?? ""}`}>
                      <MetricStatusMarker status={metric?.evalStatusLabel} />
                    </strong>
                  ) : (
                    <>
                      <strong className={metricClassName}><span>L</span>{valLoss}</strong>
                      <small className={metricClassName}><span>W</span>{weight}</small>
                    </>
                  )}
                </span>
              );
            })}
          </div>
        </td>
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
}

function getValidatorMetricForColumn(row: MinerRow, index: number) {
  const hasSlots = row.validatorMetrics.some((metric) => metric.slot !== null);
  return hasSlots ? row.validatorMetrics.find((metric) => metric.slot === index + 1) : row.validatorMetrics[index];
}

function getValidatorHealthForSlot(validatorHealth: ValidatorHealth[], index: number) {
  return validatorHealth.find((validator) => validator.slot === index + 1);
}

function getValidatorTone(health: ValidatorHealth | undefined, metric?: ValidatorMetric) {
  const status = health?.status?.toLowerCase() ?? null;

  if (status === "live" && health?.chainActive !== false && health?.promReachable !== false) {
    return metric && metric.valLoss === null && metric.weightSubmitted === null ? "partial" : "live";
  }

  if (status === "down" || health?.chainActive === false || health?.promReachable === false) {
    return "down";
  }

  return metric ? "partial" : "missing";
}

function formatValidatorStatus(status: string | null | undefined) {
  return status ? status.replace(/_/g, " ") : "missing";
}

function formatEvalStatus(status: string | null | undefined) {
  if (!status) {
    return "-";
  }

  return status
    .replace(/^no_chain_commit$/, "no-commit")
    .replace(/_/g, " ");
}

function isNoChainCommitStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() === NO_CHAIN_COMMIT_STATUS;
}

function isOkStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() === OK_STATUS;
}

function getMetricClassName(status: string | null | undefined) {
  if (isOkStatus(status)) {
    return "ok-eval-metric";
  }

  if (shouldDisplayEvalStatusAsMetric(status)) {
    return "no-chain-commit-metric";
  }

  return undefined;
}

function formatShortEvalStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();

  if (!normalized) {
    return "-";
  }

  if (isNoChainCommitStatus(normalized)) {
    return "no-commit";
  }

  return shortText(normalized.replace(/^eval_/, "").replace(/^validation_/, "").replace(/_/g, "-"), 14, 0);
}

function shouldDisplayEvalStatusAsMetric(status: string | null | undefined) {
  return Boolean(status?.trim()) && !isOkStatus(status);
}

function hasMetricValue(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function formatLeaderboardMetricNumber(value: number | null | undefined, digits: number) {
  return hasMetricValue(value) ? formatMetricNumber(value, digits) : EMPTY_METRIC_VALUE;
}

function formatMissingMetricStatus(status: string | null | undefined) {
  const label = formatShortEvalStatus(status);
  return label === "-" ? "missing" : `missing (${label})`;
}

function formatMetricByEvalStatus(value: number | null | undefined, status: string | null | undefined, digits: number) {
  if (shouldDisplayEvalStatusAsMetric(status)) {
    return formatShortEvalStatus(status);
  }

  return hasMetricValue(value) ? formatLeaderboardMetricNumber(value, digits) : formatMissingMetricStatus(status);
}

function renderMetricByEvalStatus(value: number | null | undefined, status: string | null | undefined, digits: number): ReactNode {
  return shouldDisplayEvalStatusAsMetric(status) || !hasMetricValue(value) ? <MetricStatusMarker status={status} /> : formatLeaderboardMetricNumber(value, digits);
}

function renderAggregateScoreMetric(row: MinerRow, digits: number): ReactNode {
  return hasMetricValue(row.score) ? formatLeaderboardMetricNumber(row.score, digits) : <MetricStatusMarker status={getRowEvalMetricStatus(row)} />;
}

function getRowEvalMetricStatus(row: MinerRow) {
  const statuses = row.validatorMetrics.map((metric) => metric.evalStatusLabel?.trim().toLowerCase()).filter(Boolean);

  if (!statuses.length) {
    return null;
  }

  const firstStatus = statuses[0];
  return statuses.every((status) => status === firstStatus) ? firstStatus : "mixed";
}

function MetricStatusMarker({ status }: { status: string | null | undefined }) {
  const label = formatShortEvalStatus(status);

  return (
    <span
      className="metric-status-marker"
      role="img"
      aria-label={`Eval status: ${label === "-" ? "missing" : label}`}
      title={label === "-" ? "missing" : label}
    >
      {EMPTY_METRIC_VALUE}
    </span>
  );
}

function getValidatorStatusClassName(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "live") {
    return "detail-status-live";
  }

  if (normalized === "down") {
    return "detail-status-down";
  }

  return normalized ? "detail-status-partial" : "detail-status-missing";
}

function getEvalBadgeClassName(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();

  if (normalized === OK_STATUS) {
    return "detail-eval-ok";
  }

  if (isNoChainCommitStatus(normalized)) {
    return "detail-eval-warning";
  }

  return normalized ? "detail-eval-warning" : "detail-eval-missing";
}

function MinerValidatorDetails({ row }: { row: MinerRow }) {
  const hotkeyUrl = getHotkeyUrl(row.hotkey);
  const repoUrl = getHuggingFaceRepoUrl(row.repo);
  const repoRevisionUrl = getHuggingFaceRevisionUrl(row.repo, row.revision);
  const repoRevisionLabel = formatRepoRevision(row.repo, row.revision);
  const assignmentTone = row.assigned === null ? "unknown" : row.assigned ? "yes" : "no";
  const assignmentLabel = row.assigned === null ? "-" : row.assigned ? "Yes" : "No";

  return (
    <div className="miner-details">
      <div className="miner-detail-header">
        <div className="miner-detail-title">
          <span>Miner UID {row.uid}</span>
          <strong title={repoRevisionLabel}>
            {repoRevisionUrl ? (
              <a className="table-link" href={repoRevisionUrl} target="_blank" rel="noreferrer">
                {shortText(repoRevisionLabel, 42, 0)}
              </a>
            ) : shortText(repoRevisionLabel, 42, 0)}
          </strong>
        </div>
        <div className="miner-detail-actions">
          <span className={`assignment-pill assignment-${assignmentTone}`}>Accepted {assignmentLabel}</span>
          {hotkeyUrl ? (
            <a className="detail-link" href={hotkeyUrl} target="_blank" rel="noreferrer">
              Hotkey
            </a>
          ) : null}
          {repoUrl ? (
            <a className="detail-link" href={repoUrl} target="_blank" rel="noreferrer">
              Repository
            </a>
          ) : null}
        </div>
      </div>

      <div className="miner-summary-grid">
        <div className="miner-summary-item miner-summary-important miner-summary-priority">
          <span>Loss</span>
          <strong title={row.loss === null ? undefined : String(row.loss)}>
            {formatLeaderboardMetricNumber(row.loss, 6)}
          </strong>
        </div>
        <div className="miner-summary-item miner-summary-important miner-summary-priority">
          <span>Delta</span>
          <strong>{formatLeaderboardMetricNumber(row.deltaLoss, 6)}</strong>
        </div>
        <div className="miner-summary-item miner-summary-important miner-summary-priority">
          <span>Score</span>
          <strong>{renderAggregateScoreMetric(row, 6)}</strong>
        </div>
        <div className="miner-summary-item miner-summary-important miner-summary-priority">
          <span>Weight</span>
          <strong title={row.weight === null ? undefined : String(row.weight)}>
            {formatLeaderboardMetricNumber(row.weight, 4)}
          </strong>
        </div>
      </div>

      <div className="validator-detail-frame">
        <div className="validator-detail-scroll">
          <table className="validator-detail-table" aria-label={`Validator metrics for UID ${row.uid}`}>
            <thead>
              <tr>
                <th>Validator</th>
                <th>Loss</th>
                <th>Score</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Chain UID</th>
                <th>Eval</th>
              </tr>
            </thead>
            <tbody>
              {row.validatorMetrics.length ? (
                row.validatorMetrics.map((metric, index) => {
                  const validatorHotkeyUrl = getHotkeyUrl(metric.hotkey);

                  return (
                    <tr key={`${metric.label}-${metric.uid ?? "uid"}-${metric.slot ?? "slot"}-${index}`}>
                      <td>
                        <div className="validator-identity">
                          <strong>{metric.label}</strong>
                          {validatorHotkeyUrl ? (
                            <a className="table-link" href={validatorHotkeyUrl} target="_blank" rel="noreferrer" title={metric.hotkey}>
                              {shortText(metric.hotkey, 8, 6)}
                            </a>
                          ) : (
                            <span title={metric.hotkey}>{shortText(metric.hotkey, 8, 6)}</span>
                          )}
                        </div>
                      </td>
                      <td className={getMetricClassName(metric.evalStatusLabel)} title={shouldDisplayEvalStatusAsMetric(metric.evalStatusLabel) ? formatShortEvalStatus(metric.evalStatusLabel) : metric.valLoss === null ? undefined : String(metric.valLoss)}>{renderMetricByEvalStatus(metric.valLoss, metric.evalStatusLabel, 6)}</td>
                      <td className={getMetricClassName(metric.evalStatusLabel)} title={formatMetricByEvalStatus(metric.score, metric.evalStatusLabel, 6)}>{renderMetricByEvalStatus(metric.score, metric.evalStatusLabel, 6)}</td>
                      <td className={getMetricClassName(metric.evalStatusLabel)} title={shouldDisplayEvalStatusAsMetric(metric.evalStatusLabel) ? formatShortEvalStatus(metric.evalStatusLabel) : metric.weightSubmitted === null ? undefined : String(metric.weightSubmitted)}>{renderMetricByEvalStatus(metric.weightSubmitted, metric.evalStatusLabel, 4)}</td>
                      <td>
                        <span className={`detail-status-badge ${getValidatorStatusClassName(metric.validatorStatus)}`}>
                          {formatValidatorStatus(metric.validatorStatus)}
                        </span>
                      </td>
                      <td>{formatInteger(metric.chainUid)}</td>
                      <td title={metric.failureReasons.length ? metric.failureReasons.join(", ") : undefined}>
                        <span className={`detail-eval-badge ${getEvalBadgeClassName(metric.evalStatusLabel)}`}>
                          {formatEvalStatus(metric.evalStatusLabel)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>No validator metrics reported for this miner.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
