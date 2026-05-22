import { formatBlock, formatInteger } from "../format";
import type { UpcomingPhase } from "../types";
import { SectionTitle } from "./section-title";

type UpcomingPhasesProps = {
  phases: UpcomingPhase[];
};

export function UpcomingPhases({ phases }: UpcomingPhasesProps) {
  if (!phases.length) {
    return null;
  }

  return (
    <section className="upcoming-phase-section" aria-label="Upcoming phases">
      <SectionTitle eyebrow="Phase Schedule" title="Upcoming Phases" />
      <div className="phase-timeline">
        {phases.map((phase, index) => (
          <article className={`phase-step${index === 0 ? " phase-step-next" : ""}`} key={`${phase.name}-${phase.startBlock}`}>
            <div className="phase-step-top">
              <span>{index === 0 ? "Next" : `+${formatInteger(phase.blocksUntilStart)}`}</span>
              <strong>{phase.name}</strong>
            </div>
            <div className="phase-step-meta">
              <span>In {formatInteger(phase.blocksUntilStart)} blocks</span>
              <span>{formatBlock(phase.startBlock)} - {formatBlock(phase.endBlock)}</span>
              <span>{formatInteger(phase.duration)} blocks</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
