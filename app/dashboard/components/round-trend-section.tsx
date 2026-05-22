import type { HistoryPoint } from "../types";
import { MiniLineChart } from "./mini-line-chart";
import { SectionTitle } from "./section-title";

type RoundTrendSectionProps = {
  points: HistoryPoint[];
};

export function RoundTrendSection({ points }: RoundTrendSectionProps) {
  return (
    <section className="round-chart-section">
      <SectionTitle eyebrow="Round Trend" title="Round Loss" />
      <MiniLineChart points={points} />
    </section>
  );
}
