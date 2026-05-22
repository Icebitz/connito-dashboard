import { formatBlock, formatBlockDuration, formatBlockDurationWithCount, formatInteger } from "../format";
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
        {phases.map((phase, index) => {
          const blockRange = phase.endBlock === null
            ? formatBlock(phase.startBlock)
            : `${formatBlock(phase.startBlock)} - ${formatBlock(phase.endBlock)}`;

          return (
            <article className={`phase-step${index === 0 ? " phase-step-next" : ""}`} key={`${phase.name}-${phase.startBlock}`}>
              <div className="phase-step-top">
                <span title={`${formatInteger(phase.blocksUntilStart)} blocks`}>{index === 0 ? "Next" : `+${formatBlockDuration(phase.blocksUntilStart)}`}</span>
                <strong>{phase.name}</strong>
              </div>
              <div className="phase-step-values">
                <span className="phase-step-value phase-step-value-start">
                  <em>Starts</em>
                  <strong>{formatBlockDurationWithCount(phase.blocksUntilStart)}</strong>
                </span>
                <span className="phase-step-value phase-step-value-range">
                  <em>Blocks</em>
                  <strong>{blockRange}</strong>
                </span>
                <span className="phase-step-value phase-step-value-duration">
                  <em>{phase.duration === null ? "Actor" : "Duration"}</em>
                  <strong>{phase.duration === null ? phase.actor ?? "-" : formatBlockDurationWithCount(phase.duration)}</strong>
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
