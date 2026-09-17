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
  const phaseProgress = Math.max(0, Math.min(100, phase.progress));
  const blocksCompleted = phase.blocksInto ?? null;
  const phaseBlockTotal = getPhaseBlockTotal(blocksCompleted, phase.blocksRemaining);
  const currentPhaseName = formatHeading(phase.name);
  const phaseTone = getPhaseTone(phase.name);

  return (
    <div className="lb-header-info" aria-label="Leaderboard summary">
      <article className={`lb-card lb-header-card lb-header-card-current lb-phase-tone-${phaseTone}`}>
        <div className="lb-header-current-headline">
          <ol className="lb-header-phase-sequence" aria-label="Current and upcoming phases">
            <li aria-current="step" className="lb-header-phase-active">{currentPhaseName}</li>
            {upcoming.map((item) => (
              <li key={`${item.name}-${item.startBlock}`} title={`Starts at block ${formatBlock(item.startBlock)}${item.actor ? ` (${item.actor})` : ""}`}>
                <span className="lb-header-phase-separator" aria-hidden="true">&gt;</span>
                <span>{item.name}</span>
              </li>
            ))}
          </ol>
          <strong className="lb-header-number-lg">{formatPercent(phaseProgress, 2)}</strong>
        </div>
        <div
          className="lb-header-progress-track"
          role="progressbar"
          aria-label={`${currentPhaseName} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={phaseProgress}
        >
          <span style={{ width: `${phaseProgress}%` }} />
        </div>
        <div className="lb-header-current-foot">
          <span>
            {blocksCompleted !== null && phaseBlockTotal !== null
              ? `${formatInteger(blocksCompleted)} / ${formatInteger(phaseBlockTotal)} blocks completed`
              : "-"}
          </span>
          <span>{`${formatBlock(phase.blocksRemaining)} blocks (${formatBlockMinutes(phase.blocksRemaining)}) remaining`}</span>
        </div>
      </article>
    </div>
  );
}

function HeaderInfoSkeleton() {
  return (
    <div className="lb-header-info" aria-busy="true" aria-label="Loading leaderboard summary">
      <article className="lb-card lb-header-card lb-header-card-current lb-header-card-skeleton">
        <div className="lb-header-current-headline">
          <SkeletonLine width="58%" size="large" />
          <SkeletonLine width="10%" size="large" />
        </div>
        <SkeletonLine width="100%" />
        <div className="lb-header-current-foot">
          <SkeletonLine width="24%" />
          <SkeletonLine width="32%" />
        </div>
      </article>
    </div>
  );
}

function SkeletonLine({ width, size }: { width: string; size?: "large" }) {
  return <span className={`lb-skeleton${size ? ` lb-skeleton-${size}` : ""}`} style={{ width }} aria-hidden="true" />;
}

function formatHeading(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return "Train";
  }

  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
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

  if ((normalized.includes("submit") || normalized.includes("submission"))) {
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
