import { Activity, CheckCircle2, Database, Gauge, Users, X } from "lucide-react";
import { useMemo } from "react";

import { BLOCK_TIME_SECONDS } from "../constants";
import { formatBlock, formatBlockDuration, formatInteger, formatNumber } from "../format";
import type { DashboardModel } from "../types";
import { SectionTitle } from "./section-title";

type PhasePanelsProps = {
  phase: DashboardModel["phase"];
  fetchedAt: string | null;
  nowMs: number;
  loading: boolean;
};

type RoundHealthPanelProps = {
  round: DashboardModel["round"];
  scoredPercent: number;
  loading: boolean;
};

type PhaseWindowItem = {
  key: string;
  name: string;
  position: -1 | 0 | 1 | 2 | 3;
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
              return (
                <article
                  className={`phase-window-card phase-window-${getPhasePositionClass(item.position)}`}
                  key={item.key}
                  aria-current={item.position === 0 ? "step" : undefined}
                >
                  <span>{item.label}</span>
                  <strong>{item.name}</strong>
                  {item.position === 0 ? (
                    <div className="phase-window-progress">
                      <div
                        className="progress-track phase-window-progress-track"
                        title={`${formatNumber(getCurrentProgress(item, elapsedBlocks), 1)}% complete, ${formatBlockDuration(getLiveBlocks(item.blocksRemaining, elapsedBlocks))} remaining`}
                      >
                        <i style={{ width: `${getCurrentProgress(item, elapsedBlocks)}%` }} />
                      </div>
                    </div>
                  ) : null}
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
                  {item.position === 0 ? (
                    <div
                      className="phase-window-blocks phase-window-blocks-inline"
                      aria-label={`Current phase blocks ${formatBlock(item.startBlock)} - ${formatBlock(item.endBlock)}`}
                    >
                      <span className="phase-window-block-value">{formatBlock(item.startBlock)}</span>
                      <span className="phase-window-block-separator">-</span>
                      <span className="phase-window-block-value">{formatBlock(item.endBlock)}</span>
                    </div>
                  ) : null}
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

function getPhaseWindow(phase: DashboardModel["phase"]): PhaseWindowItem[] {
  const currentPhaseIndex = getPhaseIndex(phase.name);
  const currentDuration = phase.phaseStart !== null && phase.phaseEnd !== null && phase.phaseEnd >= phase.phaseStart
    ? phase.phaseEnd - phase.phaseStart + 1
    : null;

  return ([-1, 0, 1, 2, 3] as const).map((position) => {
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

    if (position > 0) {
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
    }

    const previousName = getPhaseNameAt(currentPhaseIndex, -1);
    return {
      key: `prev-${position}-${previousName}`,
      name: previousName,
      position,
      label: "Prev",
      startBlock: null,
      endBlock: null,
      headBlock: null,
      duration: null,
      blocksUntilStart: null,
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

  return position < 0 ? `prev-${Math.abs(position)}` : `next-${position}`;
}

function PhasePanelSkeleton() {
  const skeletonCards = [
    { key: "prev", className: "prev-1", label: "Prev", name: "Loading" },
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
            {item.key === "current" ? (
              <>
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
              </>
            ) : (
              <div className="phase-window-meta phase-window-skeleton-meta">
                <em />
                <small />
              </div>
            )}
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

export function RoundHealthPanel({ round, scoredPercent, loading }: RoundHealthPanelProps) {
  const stats = [
    { tone: "loss", label: "Loss", value: formatNumber(round.baselineLoss, 4), icon: <Gauge size={16} /> },
    { tone: "scored", label: "Scored", value: formatInteger(round.scored), icon: <CheckCircle2 size={16} /> },
    { tone: "pending", label: "Pending", value: formatInteger(round.pending), icon: <Activity size={16} /> },
    { tone: "failed", label: "Failed", value: formatInteger(round.failed), icon: <X size={16} /> },
    { tone: "roster", label: "Roster", value: formatInteger(round.roster), icon: <Users size={16} /> },
    { tone: "claimed", label: "Claimed", value: formatInteger(round.claimed), icon: <Database size={16} /> }
  ];

  if (loading) {
    return (
      <article className="round-panel round-panel-skeleton" aria-busy="true" aria-label="Loading round health">
        <div className="section-title section-title-skeleton" aria-hidden="true">
          <span />
          <h2 />
        </div>
        <div className="round-stats">
          {stats.map((stat) => (
            <div className={`round-stat round-stat-${stat.tone} round-stat-skeleton`} key={stat.label} aria-hidden="true">
              <span className="stat-icon" />
              <span className="stat-label" />
              <strong />
            </div>
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className="round-panel">
      <SectionTitle eyebrow="Round Health" title={`${formatNumber(scoredPercent, 1)}% scored`} />
      <div className="round-stats">
        {stats.map((stat) => (
          <div className={`round-stat round-stat-${stat.tone}`} key={stat.label}>
            <span className="stat-icon" aria-hidden="true">{stat.icon}</span>
            <span className="stat-label">{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
