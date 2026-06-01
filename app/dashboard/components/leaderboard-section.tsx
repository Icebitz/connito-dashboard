import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Eye, EyeOff, Maximize2, Minimize2, Moon, Search, ShieldCheck, Sun, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { LEADERBOARD_COLUMN_COUNT, LEADERBOARD_VIEW_UIDS_STORAGE_KEY, VALIDATOR_COLUMNS } from "../constants";
import { formatBlock, formatBlockDuration, formatInteger, formatMetricNumber, formatNumber, formatPercent, formatRepoRevision, getHotkeyUrl, getHuggingFaceRepoUrl, getHuggingFaceRevisionUrl, shortText } from "../format";
import { getMinerKey } from "../model";
import type { DashboardModel, MinerRow, Theme, ValidatorHealth, ValidatorMetric } from "../types";
import { SectionTitle } from "./section-title";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const NO_CHAIN_COMMIT_STATUS = "no_chain_commit";
const OK_STATUS = "ok";
const EMPTY_METRIC_VALUE = "-";

type LeaderboardSortKey = "rank" | "group" | "loss" | "score" | "weight";
type LeaderboardSortDirection = "asc" | "desc";
type LeaderboardSort = {
  key: LeaderboardSortKey;
  direction: LeaderboardSortDirection;
};

function normalizeStoredUids(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((uid) => String(uid).trim()).filter(Boolean)));
}

