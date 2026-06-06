import { Activity, CheckCircle2, Database, Gauge, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatBlock, formatBlockDuration, formatInteger, formatNumber } from "../format";
import type { DashboardModel } from "../types";
import { SectionTitle } from "./section-title";

type PhasePanelsProps = {
  phase: DashboardModel["phase"];
  loading: boolean;
  loadingUpcoming: boolean;
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

export function PhasePanels({ phase, loading, loadingUpcoming }: PhasePanelsProps) {
  const phaseKey = `${phase.name}-${phase.phaseStart ?? "start"}-${phase.phaseEnd ?? "end"}`;
  const previousPhaseKey = useRef(phaseKey);
  const [moving, setMoving] = useState(false);
  const phaseWindow = useMemo(() => getPhaseWindow(phase), [phase]);

  useEffect(() => {
    if (previousPhaseKey.current === phaseKey) {
      return;
    }

    previousPhaseKey.current = phaseKey;
    setMoving(true);
    const timer = window.setTimeout(() => setMoving(false), 760);

    return () => window.clearTimeout(timer);
  }, [phaseKey]);

  return (
    <section className="work-grid">
      {loading ? (
        <PhasePanelSkeleton />
      ) : (
        <article className="phase-panel">
          <SectionTitle eyebrow="Phase Cycle" title={phase.name} />
          <div className="progress-track" title={`${formatNumber(phase.progress, 1)}% complete, ${formatBlockDuration(phase.blocksRemaining)} remaining`}>
            <span className="progress-time-ratio">
              {formatBlockDuration(phase.blocksRemaining)} remaining
            </span>
            <i style={{ width: `${phase.progress}%` }} />
            <span className="progress-cursor" style={{ left: `${phase.progress}%` }}>
              <strong>{formatBlock(phase.headBlock)}</strong>
              <small>{formatNumber(phase.progress, 1)}%</small>
            </span>
          </div>
          <div className={`phase-window${moving || loadingUpcoming ? " phase-window-moving" : ""}`} aria-label="Phase cycle">
            {phaseWindow.map((item) => (
              <article
                className={`phase-window-card phase-window-${getPhasePositionClass(item.position)}`}
                key={item.key}
                aria-current={item.position === 0 ? "step" : undefined}
              >
                <span>{item.label}</span>
                <strong>{item.name}</strong>
                <div className="phase-window-meta">
                  {item.position === 0 ? (
                    <>
                      <em>{formatNumber(item.progress, 1)}%</em>
                      <small>{formatBlockDuration(item.blocksRemaining)} left</small>
                    </>
                  ) : item.position > 0 ? (
                    <>
                      <em>{formatBlockDuration(item.blocksUntilStart)}</em>
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
                  <div className="phase-window-blocks" aria-label="Current phase blocks">
                    <PhaseWindowBlock label="Start" blocks={item.startBlock} />
                    <PhaseWindowBlock label="End" blocks={item.endBlock} />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      )}
    </section>
  );
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
  return (
    <article className="phase-panel phase-panel-skeleton" aria-busy="true" aria-label="Loading current phase">
      <div className="section-title section-title-skeleton" aria-hidden="true">
        <span />
        <h2 />
      </div>
      <div className="progress-track progress-track-skeleton" aria-hidden="true">
        <i />
      </div>
      <div className="phase-stats">
        {["Head", "Start", "End"].map((label) => (
          <div className="phase-stat-skeleton" key={label} aria-hidden="true">
            <span />
            <strong />
          </div>
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
