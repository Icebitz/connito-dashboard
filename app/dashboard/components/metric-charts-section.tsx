import { formatNumber } from "../format";
import type { MinerRow } from "../types";
import { SectionTitle } from "./section-title";

type MetricBarChartProps = {
  title: string;
  label: string;
  rows: MinerRow[];
  metric: "score" | "weight";
  digits: number;
};

function MetricBarChart({ title, label, rows, metric, digits }: MetricBarChartProps) {
  const leaders = rows
    .filter((row) => row[metric] !== null)
    .sort((a, b) => (b[metric] ?? Number.NEGATIVE_INFINITY) - (a[metric] ?? Number.NEGATIVE_INFINITY))
    .slice(0, 10);
  const max = Math.max(...leaders.map((row) => row[metric] ?? 0), 0);

  return (
    <article className="metric-chart-card">
      <div className="metric-chart-head">
        <span>{label}</span>
        <strong>{title}</strong>
      </div>
      {leaders.length ? (
        <div className="metric-bars">
          {leaders.map((row, index) => {
            const value = row[metric] ?? 0;
            const width = max > 0 ? Math.max(2, (value / max) * 100) : 0;

            return (
              <div className="metric-bar-row" key={`${metric}-${row.uid}-${row.hotkey}`} title={`UID ${row.uid} ${label.toLowerCase()} ${formatNumber(value, digits)}`}>
                <span>{index + 1}</span>
                <strong>UID {row.uid}</strong>
                <div className="metric-bar-track">
                  <i style={{ width: `${width}%` }} />
                </div>
                <em>{formatNumber(value, digits)}</em>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">Waiting for leaderboard data</div>
      )}
    </article>
  );
}

type MetricChartsSectionProps = {
  rows: MinerRow[];
};

export function MetricChartsSection({ rows }: MetricChartsSectionProps) {
  return (
    <section className="metric-chart-section">
      <SectionTitle eyebrow="Leaderboard Metrics" title="Weights and Scores" />
      <div className="metric-chart-grid">
        <MetricBarChart title="Top Weights" label="Weight" rows={rows} metric="weight" digits={4} />
        <MetricBarChart title="Top Scores" label="Score" rows={rows} metric="score" digits={4} />
      </div>
    </section>
  );
}
