"use client";

import { formatBlock, formatBlockMinutes, formatInteger, formatPercent } from "../format";
import type { DashboardModel } from "../types";

type DashboardHeaderInfoProps = {
  phase: DashboardModel["phase"];
  isLoading: boolean;
};

export function DashboardHeaderInfo({ phase, isLoading }: DashboardHeaderInfoProps) {
  if (isLoading) {
    return <HeaderInfoSkeleton />;
  }

  const upcoming = phase.upcoming.slice(0, 3);
  const trainProgress = Math.max(0, Math.min(100, phase.progress));
  const blocksCompleted = phase.blocksInto ?? null;
  const phaseBlockTotal = getPhaseBlockTotal(blocksCompleted, phase.blocksRemaining);
  const currentPhaseName = formatHeading(phase.name);
  const phaseTone = getPhaseTone(phase.name);

  return (
    <div className="lb-header-info" aria-label="Leaderboard summary">
      <article className="lb-card lb-header-card lb-header-card-upcoming">
        <div className="lb-header-column-head">Cycle Details</div>
        <div className="lb-header-stat-list">
          <StatRow label="Cycle" value={`# ${formatBlock(phase.cycleIndex)}`} />
          <StatRow label="Round" value={formatBlock(phase.headBlock)} />
          <StatRow
            label="Blocks Remaining"
            value={`${formatBlock(phase.blocksRemaining)} (${formatBlockMinutes(phase.blocksRemaining)})`}
          />
        </div>
      </article>

      <article className={`lb-card lb-header-card lb-header-card-current lb-phase-tone-${phaseTone}`}>
        <div className="lb-header-column-head">Current Phase</div>
        <div className="lb-header-current-headline">
          <span>{currentPhaseName}</span>
          <strong className="lb-header-number-lg">{formatPercent(trainProgress, 2)}</strong>
        </div>
        <div className="lb-header-progress-track" aria-hidden="true">
          <span style={{ width: `${trainProgress}%` }} />
        </div>
        <div className="lb-header-current-foot">
          {blocksCompleted !== null && phaseBlockTotal !== null
            ? `${formatInteger(blocksCompleted)} / ${formatInteger(phaseBlockTotal)} blocks completed`
            : "-"}
        </div>
      </article>

      <article className="lb-card lb-header-card lb-header-card-upcoming">
        <div className="lb-header-column-head">Upcoming Phases</div>
        <ol className="lb-header-upcoming-list">
          {upcoming.length ? upcoming.map((item, index) => (
            <li className="lb-header-upcoming-item" key={`${item.name}-${item.startBlock}`}>
              <span className="lb-header-upcoming-index">{`${index + 1}.`}</span>
              <span className="lb-header-upcoming-name">
                <span>{item.name}</span>
                {item.actor ? <span className="lb-header-upcoming-actor">{` (${item.actor})`}</span> : null}
              </span>
              <span className="lb-header-upcoming-block">{`# ${formatBlock(item.startBlock)}`}</span>
            </li>
          )) : (
            <li className="lb-header-upcoming-empty">Waiting for phase data</li>
          )}
        </ol>
      </article>
    </div>
  );
}

function HeaderInfoSkeleton() {
  return (
    <div className="lb-header-info" aria-busy="true" aria-label="Loading leaderboard summary">
      <article className="lb-card lb-header-card lb-header-card-skeleton">
        <SkeletonLine width="42%" />
        <SkeletonLine width="52%" />
        <SkeletonLine width="68%" />
        <SkeletonLine width="86%" />
      </article>
      <article className="lb-card lb-header-card lb-header-card-current lb-header-card-skeleton">
        <SkeletonLine width="32%" />
        <SkeletonLine width="76%" size="large" />
        <SkeletonLine width="100%" />
        <SkeletonLine width="58%" />
      </article>
      <article className="lb-card lb-header-card lb-header-card-upcoming lb-header-card-skeleton">
        <SkeletonLine width="58%" />
        <SkeletonLine width="100%" />
        <SkeletonLine width="86%" />
        <SkeletonLine width="94%" />
      </article>
    </div>
  );
}

function SkeletonLine({ width, size }: { width: string; size?: "large" }) {
  return <span className={`lb-skeleton${size ? ` lb-skeleton-${size}` : ""}`} style={{ width }} aria-hidden="true" />;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="lb-header-stat-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatHeading(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return "Train";
  }

  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getPhaseBlockTotal(blocksCompleted: number | null, blocksRemaining: number | null) {
  if (blocksCompleted === null || blocksRemaining === null) {
    return null;
  }

  const total = blocksCompleted + blocksRemaining;
  return total > 0 ? total : null;
}

function getPhaseTone(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "neutral";
  }

  if (normalized.includes("submit")) {
    return "submission";
  }

  if (normalized.includes("validat") || normalized.includes("score")) {
    return "validate";
  }

  if (normalized.includes("merge")) {
    return "merge";
  }

  if (normalized.includes("commit")) {
    return "commit";
  }

  if (normalized.includes("distribut")) {
    return "distribute";
  }

  if (normalized.includes("train")) {
    return "train";
  }

  if (normalized.includes("wait")) {
    return "waiting";
  }

  return "neutral";
}
