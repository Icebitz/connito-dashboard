import { Activity, CheckCircle2, Database, Gauge, Users, X } from "lucide-react";

import { formatBlock, formatBlockDuration, formatInteger, formatNumber } from "../format";
import type { DashboardModel } from "../types";
import { SectionTitle } from "./section-title";
import { UpcomingPhases } from "./upcoming-phases";

type PhasePanelsProps = {
  phase: DashboardModel["phase"];
  loadingUpcoming: boolean;
};

type RoundHealthPanelProps = {
  round: DashboardModel["round"];
  scoredPercent: number;
};

export function PhasePanels({ phase, loadingUpcoming }: PhasePanelsProps) {
  return (
    <section className="work-grid">
      <article className="phase-panel">
        <SectionTitle eyebrow="Current Phase" title={phase.name} />
        <div className="progress-track" title={`${formatNumber(phase.progress, 1)}%`}>
          <span className="progress-time-ratio">
            {formatBlockDuration(phase.cycleBlock)} / {formatBlockDuration(phase.blocksRemaining)}
          </span>
          <i style={{ width: `${phase.progress}%` }} />
          <span className="progress-cursor" style={{ left: `${phase.progress}%` }}>
            {formatNumber(phase.progress, 1)}%
          </span>
        </div>
        <div className="phase-stats">
          <div>
            <span>Head</span>
            <BlockValue blocks={phase.headBlock} />
          </div>
          <div>
            <span>Start</span>
            <BlockValue blocks={phase.phaseStart} />
          </div>
          <div>
            <span>End</span>
            <BlockValue blocks={phase.phaseEnd} />
          </div>
        </div>
      </article>

      <UpcomingPhases phases={phase.upcoming} loading={loadingUpcoming} />
    </section>
  );
}

function BlockValue({ blocks }: { blocks: number | null }) {
  return (
    <strong className="phase-block-value">
      <span>{formatBlock(blocks)}</span>
      <small>blocks</small>
    </strong>
  );
}

export function RoundHealthPanel({ round, scoredPercent }: RoundHealthPanelProps) {
  const stats = [
    { tone: "loss", label: "Loss", value: formatNumber(round.baselineLoss, 4), icon: <Gauge size={16} /> },
    { tone: "scored", label: "Scored", value: formatInteger(round.scored), icon: <CheckCircle2 size={16} /> },
    { tone: "pending", label: "Pending", value: formatInteger(round.pending), icon: <Activity size={16} /> },
    { tone: "failed", label: "Failed", value: formatInteger(round.failed), icon: <X size={16} /> },
    { tone: "roster", label: "Roster", value: formatInteger(round.roster), icon: <Users size={16} /> },
    { tone: "claimed", label: "Claimed", value: formatInteger(round.claimed), icon: <Database size={16} /> }
  ];

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
