import { useMemo, useRef, useState } from "react";

import { BLOCK_TIME_SECONDS } from "../constants";
import { formatBlock, formatBlockDuration, formatInteger, formatNumber } from "../format";
import type { DashboardModel, HistoryPoint } from "../types";
import { MiniLineChart } from "./mini-line-chart";
import { SectionTitle } from "./section-title";

type PhasePanelsProps = {
  phase: DashboardModel["phase"];
  fetchedAt: string | null;
  nowMs: number;
  loading: boolean;
};

type RoundHealthPanelProps = {
  round: DashboardModel["round"];
  phase: DashboardModel["phase"];
  miners: number;
  history: HistoryPoint[];
  scoredPercent: number;
  loading: boolean;
};

type PhaseWindowItem = {
  key: string;
  name: string;
  position: 0 | 1 | 2 | 3;
  label: string;
  startBlock: number | null;
  endBlock: number | null;
  headBlock: number | null;
  duration: number | null;
  blocksUntilStart: number | null;
  blocksRemaining: number | null;
  progress: number | null;
};

const PHASE_LIST = ["Distribute", "Train", "MinerCommit1", "MinerCommit2", "Submission", "Validate", "Merge", "ValidatorCommit1", "ValidatorCommit2"] as const;

export function PhasePanels({ phase, fetchedAt, nowMs, loading }: PhasePanelsProps) {
  const phaseWindow = useMemo(() => getPhaseWindow(phase), [phase]);
  const elapsedBlocks = getElapsedBlocks(fetchedAt, nowMs);

  return (
    <section className="work-grid">
      {loading ? (
        <PhasePanelSkeleton />
      ) : (
        <article className="phase-panel">
          <SectionTitle eyebrow="Phase Cycle" />
          <div className="phase-window" aria-label="Phase cycle">
            {phaseWindow.map((item) => {
              const progress = getPhaseCardProgress(item, elapsedBlocks);
              const progressTitle = getPhaseCardProgressTitle(item, elapsedBlocks);

              return (
                <article
                  className={`phase-window-card phase-window-${getPhasePositionClass(item.position)}`}
                  key={item.key}
                  aria-current={item.position === 0 ? "step" : undefined}
                >
                  <span>{item.label}</span>
                  <strong>{item.name}</strong>
                  <div className="phase-window-progress">
                    <div className="progress-track phase-window-progress-track" title={progressTitle}>
                      <i style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="phase-window-meta">
                    {item.position === 0 ? (
                      <>
                        <em>{formatNumber(getCurrentProgress(item, elapsedBlocks), 1)}%</em>
                        <small>{formatBlockDuration(getLiveBlocks(item.blocksRemaining, elapsedBlocks))} left</small>
                      </>
                    ) : item.position > 0 ? (
                      <>
                        <em>{formatBlockDuration(getLiveBlocks(item.blocksUntilStart, elapsedBlocks))}</em>
                        <small>starts</small>
                      </>
                    ) : (
                      <>
                        <em>{item.duration === null ? "-" : formatBlockDuration(item.duration)}</em>
                        <small>duration</small>
                      </>
                    )}
                  </div>
                  <div className="phase-window-blocks phase-window-blocks-inline" aria-label={getPhaseBlockRangeLabel(item)}>
                    <span className="phase-window-block-value">{formatBlock(item.startBlock)}</span>
                    <span className="phase-window-block-separator">-</span>
                    <span className="phase-window-block-value">{formatBlock(item.endBlock)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      )}
    </section>
  );
}

function getElapsedBlocks(fetchedAt: string | null, nowMs: number) {
  if (!fetchedAt) {
    return 0;
  }

  const fetchedAtMs = new Date(fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs)) {
    return 0;
  }

  return Math.max(0, (nowMs - fetchedAtMs) / (BLOCK_TIME_SECONDS * 1000));
}

function getLiveBlocks(blocks: number | null, elapsedBlocks: number) {
  if (blocks === null) {
    return null;
  }

  return Math.max(0, blocks - elapsedBlocks);
}

function getCurrentProgress(item: PhaseWindowItem, elapsedBlocks: number) {
  if (item.position !== 0) {
    return item.progress ?? 0;
  }

  const blocksInto = item.headBlock !== null && item.startBlock !== null ? item.headBlock - item.startBlock : null;
  const totalBlocks = blocksInto !== null && item.blocksRemaining !== null ? blocksInto + item.blocksRemaining : null;

  if (blocksInto === null || totalBlocks === null || totalBlocks <= 0) {
    return item.progress ?? 0;
  }

  return Math.max(0, Math.min(100, ((blocksInto + elapsedBlocks) / totalBlocks) * 100));
}

function getPhaseCardProgress(item: PhaseWindowItem, elapsedBlocks: number) {
  if (item.position === 0) {
    return getCurrentProgress(item, elapsedBlocks);
  }

  return 0;
}

function getPhaseCardProgressTitle(item: PhaseWindowItem, elapsedBlocks: number) {
  if (item.position === 0) {
    return `${formatNumber(getCurrentProgress(item, elapsedBlocks), 1)}% complete, ${formatBlockDuration(getLiveBlocks(item.blocksRemaining, elapsedBlocks))} remaining`;
  }

  const blocksUntilStart = getLiveBlocks(item.blocksUntilStart, elapsedBlocks);
  return blocksUntilStart === null ? "Starts soon" : `${formatBlockDuration(blocksUntilStart)} until start`;
}

function getPhaseBlockRangeLabel(item: PhaseWindowItem) {
  if (item.position === 0) {
    return `Current phase blocks ${formatBlock(item.startBlock)} - ${formatBlock(item.endBlock)}`;
  }

  return `${item.label} phase blocks ${formatBlock(item.startBlock)} - ${formatBlock(item.endBlock)}`;
}

function getPhaseWindow(phase: DashboardModel["phase"]): PhaseWindowItem[] {
  const currentPhaseIndex = getPhaseIndex(phase.name);
  const currentDuration = phase.phaseStart !== null && phase.phaseEnd !== null && phase.phaseEnd >= phase.phaseStart
    ? phase.phaseEnd - phase.phaseStart + 1
    : null;

  return ([0, 1, 2, 3] as const).map((position) => {
    if (position === 0) {
      return {
        key: `current-${phase.name}-${phase.phaseStart ?? "start"}`,
        name: phase.name,
        position,
        label: "Current",
        startBlock: phase.phaseStart,
        endBlock: phase.phaseEnd,
        headBlock: phase.headBlock,
        duration: currentDuration,
        blocksUntilStart: null,
        blocksRemaining: phase.blocksRemaining,
        progress: phase.progress
      };
    }

    const upcoming = phase.upcoming[position - 1] ?? null;
    const fallbackName = getPhaseNameAt(currentPhaseIndex, position);
    return {
      key: `next-${position}-${upcoming?.name ?? fallbackName}-${upcoming?.startBlock ?? "unknown"}`,
      name: upcoming?.name ?? fallbackName,
      position,
      label: position === 1 ? "Next" : `Next +${position - 1}`,
      startBlock: upcoming?.startBlock ?? null,
      endBlock: upcoming?.endBlock ?? null,
      headBlock: null,
      duration: upcoming?.duration ?? null,
      blocksUntilStart: upcoming?.blocksUntilStart ?? null,
      blocksRemaining: null,
      progress: null
    };
  });
}

function getPhaseIndex(phaseName: string) {
  const index = PHASE_LIST.findIndex((name) => namesEqual(name, phaseName));
  return index === -1 ? null : index;
}

function getPhaseNameAt(currentPhaseIndex: number | null, offset: number) {
  if (currentPhaseIndex === null) {
    return "-";
  }

  const index = currentPhaseIndex + offset;
  const safeIndex = ((index % PHASE_LIST.length) + PHASE_LIST.length) % PHASE_LIST.length;
  return PHASE_LIST[safeIndex] ?? "-";
}

function namesEqual(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function getPhasePositionClass(position: PhaseWindowItem["position"]) {
  if (position === 0) {
    return "current";
  }

  return `next-${position}`;
}

function PhasePanelSkeleton() {
  const skeletonCards = [
    { key: "current", className: "current", label: "Current", name: "Loading" },
    { key: "next-1", className: "next-1", label: "Next", name: "Loading" },
    { key: "next-2", className: "next-2", label: "Next +1", name: "Loading" },
    { key: "next-3", className: "next-3", label: "Next +2", name: "Loading" }
  ] as const;

  return (
    <article className="phase-panel phase-panel-skeleton" aria-busy="true" aria-label="Loading current phase">
      <div className="section-title section-title-skeleton" aria-hidden="true">
        <span />
        <h2 />
      </div>
      <div className="phase-window phase-window-skeleton" aria-hidden="true">
        {skeletonCards.map((item) => (
          <article
            className={`phase-window-card phase-window-skeleton-card phase-window-${item.className}`}
            key={item.key}
          >
            <span>{item.label}</span>
            <strong>{item.name}</strong>
            <div className="phase-window-skeleton-progress">
              <div className="progress-track progress-track-skeleton">
                <i />
              </div>
            </div>
            <div className="phase-window-meta phase-window-skeleton-meta">
              <em />
              <small />
            </div>
            <div className="phase-window-blocks phase-window-blocks-inline phase-window-skeleton-blocks">
              <span className="phase-window-block-value" />
              <span className="phase-window-block-separator">-</span>
              <span className="phase-window-block-value" />
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}

function PhaseWindowBlock({ label, blocks }: { label: string; blocks: number | null }) {
  return (
    <span className="phase-window-block" title={blocks === null ? undefined : `${label} block ${blocks}`}>
      <small>{label}</small>
      <strong>{formatBlock(blocks)}</strong>
    </span>
  );
}

type RoundHealthSegmentTone = "scored" | "failed" | "pending";

type RoundHealthSegment = {
  key: RoundHealthSegmentTone;
  label: string;
  value: number;
  tone: RoundHealthSegmentTone;
  percent: number;
  startPercent: number;
};

function getRoundCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getRoundHealthBreakdown(round: DashboardModel["round"]) {
  const scored = getRoundCount(round.scored);
  const failed = getRoundCount(round.failed);
  const pending = getRoundCount(round.pending);
  const roster = scored + failed + pending;

  const segments = [
    { key: "scored", label: "Scored", value: scored, tone: "scored", percent: 0 },
    { key: "failed", label: "Failed", value: failed, tone: "failed", percent: 0 },
    { key: "pending", label: "Pending", value: pending, tone: "pending", percent: 0 }
  ] as const;

  let startPercent = 0;
  const normalizedSegments: RoundHealthSegment[] = segments.map((segment) => {
    const percent = roster > 0 ? (segment.value / roster) * 100 : 0;
    const output: RoundHealthSegment = {
      ...segment,
      percent,
      startPercent
    };

    startPercent += percent;
    return output;
  });

  return {
    roster,
    scored,
    failed,
    pending,
    segments: normalizedSegments
  };
}

export function RoundHealthPanel({ round, phase, miners, history, scoredPercent, loading }: RoundHealthPanelProps) {
  const [hoveredSegmentKey, setHoveredSegmentKey] = useState<RoundHealthSegmentTone | null>(null);
  const interactiveRef = useRef<HTMLDivElement | null>(null);
  const breakdown = getRoundHealthBreakdown(round);
  const hoveredSegment = hoveredSegmentKey ? breakdown.segments.find((segment) => segment.key === hoveredSegmentKey) ?? null : null;
  const hoveredSegmentLeft = hoveredSegment === null
    ? 50
    : Math.min(95, Math.max(5, hoveredSegment.startPercent + (hoveredSegment.percent / 2)));
  const nextCycleMinutes = phase.blocksRemaining === null ? null : (phase.blocksRemaining * BLOCK_TIME_SECONDS) / 60;
  const commitSuccess = round.downloaded;
  const commitSuccessPercent = commitSuccess !== null && miners > 0 ? Math.max(0, Math.min(100, (commitSuccess / miners) * 100)) : null;
  const handleInteractiveMouseLeave = () => {
    const activeElement = document.activeElement;
    if (interactiveRef.current && activeElement && interactiveRef.current.contains(activeElement)) {
      return;
    }

    setHoveredSegmentKey(null);
  };

  if (loading) {
    return (
      <article className="round-panel round-panel-skeleton" aria-busy="true" aria-label="Loading round health">
        <SectionTitle eyebrow="Round Details" />
        <div className="round-details-head round-details-head-skeleton" aria-hidden="true">
          <div className="round-details-head-item">
            <span />
            <strong />
          </div>
          <div className="round-details-head-item">
            <span />
            <strong />
          </div>
          <div className="round-details-head-item">
            <span />
            <strong />
          </div>
        </div>
        <div className="round-details-metrics round-details-metrics-skeleton" aria-hidden="true">
          {["Roster", "Scored", "Pending", "Failed", "Commit Success"].map((label) => (
            <div className="round-details-metric" key={label}>
              <span />
              <strong />
              <small>{label}</small>
            </div>
          ))}
        </div>
        <div className="round-health-interactive" aria-hidden="true">
          <div className="round-health-bar round-health-bar-skeleton">
            <i className="round-health-segment round-health-segment-scored" style={{ width: "44%" }} />
            <i className="round-health-segment round-health-segment-failed" style={{ width: "12%" }} />
            <i className="round-health-segment round-health-segment-pending" style={{ width: "44%" }} />
          </div>
        </div>
        <div className="round-details-trend round-details-trend-skeleton" aria-hidden="true">
          <div className="chart-box chart-box-skeleton">
            <div className="chart-summary">
              <span />
              <strong />
            </div>
            <div className="chart-skeleton">
              <i />
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="round-panel round-details-panel">
      <SectionTitle eyebrow="Round Details" />
      <div className="round-details-head">
        <div className="round-details-head-item">
          <span>Round</span>
          <strong>{formatBlock(round.id)}</strong>
        </div>
        <div className="round-details-head-item">
          <span>Baseline Loss</span>
          <strong>{formatNumber(round.baselineLoss, 4)}</strong>
        </div>
        <div className="round-details-head-item">
          <span>Next Cycle In</span>
          <strong>{nextCycleMinutes === null ? "-" : `${formatNumber(nextCycleMinutes, 1)} min`}</strong>
        </div>
      </div>
      <div className="round-details-metrics">
        <div className="round-details-metric round-details-metric-wide">
          <span>{formatInteger(breakdown.roster)}</span>
          <strong>Roster</strong>
          <small>scored + pending + failed</small>
        </div>
        <div className="round-details-metric">
          <span>{formatInteger(breakdown.scored)}</span>
          <strong>Scored</strong>
          <small>{formatNumber(breakdown.roster > 0 ? (breakdown.scored / breakdown.roster) * 100 : 0, 2)}%</small>
        </div>
        <div className="round-details-metric">
          <span>{formatInteger(breakdown.pending)}</span>
          <strong>Pending</strong>
          <small>{formatNumber(breakdown.roster > 0 ? (breakdown.pending / breakdown.roster) * 100 : 0, 2)}%</small>
        </div>
        <div className="round-details-metric">
          <span>{formatInteger(breakdown.failed)}</span>
          <strong>Failed</strong>
          <small>{formatNumber(breakdown.roster > 0 ? (breakdown.failed / breakdown.roster) * 100 : 0, 2)}%</small>
        </div>
        <div className="round-details-metric">
          <span>{commitSuccess === null ? "-" : `${formatInteger(commitSuccess)} / ${formatInteger(miners)}`}</span>
          <strong>Commit Success</strong>
          <small>{commitSuccessPercent === null ? "-" : `${formatNumber(commitSuccessPercent, 2)}%`}</small>
        </div>
      </div>
      <div ref={interactiveRef} className="round-health-interactive" onMouseLeave={handleInteractiveMouseLeave}>
        {hoveredSegment ? (
          <div
            className={`round-health-tooltip round-health-tooltip-${hoveredSegment.tone}`}
            role="tooltip"
            style={{ left: `${hoveredSegmentLeft}%` }}
          >
            <strong>{hoveredSegment.label}</strong>
            <span>{formatInteger(hoveredSegment.value)} items, {formatNumber(hoveredSegment.percent, 1)}% of roster</span>
          </div>
        ) : null}
        <div
          className="round-health-bar"
          role="group"
          aria-label={`Round roster breakdown. Scored ${formatInteger(breakdown.scored)}. Failed ${formatInteger(breakdown.failed)}. Pending ${formatInteger(breakdown.pending)}. Total roster ${formatInteger(breakdown.roster)}.`}
        >
          {breakdown.segments.map((segment) => (
            <button
              className={`round-health-segment round-health-segment-${segment.tone}`}
              key={segment.key}
              style={{ width: `${segment.percent}%` }}
              type="button"
              aria-label={`${segment.label} ${formatInteger(segment.value)} (${formatNumber(segment.percent, 1)}% of roster)`}
              onMouseEnter={() => setHoveredSegmentKey(segment.key)}
              onFocus={() => setHoveredSegmentKey(segment.key)}
              onBlur={(event) => {
                if (event.relatedTarget instanceof Node && interactiveRef.current?.contains(event.relatedTarget)) {
                  return;
                }

                setHoveredSegmentKey(null);
              }}
              tabIndex={segment.percent > 0 ? 0 : -1}
            />
          ))}
        </div>
        <div className="round-details-progress-note">
          {formatNumber(scoredPercent, 2)}% scored · {formatInteger(breakdown.pending)} pending
        </div>
        <div className="round-health-legend" aria-label="Round roster legend">
          {breakdown.segments.map((segment) => (
            <div className={`round-health-legend-item round-health-legend-${segment.tone}`} key={segment.key}>
              <span className="round-health-legend-swatch" aria-hidden="true" />
              <span className="round-health-legend-label">{segment.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="round-details-trend">
        <div className="round-details-trend-head">
          <span>Baseline Loss Trend</span>
          <small>{history.length ? `${history.length} samples` : "-"}</small>
        </div>
        <MiniLineChart points={history} />
      </div>
    </article>
  );
}