type LeaderboardSectionProps = {
  allRows: MinerRow[];
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

function getDefaultSortDirection(key: LeaderboardSortKey): LeaderboardSortDirection {
  return key === "loss" || key === "rank" || key === "group" ? "asc" : "desc";
}

function getGroupSortRank(group: string | null) {
  const normalized = group?.trim().toUpperCase();

  if (normalized === "A") {
    return 0;
  }

  if (normalized === "B") {
    return 1;
  }

  if (normalized === "C") {
    return 2;
  }

  return 3;
}

function compareNullableNumbers(a: number | null, b: number | null, direction: LeaderboardSortDirection) {
  if (a === null && b === null) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  return direction === "asc" ? a - b : b - a;
}

function compareGroups(a: MinerRow, b: MinerRow, direction: LeaderboardSortDirection) {
  const aRank = getGroupSortRank(a.cohortGroup);
  const bRank = getGroupSortRank(b.cohortGroup);
  const missingGroupRank = 3;

  if (aRank === missingGroupRank && bRank !== missingGroupRank) {
    return 1;
  }

  if (bRank === missingGroupRank && aRank !== missingGroupRank) {
    return -1;
  }

  if (aRank !== bRank) {
    return direction === "asc" ? aRank - bRank : bRank - aRank;
  }

  return (a.cohortGroup ?? "").localeCompare(b.cohortGroup ?? "");
}

function compareRowsBySort(a: MinerRow, b: MinerRow, sort: LeaderboardSort) {
  if (sort.key === "rank") {
    return compareNullableNumbers(a.rank, b.rank, sort.direction);
  }

  if (sort.key === "group") {
    return compareGroups(a, b, sort.direction);
  }

  if (sort.key === "loss") {
    return compareNullableNumbers(a.loss, b.loss, sort.direction);
  }

  if (sort.key === "score") {
    return compareNullableNumbers(a.score, b.score, sort.direction);
  }

  return compareNullableNumbers(a.weight, b.weight, sort.direction);
}

function sortLeaderboardRows(rows: MinerRow[], sort: LeaderboardSort) {
  return [...rows].sort((a, b) => {
    const sortDelta = compareRowsBySort(a, b, sort);
    return sortDelta === 0 ? a.rank - b.rank : sortDelta;
  });
}

type SortableLeaderboardHeaderProps = {
  className: string;
  label: string;
  sortKey: LeaderboardSortKey;
  sort: LeaderboardSort;
  title?: string;
  onSort: (key: LeaderboardSortKey) => void;
};

function SortableLeaderboardHeader({ className, label, sortKey, sort, title, onSort }: SortableLeaderboardHeaderProps) {
  const active = sort.key === sortKey;
  const ariaSort = active ? sort.direction === "asc" ? "ascending" : "descending" : "none";

  return (
    <th className={className} title={title} aria-sort={ariaSort}>
      <button
        type="button"
        className={`sort-header-button${active ? " sort-header-button-active" : ""}`}
        aria-label={`Sort by ${label} ${active && sort.direction === "asc" ? "descending" : "ascending"}`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <i aria-hidden="true" data-direction={active ? sort.direction : "none"} />
      </button>
    </th>
  );
}

export function LeaderboardSection({
  allRows,
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
  const [viewListUids, setViewListUids] = useState<string[]>([]);
  const [viewListHydrated, setViewListHydrated] = useState(false);
  const [showViewListOnly, setShowViewListOnly] = useState(false);
  const [sort, setSort] = useState<LeaderboardSort>({ key: "rank", direction: "asc" });
  const viewListItems = useMemo(() => {
    const rowsByUid = new Map(allRows.map((row) => [row.uid, row]));
    return viewListUids.map((uid) => ({ uid, row: rowsByUid.get(uid) }));
  }, [allRows, viewListUids]);
  const viewListUidSet = useMemo(() => new Set(viewListUids), [viewListUids]);
  const displayedRows = useMemo(
    () => showViewListOnly ? filteredRows.filter((row) => viewListUidSet.has(row.uid)) : filteredRows,
    [filteredRows, showViewListOnly, viewListUidSet]
  );
  const sortedRows = useMemo(() => sortLeaderboardRows(displayedRows, sort), [displayedRows, sort]);
  const totalRows = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pageRows = useMemo(() => sortedRows.slice(pageStart, pageStart + pageSize), [sortedRows, pageSize, pageStart]);
  const visibleStart = totalRows ? pageStart + 1 : 0;
  const visibleEnd = Math.min(pageStart + pageSize, totalRows);
  const emptyLeaderboardMessage = showViewListOnly ? "No selected miners match the current search." : "No miners match the current search.";

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize, showViewListOnly, sort]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LEADERBOARD_VIEW_UIDS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      setViewListUids(normalizeStoredUids(parsed));
    } catch {
      setViewListUids([]);
    } finally {
      setViewListHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!viewListHydrated) {
      return;
    }

    try {
      window.localStorage.setItem(LEADERBOARD_VIEW_UIDS_STORAGE_KEY, JSON.stringify(viewListUids));
    } catch {
      // Persisting the view list is best-effort; the in-memory selection still works.
    }
  }, [viewListHydrated, viewListUids]);

  useEffect(() => {
    if (!viewListUids.length) {
      setShowViewListOnly(false);
    }
  }, [viewListUids.length]);

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

  const toggleViewListMiner = (row: MinerRow) => {
    setViewListUids((uids) => uids.includes(row.uid) ? uids.filter((uid) => uid !== row.uid) : [...uids, row.uid]);
  };

  const removeViewListMiner = (uid: string) => {
    setViewListUids((uids) => uids.filter((selectedUid) => selectedUid !== uid));
  };

  const updateSort = (key: LeaderboardSortKey) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: getDefaultSortDirection(key) });
  };

  return (
    <section className={`leaderboard-section${fullscreen ? " leaderboard-section-fullscreen" : ""}`}>
      <div className="leaderboard-header">
        <SectionTitle eyebrow="Leaderboard" title="Top Miners" />
        <FullscreenPhaseBar phase={phase} />
        <div className="leaderboard-actions">
          <div className="leaderboard-search-stack">
            <div className="leaderboard-search-toolbar">
              <div className="search-field search-token-field">
                <Search size={15} />
                <SelectedUidTokens items={viewListItems} onRemove={removeViewListMiner} />
                <input
                  aria-label="Search miners by UID, hotkey, or repo"
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder={viewListUids.length ? "Search" : "Search UID, hotkey, repo"}
                />
                {query ? (
                  <button type="button" onClick={() => onQueryChange("")} title="Clear search">
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className={`view-list-filter-button${showViewListOnly ? " view-list-filter-button-active" : ""}`}
                aria-label={showViewListOnly ? "Show all miners" : "Show only selected miners"}
                aria-pressed={showViewListOnly}
                disabled={!viewListUids.length}
                title={showViewListOnly ? "Show all miners" : "Show only selected miners"}
                onClick={() => setShowViewListOnly((current) => !current)}
              >
                {showViewListOnly ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
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
              <SortableLeaderboardHeader className="rank-column" label="Rank" sortKey="rank" sort={sort} onSort={updateSort} />
              <th className="uid-column"><span>UID</span></th>
              <SortableLeaderboardHeader className="cohort-column" label="Group" sortKey="group" sort={sort} onSort={updateSort} />
              <th className="miner-column"><span>Miner</span><small>Hotkey + repo</small></th>
              <SortableLeaderboardHeader className="loss-column" label="Loss" sortKey="loss" sort={sort} onSort={updateSort} />
              <th className="delta-loss-column" title="Delta"><span>Delta</span></th>
              <SortableLeaderboardHeader className="score-column" label="Score" sortKey="score" sort={sort} onSort={updateSort} title="Leaderboard score" />
              <SortableLeaderboardHeader className="weight-column" label="Weight" sortKey="weight" sort={sort} onSort={updateSort} title="Chain weight" />
              <th className="assigned-column"><span>Accepted</span></th>
              <th className="validator-grid-column"><span>Validators</span><small>Rank / loss / weight / eval</small></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <LeaderboardRow
                key={getMinerKey(row)}
                row={row}
                validatorHealth={meta.validatorHealth}
                selected={selectedMinerKey === getMinerKey(row)}
                monitored={viewListUidSet.has(row.uid)}
                onToggleViewList={toggleViewListMiner}
                onToggleMinerDetails={onToggleMinerDetails}
              />
            ))}
            {!totalRows ? (
              <tr>
                <td colSpan={LEADERBOARD_COLUMN_COUNT}>{emptyLeaderboardMessage}</td>
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

type SelectedUidTokenItem = {
  uid: string;
  row: MinerRow | undefined;
};

type SelectedUidTokensProps = {
  items: SelectedUidTokenItem[];
  onRemove: (uid: string) => void;
};

function SelectedUidTokens({ items, onRemove }: SelectedUidTokensProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="selected-uid-token-list" aria-label="Selected miner UIDs">
      {items.map(({ uid, row }) => (
        <span className="miner-view-chip" key={uid} title={row ? `${row.hotkey} ${formatRepoRevision(row.repo, row.revision)}` : `UID ${uid}`}>
          UID {uid}
          <button
            type="button"
            aria-label={`Remove UID ${uid} from view list`}
            title={`Remove UID ${uid}`}
            onClick={() => onRemove(uid)}
          >
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
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
      <div className="leaderboard-fullscreen-phase-progress" title={`${formatNumber(progress, 1)}% complete, ${formatBlockDuration(phase.blocksRemaining)} remaining`}>
        <div className="leaderboard-fullscreen-phase-meta">
          <span>{formatNumber(progress, 1)}%</span>
          <small>{formatBlockDuration(phase.blocksRemaining)} remaining</small>
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
  monitored: boolean;
  onToggleViewList: (row: MinerRow) => void;
  onToggleMinerDetails: (row: MinerRow) => void;
};

function LeaderboardRow({ row, validatorHealth, selected, monitored, onToggleViewList, onToggleMinerDetails }: LeaderboardRowProps) {
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
        className={`leaderboard-row${selected ? " leaderboard-row-selected" : ""}${monitored ? " leaderboard-row-monitored" : ""}`}
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
              className={`monitor-row-button${monitored ? " monitor-row-button-active" : ""}`}
              aria-label={`${monitored ? "Remove" : "Add"} UID ${row.uid} ${monitored ? "from" : "to"} view list`}
              aria-pressed={monitored}
              title={`${monitored ? "Remove from" : "Add to"} view list`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleViewList(row);
              }}
            >
              {monitored ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
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
        <td className="cohort-column" data-label="Group">
          <CohortGroupBadge row={row} />
        </td>
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
                  {shortText(repoRevisionLabel, 20, 0)}
                </a>
              ) : shortText(repoRevisionLabel, 20, 0)}
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
              const rank = metric ? formatValidatorMiniRank(metric) : EMPTY_METRIC_VALUE;
              const valLoss = formatLeaderboardMetricNumber(metric?.valLoss, 4);
              const weight = formatLeaderboardMetricNumber(metric?.weightSubmitted, 4);
              const evalStatus = formatShortEvalStatus(metric?.evalStatusLabel);

              return (
                <span
                  className={`validator-mini-card validator-mini-${tone}`}
                  key={`${rowKey}-validator-${index}`}
                  title={metric
                    ? `${metric.label}: ${formatAssignmentRole(metric.assignmentRole)}, rank ${formatValidatorRank(metric)}, loss ${valLoss}, weight ${weight}, eval ${formatEvalStatus(metric.evalStatusLabel)}`
                    : `Validator ${index + 1}: ${formatValidatorStatus(health?.status)}`}
                >
                  <strong><span>R</span>{rank}</strong>
                  <strong><span>L</span>{valLoss}</strong>
                  <small><span>W</span>{weight}</small>
                  <small className={metricClassName}><span>E</span>{evalStatus}</small>
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

function getCohortTone(group: string | null | undefined) {
  const normalized = group?.trim().toLowerCase();

  if (normalized === "a" || normalized === "b" || normalized === "c") {
    return normalized;
  }

  return "none";
}

function formatCohortGroup(row: MinerRow) {
  return row.cohortGroup ?? "-";
}

function CohortGroupBadge({ row, prefix = "" }: { row: MinerRow; prefix?: string }) {
  const label = row.cohortGroup ?? (prefix ? "none" : formatCohortGroup(row));
  const title = row.cohortGroup
    ? `Cohort group ${row.cohortGroup}${row.cohortGroupCode === null ? "" : ` (code ${row.cohortGroupCode})`}`
    : "No cohort group";

  return (
    <span className={`cohort-pill cohort-${getCohortTone(row.cohortGroup)}`} title={title}>
      {prefix}{label}
    </span>
  );
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

function formatValidatorBlock(metric: ValidatorMetric) {
  return formatBlock(metric.extractedAtBlock);
}

function formatValidatorBlockTitle(metric: ValidatorMetric) {
  const block = formatValidatorBlock(metric);
  return block === "-" ? "No validator block reported" : `Validator data extracted at block ${block}`;
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

function formatAssignmentRole(role: string | null | undefined) {
  return role ? role.replace(/_/g, " ") : "-";
}

function getRoleBadgeClassName(role: string | null | undefined) {
  const normalized = role?.trim().toLowerCase();

  if (normalized === "foreground") {
    return "detail-role-foreground";
  }

  if (normalized === "background") {
    return "detail-role-background";
  }

  return normalized ? "detail-role-other" : "detail-role-missing";
}

function formatValidatorRank(metric: ValidatorMetric) {
  if (metric.rank === null) {
    return "-";
  }

  return metric.rankTotal === null ? formatInteger(metric.rank) : `${formatInteger(metric.rank)} / ${formatInteger(metric.rankTotal)}`;
}

function formatValidatorMiniRank(metric: ValidatorMetric) {
  if (metric.rank === null) {
    return EMPTY_METRIC_VALUE;
  }

  return metric.rankTotal === null ? formatInteger(metric.rank) : `${formatInteger(metric.rank)}/${formatInteger(metric.rankTotal)}`;
}

function getCommitTone(committedRecently: boolean | null | undefined) {
  if (committedRecently === true) {
    return "fresh";
  }

  if (committedRecently === false) {
    return "stale";
  }

  return "unknown";
}

function formatCommitFreshness(committedRecently: boolean | null | undefined) {
  if (committedRecently === true) {
    return "Fresh";
  }

  if (committedRecently === false) {
    return "Stale";
  }

  return "-";
}

function formatCommitLag(blocks: number | null | undefined) {
  const formatted = formatInteger(blocks);
  return formatted === "-" ? "-" : `${formatted} block${blocks === 1 ? "" : "s"}`;
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
          <CohortGroupBadge row={row} prefix="Group " />
          <span className={`commit-pill commit-${getCommitTone(row.committedRecently)}`}>
            Commit {formatCommitFreshness(row.committedRecently)}
          </span>
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
        <div className="miner-summary-item">
          <span>Last commit</span>
          <strong title={row.lastObservedCommitBlock === null ? undefined : String(row.lastObservedCommitBlock)}>
            {formatBlock(row.lastObservedCommitBlock)}
          </strong>
        </div>
        <div className="miner-summary-item">
          <span>Commit lag</span>
          <strong title={row.lastObservedCommitBlockLag === null ? undefined : String(row.lastObservedCommitBlockLag)}>
            {formatCommitLag(row.lastObservedCommitBlockLag)}
          </strong>
        </div>
        <div className="miner-summary-item">
          <span>Commit status</span>
          <strong>
            <span className={`commit-pill commit-${getCommitTone(row.committedRecently)}`}>
              {formatCommitFreshness(row.committedRecently)}
            </span>
          </strong>
        </div>
        <div className="miner-summary-item">
          <span>Group</span>
          <strong>
            <CohortGroupBadge row={row} />
          </strong>
        </div>
      </div>

      <div className="validator-detail-frame">
        <div className="validator-detail-scroll">
          <table className="validator-detail-table" aria-label={`Validator metrics for UID ${row.uid}`}>
            <thead>
              <tr>
                <th>Validator</th>
                <th>Role</th>
                <th>Rank</th>
                <th>Loss</th>
                <th>Score</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Chain UID</th>
                <th>Eval</th>
                <th>Commit</th>
                <th>Block</th>
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
                      <td>
                        <span className={`detail-role-badge ${getRoleBadgeClassName(metric.assignmentRole)}`}>
                          {formatAssignmentRole(metric.assignmentRole)}
                        </span>
                      </td>
                      <td title={metric.rank === null ? undefined : `${formatValidatorRank(metric)} in validator ${metric.label}`}>
                        {formatValidatorRank(metric)}
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
                      <td title={metric.lastObservedCommitBlock === null ? "No commit block reported" : `Last observed commit block ${formatBlock(metric.lastObservedCommitBlock)}`}>
                        <span className="validator-block-number">{formatBlock(metric.lastObservedCommitBlock)}</span>
                      </td>
                      <td title={formatValidatorBlockTitle(metric)}>
                        <span className="validator-block-number">{formatValidatorBlock(metric)}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11}>No validator metrics reported for this miner.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
