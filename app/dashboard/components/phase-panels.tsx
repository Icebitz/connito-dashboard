import { Activity, CheckCircle2, Database, Gauge, Users, X } from "lucide-react";

import { formatBlock, formatBlockCount, formatBlockDuration, formatInteger, formatNumber } from "../format";
import type { DashboardModel } from "../types";
import { SectionTitle } from "./section-title";
import { UpcomingPhases } from "./upcoming-phases";

type PhasePanelsProps = {
  phase: DashboardModel["phase"];
};

type RoundHealthPanelProps = {
  round: DashboardModel["round"];
  scoredPercent: number;
};

export function PhasePanels({ phase }: PhasePanelsProps) {
  return (
    <section className="work-grid">
      <article className="phase-panel">
        <SectionTitle eyebrow="Current Phase" title={phase.name} />
        <div className="progress-track" title={`${formatNumber(phase.progress, 1)}%`}>
          <i style={{ width: `${phase.progress}%` }} />
        </div>
        <div className="phase-stats">
          <div>
            <span>Head</span>
            <strong>{formatBlock(phase.headBlock)}</strong>
          </div>
          <div>
            <span>Progress</span>
            <strong>{formatNumber(phase.progress, 1)}%</strong>
          </div>
          <div>
            <span>Start</span>
            <strong>{formatBlock(phase.phaseStart)}</strong>
          </div>
          <div>
            <span>End</span>
            <strong>{formatBlock(phase.phaseEnd)}</strong>
          </div>
          <div>
            <span>Elapsed</span>
            <PhaseTimeValue blocks={phase.cycleBlock} />
          </div>
          <div>
            <span>Remain</span>
            <PhaseTimeValue blocks={phase.blocksRemaining} />
          </div>
        </div>
      </article>

      <UpcomingPhases phases={phase.upcoming} />
    </section>
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

function PhaseTimeValue({ blocks }: { blocks: number | null }) {
  const title = formatBlockCount(blocks);

  return (
    <strong className="phase-time-value" title={title}>
      <em>{formatBlockDuration(blocks)}</em>
      <small>{title}</small>
    </strong>
  );
}
