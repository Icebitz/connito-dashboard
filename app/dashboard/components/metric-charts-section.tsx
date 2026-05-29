import { formatNumber } from "../format";
import type { MinerRow } from "../types";
import { SectionTitle } from "./section-title";

type MetricBarChartProps = {
  title: string;
  label: string;
  rows: MinerRow[];
  metric: "loss" | "weight";
  digits: number;
  direction: "asc" | "desc";
};

function MetricBarChart({ title, label, rows, metric, digits, direction }: MetricBarChartProps) {
  const leaders = rows
    .filter((row) => row[metric] !== null)
    .sort((a, b) => {
      const aValue = a[metric] ?? Number.POSITIVE_INFINITY;
      const bValue = b[metric] ?? Number.POSITIVE_INFINITY;

      return direction === "asc" ? aValue - bValue : bValue - aValue;
    })
    .slice(0, 10);
  const values = leaders.map((row) => row[metric] ?? 0);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;

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
            const width = getBarWidth(value, min, max, direction);

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

function getBarWidth(value: number, min: number, max: number, direction: "asc" | "desc") {
  if (direction === "desc") {
    return max > 0 ? Math.max(2, (value / max) * 100) : 0;
  }

  if (max === min) {
    return 100;
  }

  return Math.max(8, ((max - value) / (max - min)) * 92 + 8);
}

type MetricChartsSectionProps = {
  rows: MinerRow[];
};

export function MetricChartsSection({ rows }: MetricChartsSectionProps) {
  return (
    <section className="metric-chart-section">
      <SectionTitle eyebrow="Leaderboard Metrics" title="Weights and Losses" />
      <div className="metric-chart-grid">
        <MetricBarChart title="Top Weights" label="Weight" rows={rows} metric="weight" digits={4} direction="desc" />
        <MetricBarChart title="Lowest Loss" label="Loss" rows={rows} metric="loss" digits={4} direction="asc" />
      </div>
    </section>
  );
}
