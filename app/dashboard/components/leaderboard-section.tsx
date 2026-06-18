import { AlertTriangle, ChevronLeft, ChevronRight, Eye, EyeOff, History, Maximize2, Minimize2, Moon, Search, ShieldCheck, Sun, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { LEADERBOARD_COLUMN_COUNT, LEADERBOARD_VIEW_UIDS_STORAGE_KEY, VALIDATOR_COLUMNS } from "../constants";
import { formatBlockDuration, formatInteger, formatMetricNumber, formatNumber, formatPercent, formatRepoRevision, getHuggingFaceRevisionUrl, shortText } from "../format";
import { getMinerKey } from "../model";
import type { DashboardModel, MinerRow, Theme, ValidatorHealth, ValidatorMetric } from "../types";
import { CopyHotkeyButton } from "./copy-hotkey-button";
import { MinerDetailsModal } from "./miner-details-modal";
import { SectionTitle } from "./section-title";

const PAGE_SIZE_OPTIONS = [25, 50, 100, "all"] as const;
const NO_CHAIN_COMMIT_STATUS = "no_chain_commit";
const OK_STATUS = "ok";
const EMPTY_METRIC_VALUE = "-";

type LeaderboardSortKey = "rank" | "uid" | "group" | "loss" | "deltaLoss" | "score" | "weight";
type LeaderboardSortDirection = "asc" | "desc";
type LeaderboardSort = {
  key: LeaderboardSortKey;
  direction: LeaderboardSortDirection;
};

type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

type RowPosition = {
  left: number;
  top: number;
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
  burnPercent: number | null;
  phase: DashboardModel["phase"];
  theme: Theme;
  meta: DashboardModel["meta"];
  onQueryChange: (value: string) => void;
  onThemeToggle: () => void;
  onOpenHistory: (uids: string[]) => void;
};

function getDefaultSortDirection(key: LeaderboardSortKey): LeaderboardSortDirection {
  return key === "loss" || key === "deltaLoss" || key === "rank" || key === "uid" || key === "group" ? "asc" : "desc";
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

function getSortableUid(uid: string) {
  const value = Number(uid);
  return Number.isFinite(value) ? value : null;
}

function compareRowsBySort(a: MinerRow, b: MinerRow, sort: LeaderboardSort) {
  if (sort.key === "rank") {
    return compareNullableNumbers(a.rank, b.rank, sort.direction);
  }

  if (sort.key === "uid") {
    return compareNullableNumbers(getSortableUid(a.uid), getSortableUid(b.uid), sort.direction);
  }

  if (sort.key === "group") {
    return compareGroups(a, b, sort.direction);
  }

  if (sort.key === "loss") {
    return compareNullableNumbers(a.loss, b.loss, sort.direction);
  }

  if (sort.key === "deltaLoss") {
    return compareNullableNumbers(a.deltaLoss, b.deltaLoss, sort.direction);
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

function parsePageSizeOption(value: string): PageSizeOption {
  if (value === "all") {
    return "all";
  }

  const numericValue = Number(value);
  return PAGE_SIZE_OPTIONS.includes(numericValue as PageSizeOption) ? numericValue as PageSizeOption : 25;
}

function useLeaderboardRowSwapAnimation(rows: MinerRow[]) {
  const rowElementsRef = useRef(new Map<string, HTMLTableRowElement>());
  const previousPositionsRef = useRef(new Map<string, RowPosition>());
  const previousRanksRef = useRef(new Map<string, number>());
  const animationTimeoutRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const registerRowRef = useRef((key: string) => (node: HTMLTableRowElement | null) => {
    if (node) {
      rowElementsRef.current.set(key, node);
    } else {
      rowElementsRef.current.delete(key);
    }
  }).current;

  useLayoutEffect(() => {
    const previousFrame = animationFrameRef.current;
    const previousTimeout = animationTimeoutRef.current;

    if (previousFrame !== null) {
      window.cancelAnimationFrame(previousFrame);
      animationFrameRef.current = null;
    }

    if (previousTimeout !== null) {
      window.clearTimeout(previousTimeout);
      animationTimeoutRef.current = null;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const currentRanks = new Map(rows.map((row) => [row.uid, row.rank]));
    const nextPositions = new Map<string, RowPosition>();

    for (const row of rows) {
      const element = rowElementsRef.current.get(row.uid);

      if (element) {
        const rect = element.getBoundingClientRect();
        nextPositions.set(row.uid, { left: rect.left, top: rect.top });
      }
    }

    const previousPositions = previousPositionsRef.current;
    const previousRanks = previousRanksRef.current;
    const sameKeySet = rows.length === previousPositions.size && rows.every((row) => previousPositions.has(row.uid));

    previousPositionsRef.current = nextPositions;
    previousRanksRef.current = currentRanks;

    if (reduceMotion || !sameKeySet || !previousPositions.size) {
      return;
    }

    const movingRows: Array<{ dx: number; dy: number; element: HTMLTableRowElement }> = [];

    for (const row of rows) {
      const element = rowElementsRef.current.get(row.uid);
      const previous = previousPositions.get(row.uid);
      const next = nextPositions.get(row.uid);
      const previousRank = previousRanks.get(row.uid);
      const currentRank = currentRanks.get(row.uid);

      if (!element || !previous || !next || previousRank === currentRank) {
        continue;
      }

      const dx = previous.left - next.left;
      const dy = previous.top - next.top;

      if (dx || dy) {
        movingRows.push({ dx, dy, element });
      }
    }

    if (!movingRows.length) {
      return;
    }

    for (const { dx, dy, element } of movingRows) {
      element.style.transition = "transform 0ms";
      element.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      element.style.willChange = "transform";
      element.style.zIndex = "1";
      element.dataset.rankSwap = "true";
    }

    // Force a reflow so the inverse transform is committed before animating back.
    void document.body.offsetHeight;

    animationFrameRef.current = window.requestAnimationFrame(() => {
      for (const { element } of movingRows) {
        element.style.transition = "transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1)";
        element.style.transform = "";
      }
      animationFrameRef.current = null;
    });

    animationTimeoutRef.current = window.setTimeout(() => {
      for (const { element } of movingRows) {
        element.style.transition = "";
        element.style.transform = "";
        element.style.willChange = "";
        element.style.zIndex = "";
        delete element.dataset.rankSwap;
      }
      animationTimeoutRef.current = null;
    }, 560);
  }, [rows]);

  useEffect(() => () => {
    const frame = animationFrameRef.current;
    const timeout = animationTimeoutRef.current;

    if (frame !== null) {
      window.cancelAnimationFrame(frame);
    }

    if (timeout !== null) {
      window.clearTimeout(timeout);
    }
  }, []);

  return registerRowRef;
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
  burnPercent,
  phase,
  theme,
  meta,
  onQueryChange,
  onThemeToggle,
  onOpenHistory
}: LeaderboardSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(25);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewListUids, setViewListUids] = useState<string[]>([]);
  const [viewListHydrated, setViewListHydrated] = useState(false);
  const [showViewListOnly, setShowViewListOnly] = useState(false);
  const [sort, setSort] = useState<LeaderboardSort>({ key: "rank", direction: "asc" });
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const closeDetails = useCallback(() => setDetailUid(null), []);
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
  const isAllRows = pageSize === "all";
  const pageCount = isAllRows ? 1 : Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = isAllRows ? 0 : (safeCurrentPage - 1) * pageSize;
  const pageRows = useMemo(
    () => isAllRows ? sortedRows : sortedRows.slice(pageStart, pageStart + pageSize),
    [isAllRows, pageSize, pageStart, sortedRows]
  );
  const selectedRow = useMemo(() => detailUid ? allRows.find((row) => row.uid === detailUid) ?? null : null, [allRows, detailUid]);
  const visibleStart = totalRows ? pageStart + 1 : 0;
  const visibleEnd = isAllRows ? totalRows : Math.min(pageStart + pageSize, totalRows);
  const emptyLeaderboardMessage = showViewListOnly ? "No selected miners match the current search." : "No miners match the current search.";
  const registerRowRef = useLeaderboardRowSwapAnimation(pageRows);

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
        <SectionTitle eyebrow="Leaderboard" />
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
              <button
                type="button"
                className="view-list-history-button"
                aria-label="Open history for selected miners"
                disabled={!viewListUids.length}
                title={viewListUids.length ? `Open history for ${viewListUids.length} selected miner${viewListUids.length === 1 ? "" : "s"}` : "Select miners to view history"}
                onClick={() => {
                  onOpenHistory(viewListUids);
                }}
              >
                <History size={13} />
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

      <LeaderboardSummaryStrip rows={allRows} burnPercent={burnPercent} meta={meta} />

      <div className="table-frame">
        <table>
          <thead>
            <tr>
              <SortableLeaderboardHeader className="rank-column" label="Rank" sortKey="rank" sort={sort} onSort={updateSort} />
              <SortableLeaderboardHeader className="uid-column" label="UID" sortKey="uid" sort={sort} onSort={updateSort} />
              <SortableLeaderboardHeader className="cohort-column" label="Group" sortKey="group" sort={sort} onSort={updateSort} />
              <th className="miner-column"><span>Miner</span><small>Hotkey + repo</small></th>
              <SortableLeaderboardHeader className="loss-column" label="Loss" sortKey="loss" sort={sort} onSort={updateSort} />
              <SortableLeaderboardHeader className="delta-loss-column" label="Delta" sortKey="deltaLoss" sort={sort} onSort={updateSort} title="Delta" />
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
                monitored={viewListUidSet.has(row.uid)}
                onInspectRow={() => setDetailUid(row.uid)}
                onToggleViewList={toggleViewListMiner}
                rowRef={registerRowRef(getMinerKey(row))}
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

      {selectedRow ? (
        <MinerDetailsModal
          row={selectedRow}
          validatorHealth={meta.validatorHealth}
          onClose={closeDetails}
          onOpenHistory={onOpenHistory}
        />
      ) : null}

      <div className="table-footer" aria-label="Leaderboard pagination">
        <span>
          Showing {visibleStart}-{visibleEnd} of {totalRows}
        </span>
        <div className="pagination-controls">
          <label className="page-size-field">
            <span>Rows</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => {
                setPageSize(parsePageSizeOption(event.target.value));
              }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option === "all" ? "All" : option}</option>
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
  rows: MinerRow[];
  burnPercent: number | null;
  meta: DashboardModel["meta"];
};

function LeaderboardSummaryStrip({ rows, burnPercent, meta }: LeaderboardSummaryStripProps) {
  const liveValidators = meta.validatorHealth.length
    ? meta.validatorHealth.filter((validator) => getValidatorTone(validator) === "live").length
    : meta.polledValidatorCount ?? 0;
  const validatorTotal = meta.validatorCount ?? meta.validatorHealth.length;
  const validatorLabel = validatorTotal ? `${liveValidators}/${validatorTotal}` : "-";

  return (
    <div className="leaderboard-summary-strip">
      <div className="leaderboard-summary-card validator-health-summary">
        <ShieldCheck size={17} />
        <div>
          <span>Validator</span>
          <strong>{validatorLabel} live</strong>
        </div>
        <div className="validator-health-list" aria-label="Validator slot health">
          {VALIDATOR_COLUMNS.map((index) => {
            const health = getValidatorHealthForSlot(meta.validatorHealth, index);
            const metric = getValidatorMetricFromRows(rows, index);
            const tone = getValidatorTone(health);
            const label = health?.label ?? metric?.label ?? `val-${String(index + 1).padStart(2, "0")}`;
            const hotkey = health?.hotkey ?? (metric?.hotkey && metric.hotkey !== "-" ? metric.hotkey : null);

            return (
              <span className={`validator-health-row validator-health-${tone}`} key={`validator-health-${index}`} title={`Validator ${index + 1}: ${formatValidatorStatus(health?.status)}${hotkey ? `, hotkey ${hotkey}` : ""}`}>
                <strong>{label}</strong>
                <small>
                  {hotkey ? (
                    <CopyHotkeyButton value={hotkey} className="validator-health-hotkey-button" start={8} end={6} />
                  ) : (
                    "-"
                  )}
                </small>
                <i aria-hidden="true" />
              </span>
            );
          })}
        </div>
      </div>

      <div className="leaderboard-summary-card leaderboard-summary-compact burn-summary">
        <span>Burn</span>
        <strong>{formatPercent(burnPercent, 2)}</strong>
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
  monitored: boolean;
  onInspectRow: () => void;
  onToggleViewList: (row: MinerRow) => void;
  rowRef: (node: HTMLTableRowElement | null) => void;
};

function LeaderboardRow({ row, validatorHealth, monitored, onInspectRow, onToggleViewList, rowRef }: LeaderboardRowProps) {
  const repoRevisionUrl = getHuggingFaceRevisionUrl(row.repo, row.revision);
  const repoRevisionLabel = formatRepoRevision(row.repo, row.revision);
  const rowKey = getMinerKey(row);
  const rowScore = renderAggregateScoreMetric(row, 4);
  const rowWeight = formatLeaderboardMetricNumber(row.weight, 4);
  const rowLoss = formatLeaderboardMetricNumber(row.loss, 4);
  const rowDeltaLoss = formatLeaderboardMetricNumber(row.deltaLoss, 4);

  return (
    <tr
      ref={rowRef}
      className={`leaderboard-row${monitored ? " leaderboard-row-monitored" : ""}`}
      onClick={onInspectRow}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onInspectRow();
        }
      }}
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
          <span>
            <span className="rank-prefix">#</span>
            {` ${row.rank}`}
          </span>
        </div>
      </td>
      <td className="uid-column" data-label="UID">{row.uid}</td>
      <td className="cohort-column" data-label="Group">
        <CohortGroupBadge row={row} />
      </td>
      <td className="miner-column" data-label="Miner" title={`${row.hotkey} ${repoRevisionLabel}`}>
        <div className="miner-cell">
          <strong>
            <CopyHotkeyButton value={row.hotkey} className="table-link hotkey-copy-button" start={8} end={6} />
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
      <td className="loss-column" data-label="Loss">
        <span className="leaderboard-metric-pill leaderboard-loss-pill">{rowLoss}</span>
      </td>
      <td className="delta-loss-column" data-label="Delta">{rowDeltaLoss}</td>
      <td className="score-column" data-label="Score">{rowScore}</td>
      <td className="weight-column" data-label="Weight">
        <span className="leaderboard-metric-pill leaderboard-weight-pill">{rowWeight}</span>
      </td>
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
                <strong className="validator-mini-rank-metric"><span>R</span>{rank}</strong>
                <strong className="validator-mini-loss-metric"><span>L</span>{valLoss}</strong>
                <small className="validator-mini-weight-metric"><span>W</span>{weight}</small>
                <small className="validator-mini-eval-metric"><span>E</span>{evalStatus}</small>
              </span>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

function getValidatorMetricForColumn(row: MinerRow, index: number) {
  const hasSlots = row.validatorMetrics.some((metric) => metric.slot !== null);
  return hasSlots ? row.validatorMetrics.find((metric) => metric.slot === index + 1) : row.validatorMetrics[index];
}

function getValidatorHealthForSlot(validatorHealth: ValidatorHealth[], index: number) {
  return validatorHealth.find((validator) => validator.slot === index + 1);
}

function getValidatorMetricFromRows(rows: MinerRow[], index: number) {
  for (const row of rows) {
    const metric = getValidatorMetricForColumn(row, index);

    if (metric && (metric.uid !== null || (metric.hotkey && metric.hotkey !== "-"))) {
      return metric;
    }
  }

  return undefined;
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

function formatAssignmentRole(role: string | null | undefined) {
  return role ? role.replace(/_/g, " ") : "-";
}

function formatScoreAge(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (value < 60) {
    return `${formatNumber(value, 1)}s`;
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
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

  return metric.rankTotal === null ? formatInteger(metric.rank) : `${formatInteger(metric.rank)} / ${formatInteger(metric.rankTotal)}`;
}
