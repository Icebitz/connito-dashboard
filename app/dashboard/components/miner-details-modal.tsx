"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";

import { VALIDATOR_COLUMNS } from "../constants";
import { formatInteger, formatMetricNumber, shortText } from "../format";
import type { MinerRow, ValidatorHealth, ValidatorMetric } from "../types";
import { CopyHotkeyButton } from "./copy-hotkey-button";

type MinerDetailsModalProps = {
  row: MinerRow;
  validatorHealth: ValidatorHealth[];
  onClose: () => void;
  onOpenHistory: (uids: string[]) => void;
};

export function MinerDetailsModal({ row, validatorHealth, onClose, onOpenHistory }: MinerDetailsModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const validatorRows = useMemo(
    () => VALIDATOR_COLUMNS.map((index) => {
      const metric = getValidatorMetricForColumn(row, index);
      const health = getValidatorHealthForSlot(validatorHealth, index);

      return {
        index,
        metric,
        health
      };
    }),
    [row, validatorHealth]
  );

  return (
    <div className="miner-details-overlay" role="presentation" onClick={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <section
        className="miner-details-dialog miner-details-terminal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="miner-details-title"
        aria-describedby="miner-details-description"
      >
        <div className="miner-details-shell-header">
          <div className="miner-details-shell-topline">
            <div className="miner-details-shell-title-group">
              <span id="miner-details-title">Miner #{row.uid}</span>
              <span className="miner-details-shell-divider" aria-hidden="true">|</span>
              <span className="miner-details-shell-label">Hotkey</span>
              <CopyHotkeyButton value={row.hotkey} className="miner-details-shell-value hotkey-copy-button" start={10} end={7} />
              <span className="miner-details-shell-divider" aria-hidden="true">|</span>
              <span className="miner-details-shell-label">HF Repo</span>
              <strong className="miner-details-shell-value">{shortText(row.repo, 18, 10)}</strong>
              <span className="miner-details-shell-divider" aria-hidden="true">|</span>
              <span className="miner-details-shell-label">Rev</span>
              <strong className="miner-details-shell-value">{shortText(row.revision, 12, 6)}</strong>
            </div>
            <button type="button" className="miner-details-close" onClick={onClose} aria-label="Close miner details">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="miner-details-scroll">
          <div className="miner-details-summary-grid">
            <SummaryTile label="Rank" value={`#${row.rank}`} />
            <SummaryTile label="Weight" value={formatMetricNumber(row.weight, 4)} />
            <SummaryTile label="Loss" value={formatMetricNumber(row.loss, 4)} />
            <SummaryTile label="Delta" value={formatMetricNumber(row.deltaLoss, 4)} />
            <SummaryTile label="Incent." value={formatMetricNumber(row.incentive, 4)} />
          </div>

          <div className="miner-details-meta-row">
            <span className="miner-details-group-pill">Group {row.cohortGroup ?? "-"}</span>
            <span>Age: {formatAgeSeconds(row.scoreLatestAgeSeconds)}</span>
          </div>

          <section className="miner-details-block">
            <div className="miner-details-block-title">Loss Trend</div>
            <LossTrendChart values={row.lossTrend} />
          </section>

          <section className="miner-details-block">
            <div className="miner-details-block-title">
              <span>Validators ({validatorRows.length})</span>
            </div>
            <div className="miner-details-table-wrap">
              <table className="miner-details-table">
                <thead>
                  <tr>
                    <th>Slot</th>
                    <th>UID</th>
                    <th>Hotkey</th>
                    <th>Role</th>
                    <th>Loss</th>
                    <th>Score</th>
                    <th>Avg</th>
                    <th>Rank</th>
                    <th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {validatorRows.map(({ index, metric, health }) => (
                    <tr key={`${row.uid}-validator-${index}`}>
                      <td>{index + 1}</td>
                      <td>{metric?.chainUid ?? metric?.uid ?? health?.uid ?? "-"}</td>
                      <td>
                        <CopyHotkeyButton value={metric?.hotkey ?? health?.hotkey ?? "-"} className="hotkey-copy-button" start={6} end={4} />
                      </td>
                      <td>{formatAssignmentRole(metric?.assignmentRole)}</td>
                      <td>{formatMetricNumber(metric?.valLoss, 4)}</td>
                      <td>{formatMetricNumber(metric?.scoreLatest, 4)}</td>
                      <td>{formatMetricNumber(metric?.scoreAverage, 4)}</td>
                      <td>{formatValidatorRank(metric)}</td>
                      <td>{formatAgeSeconds(metric?.scoreLatestAgeSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="miner-details-summary-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LossTrendChart({ values }: { values: Array<number | null> }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const points = values
    .map((value, index) => ({
      index,
      value: value !== null && value !== undefined && Number.isFinite(value) ? value : null
    }));
  const series = points.flatMap((point) => (point.value === null ? [] : [point.value]));

  if (values.length === 0) {
    return <div className="miner-details-empty">No loss trend data</div>;
  }

  const width = 960;
  const height = 160;
  const padLeft = 54;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 24;
  const hasValidPoints = series.length > 0;
  const min = hasValidPoints ? Math.min(...series) : 0;
  const max = hasValidPoints ? Math.max(...series) : 1;
  const range = max - min || 1;
  const graphWidth = width - padLeft - padRight;
  const graphHeight = height - padTop - padBottom;
  const xFor = (index: number) => padLeft + graphWidth * (index / Math.max(1, values.length - 1));
  const yFor = (value: number) => padTop + ((max - value) / range) * graphHeight;
  const ticks = Array.from({ length: values.length }, (_, index) => index);
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let currentSegment: Array<{ x: number; y: number }> = [];

  points.forEach((point) => {
    if (point.value === null) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
      return;
    }

    currentSegment.push({ x: xFor(point.index), y: yFor(point.value) });
  });

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  const linePaths = segments.map((segment) => segment.map((point, segmentIndex) => `${segmentIndex === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" "));
  const firstPoint = points.find((point) => point.value !== null);
  const lastPoint = [...points].reverse().find((point) => point.value !== null);
  const area = hasValidPoints && firstPoint && lastPoint && linePaths.length > 0
    ? `${linePaths[0]} L ${lastPoint ? xFor(lastPoint.index).toFixed(2) : xFor(0).toFixed(2)} ${height - padBottom} L ${firstPoint ? xFor(firstPoint.index).toFixed(2) : xFor(0).toFixed(2)} ${height - padBottom} Z`
    : "";
  const missingY = height - padBottom - 2;
  const hoveredPoint = hoveredIndex === null ? null : points[hoveredIndex] ?? null;
  const hoveredValue = hoveredPoint?.value ?? null;
  const hoveredX = hoveredPoint ? xFor(hoveredPoint.index) : null;
  const hoveredY = hoveredPoint ? (hoveredPoint.value === null ? missingY : yFor(hoveredPoint.value)) : null;
  const hoveredTooltipX = hoveredX === null
    ? null
    : hoveredX > width - 200 ? hoveredX - 162 : hoveredX + 14;
  const hoveredTooltipY = hoveredY === null ? null : Math.max(12, Math.min(height - 66, hoveredY - 46));

  const updateHover = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round(((relativeX - padLeft) / graphWidth) * (values.length - 1));
    setHoveredIndex(Math.max(0, Math.min(values.length - 1, index)));
  };

  const summaryValue = hoveredValue ?? rowLikeLatest(series, values);

  return (
    <div className="miner-details-loss-chart chart-box">
      <div className="chart-summary">
        <span>Loss trend</span>
        <strong>{formatMetricNumber(summaryValue, 4)}</strong>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Loss trend chart"
        onMouseLeave={() => setHoveredIndex(null)}
        onMouseMove={updateHover}
        onPointerLeave={() => setHoveredIndex(null)}
      >
        <g className="miner-details-chart-grid" aria-hidden="true">
          {series.length > 0
            ? Array.from({ length: 4 }, (_, index) => {
                const value = max - (range * index) / 3;
                const y = yFor(value);

                return (
                  <g key={`grid-${index}`}>
                    <line className="miner-details-chart-grid-line" x1={padLeft} x2={width - padRight} y1={y} y2={y} />
                    <text x={padLeft - 10} y={y} textAnchor="end" dominantBaseline="middle">
                      {formatMetricNumber(value, 3)}
                    </text>
                  </g>
                );
              })
            : null}
        </g>
        <line className="miner-details-chart-baseline" x1={padLeft} x2={width - padRight} y1={height - padBottom} y2={height - padBottom} />
        {hoveredX !== null && hoveredY !== null ? (
          <line
            className="miner-details-chart-hover-line"
            x1={hoveredX}
            x2={hoveredX}
            y1={padTop}
            y2={height - padBottom}
          />
        ) : null}
        {area ? <path className="miner-details-chart-area" d={area} /> : null}
        {linePaths.map((d, index) => (
          <path key={`line-${index}`} className="miner-details-chart-line" d={d} />
        ))}
        {points.map((point) => {
          if (point.value === null) {
            return (
              <circle
                key={`missing-${point.index}`}
                className="miner-details-chart-point miner-details-chart-point-missing"
                cx={xFor(point.index)}
                cy={missingY}
                r="3.8"
              />
            );
          }

          return (
            <circle
              key={`${point.index}-${point.value}`}
              className={`miner-details-chart-point${hoveredIndex === point.index ? " miner-details-chart-point-active" : ""}`}
              cx={xFor(point.index)}
              cy={yFor(point.value)}
              r={hoveredIndex === point.index ? "5" : "3.1"}
              onPointerEnter={() => setHoveredIndex(point.index)}
            >
              <title>{`Sample ${point.index + 1}: ${formatMetricNumber(point.value, 4)}`}</title>
            </circle>
          );
        })}
        {ticks.map((tickIndex) => {
          const point = points[tickIndex];
          if (!point) {
            return null;
          }

          return (
            <g key={`tick-${tickIndex}`}>
              <line className="miner-details-chart-tick" x1={xFor(tickIndex)} x2={xFor(tickIndex)} y1={height - padBottom} y2={height - padBottom + 5} />
              <text x={xFor(tickIndex)} y={height - 10} textAnchor="middle">
                {tickIndex + 1}
              </text>
            </g>
          );
        })}
        {hoveredPoint && hoveredTooltipX !== null && hoveredTooltipY !== null ? (
          <g className="miner-details-chart-tooltip-svg" transform={`translate(${hoveredTooltipX} ${hoveredTooltipY})`}>
            <rect width="158" height="52" rx="8" />
            <text x="10" y="19">Sample {hoveredPoint.index + 1}</text>
            <text x="10" y="39">{hoveredValue === null ? "missing" : `Loss ${formatMetricNumber(hoveredValue, 4)}`}</text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function rowLikeLatest(series: number[], values: Array<number | null>) {
  const latestIndex = [...values].reverse().findIndex((value) => value !== null && value !== undefined && Number.isFinite(value));
  if (latestIndex === -1) {
    return series.length > 0 ? series[series.length - 1] : 0;
  }

  const actualIndex = values.length - 1 - latestIndex;
  const latest = values[actualIndex];
  return typeof latest === "number" ? latest : (series[series.length - 1] ?? 0);
}

function getValidatorMetricForColumn(row: MinerRow, index: number) {
  const hasSlots = row.validatorMetrics.some((metric) => metric.slot !== null);
  return hasSlots ? row.validatorMetrics.find((metric) => metric.slot === index + 1) : row.validatorMetrics[index];
}

function getValidatorHealthForSlot(validatorHealth: ValidatorHealth[], index: number) {
  return validatorHealth.find((validator) => validator.slot === index + 1);
}

function formatAssignmentRole(role: string | null | undefined) {
  return role ? role.replace(/_/g, " ") : "-";
}

function formatValidatorRank(metric: ValidatorMetric | undefined) {
  if (!metric || metric.rank === null) {
    return "-";
  }

  return metric.rankTotal === null ? formatInteger(metric.rank) : `${formatInteger(metric.rank)} / ${formatInteger(metric.rankTotal)}`;
}

function formatAgeSeconds(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const totalSeconds = Math.max(0, Math.round(value));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}
