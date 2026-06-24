"use client";

import { formatBlock, formatInteger, formatPercent } from "../format";
import type { DashboardModel } from "../types";

type DashboardHeaderInfoProps = {
  phase: DashboardModel["phase"];
  subnet: DashboardModel["subnet"];
};

export function DashboardHeaderInfo({ phase, subnet }: DashboardHeaderInfoProps) {
  const upcoming = phase.upcoming.slice(0, 3);
  const trainProgress = Math.max(0, Math.min(100, phase.progress));
  const blocksCompleted = phase.blocksInto ?? null;
  const phaseBlockTotal = getPhaseBlockTotal(blocksCompleted, phase.blocksRemaining);
  const validatorCount = subnet.validators ?? null;
  const currentPhaseName = formatHeading(phase.name);

  return (
    <div className="lb-header-info" aria-label="Leaderboard summary">
      <article className="lb-card lb-header-card">
        <div className="lb-header-column-head">Miners</div>
        <strong className="lb-card-value">{formatInteger(subnet.miners)}</strong>
      </article>

      <article className="lb-card lb-header-card">
        <div className="lb-header-column-head">Validators</div>
        <strong className="lb-card-value">{formatInteger(validatorCount)}</strong>
      </article>

      <article className="lb-card lb-header-card lb-header-card-current">
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
              <span className="lb-header-upcoming-name">{item.name}</span>
              <span className="lb-header-upcoming-block">{`#${formatBlock(item.startBlock)}`}</span>
            </li>
          )) : (
            <li className="lb-header-upcoming-empty">Waiting for phase data</li>
          )}
        </ol>
      </article>
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
