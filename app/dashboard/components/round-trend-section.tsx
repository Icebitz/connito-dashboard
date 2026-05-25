import type { HistoryPoint } from "../types";
import { MiniLineChart } from "./mini-line-chart";
import { SectionTitle } from "./section-title";

type RoundTrendSectionProps = {
  points: HistoryPoint[];
  loading: boolean;
};

export function RoundTrendSection({ points, loading }: RoundTrendSectionProps) {
  return (
    <section className={`round-chart-section${loading ? " round-chart-section-skeleton" : ""}`} aria-busy={loading}>
      {loading ? (
        <>
          <div className="section-title section-title-skeleton" aria-hidden="true">
            <span />
            <h2 />
          </div>
          <div className="chart-box chart-box-skeleton" aria-hidden="true">
            <div className="chart-summary">
              <span />
              <strong />
            </div>
            <div className="chart-skeleton">
              <i />
            </div>
          </div>
        </>
      ) : (
        <>
          <SectionTitle eyebrow="Round Trend" title="Round Loss" />
          <MiniLineChart points={points} />
        </>
      )}
    </section>
  );
}
