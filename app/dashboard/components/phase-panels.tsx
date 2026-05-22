import { Activity, CheckCircle2, Database, Gauge, Users, X } from "lucide-react";

import { formatBlock, formatInteger, formatNumber } from "../format";
import type { DashboardModel } from "../types";
import { SectionTitle } from "./section-title";

type PhasePanelsProps = {
  phase: DashboardModel["phase"];
  round: DashboardModel["round"];
  scoredPercent: number;
};

export function PhasePanels({ phase, round, scoredPercent }: PhasePanelsProps) {
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
            <span>Start</span>
            <strong>{formatBlock(phase.phaseStart)}</strong>
          </div>
          <div>
            <span>End</span>
            <strong>{formatBlock(phase.phaseEnd)}</strong>
          </div>
          <div>
            <span>Block</span>
            <strong>{formatInteger(phase.cycleBlock)} / {formatInteger(phase.cycleLength)}</strong>
          </div>
          <div>
            <span>Cycle</span>
            <strong>{formatInteger(phase.cycleIndex)}</strong>
          </div>
          <div>
            <span>Remain</span>
            <strong>{formatInteger(phase.blocksRemaining)}</strong>
          </div>
        </div>
      </article>

      <article className="round-panel">
        <SectionTitle eyebrow="Round Health" title={`${formatNumber(scoredPercent, 1)}% scored`} />
        <div className="round-stats">
          <div>
            <Gauge size={16} />
            <span>Loss</span>
            <strong>{formatNumber(round.baselineLoss, 4)}</strong>
          </div>
          <div>
            <CheckCircle2 size={16} />
            <span>Scored</span>
            <strong>{formatInteger(round.scored)}</strong>
          </div>
          <div>
            <Activity size={16} />
            <span>Pending</span>
            <strong>{formatInteger(round.pending)}</strong>
          </div>
          <div>
            <X size={16} />
            <span>Failed</span>
            <strong>{formatInteger(round.failed)}</strong>
          </div>
          <div>
            <Users size={16} />
            <span>Roster</span>
            <strong>{formatInteger(round.roster)}</strong>
          </div>
          <div>
            <Database size={16} />
            <span>Claimed</span>
            <strong>{formatInteger(round.claimed)}</strong>
          </div>
        </div>
      </article>
    </section>
  );
}
