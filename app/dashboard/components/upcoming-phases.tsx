import { formatBlock, formatBlockCount, formatBlockDuration, formatInteger } from "../format";
import type { UpcomingPhase } from "../types";
import { SectionTitle } from "./section-title";

type UpcomingPhasesProps = {
  phases: UpcomingPhase[];
  loading: boolean;
};

export function UpcomingPhases({ phases, loading }: UpcomingPhasesProps) {
  if (!phases.length) {
    if (!loading) {
      return null;
    }

    return (
      <section className="upcoming-phase-section" aria-label="Upcoming phases">
        <SectionTitle eyebrow="Upcoming Phases" />
        <div className="phase-timeline" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <article className={`phase-step phase-step-skeleton${index === 0 ? " phase-step-next" : ""}`} key={`phase-skeleton-${index}`}>
              <div className="phase-step-top">
                <span />
                <strong />
              </div>
              <div className="phase-step-values">
                <span className="phase-step-value phase-step-value-start">
                  <em />
                  <strong />
                </span>
                <span className="phase-step-value phase-step-value-range">
                  <em />
                  <strong />
                </span>
                <span className="phase-step-value phase-step-value-duration">
                  <em />
                  <strong />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="upcoming-phase-section" aria-label="Upcoming phases">
      <SectionTitle eyebrow="Upcoming Phases" />
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
                  <DurationWithBlocks blocks={phase.blocksUntilStart} />
                </span>
                <span className="phase-step-value phase-step-value-range">
                  <em>Blocks</em>
                  <strong>{blockRange}</strong>
                </span>
                <span className="phase-step-value phase-step-value-duration">
                  <em>{phase.duration === null ? "Actor" : "Duration"}</em>
                  {phase.duration === null ? <strong>{phase.actor ?? "-"}</strong> : <DurationWithBlocks blocks={phase.duration} />}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DurationWithBlocks({ blocks }: { blocks: number | null }) {
  return (
    <strong className="duration-with-blocks" title={formatBlockCount(blocks)}>
      <span>{formatBlockDuration(blocks)}</span>
      <small>{formatBlockCount(blocks)}</small>
    </strong>
  );
}
