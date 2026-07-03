"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { VALIDATOR_COLUMNS } from "../constants";
import { formatAgeSecondsShort, formatInteger, formatMetricNumber, shortText } from "../format";
import { formatStatusLabel, statusTone } from "../status";
import type { MinerRow, ValidatorHealth, ValidatorMetric } from "../types";
import { CopyHotkeyButton } from "./copy-hotkey-button";

type MinerDetailsModalProps = {
  row: MinerRow;
  validatorHealth: ValidatorHealth[];
  onClose: () => void;
};

export function MinerDetailsModal({ row, validatorHealth, onClose }: MinerDetailsModalProps) {
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
    () => VALIDATOR_COLUMNS.map((index) => ({
      index,
      metric: getValidatorMetricForColumn(row, index),
      health: getValidatorHealthForSlot(validatorHealth, index)
    })),
    [row, validatorHealth]
  );

  const statusLabel = getRowStatusLabel(row);
  const commitmentLabel = row.committedRecently || row.committedThisCycle ? "Committed" : "Not committed";

  return (
    <div
      className="lb-modal-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="lb-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="miner-details-title"
        aria-describedby="miner-details-description"
      >
        <header className="lb-modal-header">
          <div className="lb-modal-heading">
            <div className="lb-modal-title-row">
              <h2 id="miner-details-title">UID {row.uid}</h2>
              <div className="lb-modal-badges">
                <span className={`lb-pill lb-pill-${statusTone(statusLabel)}`}>{statusLabel}</span>
                <span className="lb-pill lb-pill-neutral">{commitmentLabel}</span>
                <span className="lb-pill lb-pill-neutral">Group {row.cohortGroup ?? "-"}</span>
              </div>
            </div>
            <div className="lb-modal-meta" id="miner-details-description">
              <span>Hotkey &nbsp;<CopyHotkeyButton value={row.hotkey} className="lb-copy-button lb-copy-button-inline" start={10} end={7} /></span>
              <span>Revision {shortText(row.revision, 14, 8)}</span>
              <span>Last Commit Block {formatInteger(row.lastObservedCommitBlock)}</span>
              <span>Lag {formatInteger(row.lastObservedCommitBlockLag)}</span>
            </div>
          </div>

          <button type="button" className="lb-icon-button lb-modal-close" onClick={onClose} aria-label="Close miner details">
            <X size={16} />
          </button>
        </header>

        <div className="lb-modal-body">
          <div className="lb-modal-summary-grid">
            <SummaryTile label="Incentive" value={formatMetricNumber(row.incentive, 4)} />
            <SummaryTile label="Chain Weight" value={formatMetricNumber(row.weight, 4)} />
            <SummaryTile label="Latest Loss" value={formatMetricNumber(row.loss, 4)} />
            <SummaryTile label="Delta Loss" value={formatMetricNumber(row.deltaLoss, 4)} />
            <SummaryTile label="Avg Val Loss" value={formatMetricNumber(getAverageValidatorLoss(row), 4)} />
          </div>

          <section className="lb-modal-block">
            <LossTrendChart values={row.lossTrend} />
          </section>

          <section className="lb-modal-block">
            <div className="lb-modal-block-head">
              <span>Validator Metrics</span>
              <strong>{`${validatorRows.length} slots`}</strong>
            </div>
            <div className="lb-modal-table-wrap">
              <table className="lb-modal-table">
                <thead>
                  <tr>
                    <th>Slot</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Val Loss</th>
                    <th>Latest Score</th>
                    <th>Avg Score</th>
                    <th>Rank</th>
                    <th>Weight</th>
                    <th>Failure</th>
                  </tr>
                </thead>
                <tbody>
                  {validatorRows.map(({ index, metric, health }) => (
                    <tr key={`${row.uid}-validator-${index}`}>
                      <td>{`V${index + 1}`}</td>
                      <td>{formatAssignmentRole(metric?.assignmentRole)}</td>
                      <td>
                        <span className={`lb-pill lb-pill-${statusTone(metric?.evalStatusLabel ?? health?.status)}`}>
                          {formatStatusLabel(metric?.evalStatusLabel ?? health?.status)}
                        </span>
                      </td>
                      <td>{formatMetricNumber(metric?.valLoss, 4)}</td>
                      <td>{formatMetricNumber(metric?.scoreLatest ?? metric?.score, 4)}</td>
                      <td>{formatMetricNumber(metric?.scoreAverage, 4)}</td>
                      <td>{formatValidatorRank(metric)}</td>
                      <td>{formatMetricNumber(metric?.weightSubmitted, 4)}</td>
                      <td>{metric?.failureReasons.length ? metric.failureReasons[0] : "-"}</td>
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
    <div className="lb-modal-summary-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LossTrendChart({ values }: { values: Array<number | null> }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 960, height: 180 });
  const points = values.map((value, index) => ({
    index,
    value: value !== null && value !== undefined && Number.isFinite(value) ? value : null
  }));
  const series = points.flatMap((point) => (point.value === null ? [] : [point.value]));

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const syncSize = (rect: DOMRectReadOnly) => {
      const nextWidth = Math.round(rect.width);
      const nextHeight = Math.round(rect.height);

      if (nextWidth > 0 && nextHeight > 0) {
        setChartSize((current) => (
          current.width === nextWidth && current.height === nextHeight
            ? current
            : { width: nextWidth, height: nextHeight }
        ));
      }
    };

    syncSize(svg.getBoundingClientRect());

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      syncSize(entry.contentRect);
    });

    observer.observe(svg);
    return () => observer.disconnect();
  }, [values.length]);

  if (!values.length) {
    return <div className="lb-empty-state">No loss trend data</div>;
  }

  const width = Math.max(1, chartSize.width);
  const height = Math.max(1, chartSize.height);
  const padLeft = 56;
  const padRight = 24;
  const padTop = 16;
  const padBottom = 24;
  const hasValidPoints = series.length > 0;
  const min = hasValidPoints ? Math.min(...series) : 0;
  const max = hasValidPoints ? Math.max(...series) : 1;
  const range = max - min || 1;
  const graphWidth = width - padLeft - padRight;
  const graphHeight = height - padTop - padBottom;
  const xFor = (index: number) => padLeft + graphWidth * (index / Math.max(1, values.length - 1));
  const yFor = (value: number) => padTop + ((max - value) / range) * graphHeight;
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

  const linePaths = segments.map((segment) => segment.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" "));
  const firstPoint = points.find((point) => point.value !== null);
  const lastPoint = [...points].reverse().find((point) => point.value !== null);
  const lineEndX = lastPoint ? xFor(lastPoint.index).toFixed(2) : xFor(0).toFixed(2);
  const area = hasValidPoints && firstPoint && lastPoint && linePaths.length > 0
    ? `${linePaths[0]} L ${lineEndX} ${height - padBottom} L ${firstPoint ? xFor(firstPoint.index).toFixed(2) : xFor(0).toFixed(2)} ${height - padBottom} Z`
    : "";
  const hoveredPoint = hoveredIndex === null ? null : points[hoveredIndex] ?? null;
  const hoveredX = hoveredPoint ? xFor(hoveredPoint.index) : null;
  const hoveredY = hoveredPoint ? (hoveredPoint.value === null ? height - padBottom : yFor(hoveredPoint.value)) : null;
  const tooltipWidth = 164;
  const tooltipHeight = 52;
  const hoveredTooltipX = hoveredX === null ? null : Math.max(10, Math.min(width - tooltipWidth - 10, hoveredX + 12));
  const hoveredTooltipY = hoveredY === null ? null : Math.max(10, Math.min(height - tooltipHeight - 10, hoveredY - 40));
  const latest = rowLikeLatest(series, values);

  const updateHover = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round(((relativeX - padLeft) / graphWidth) * (values.length - 1));
    setHoveredIndex(Math.max(0, Math.min(values.length - 1, index)));
  };

  return (
    <div className="lb-loss-chart">
      <div className="lb-loss-chart-summary">
        <span>Loss trend</span>
        <strong>{formatMetricNumber(latest, 4)}</strong>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Loss trend chart"
        onMouseLeave={() => setHoveredIndex(null)}
        onMouseMove={updateHover}
        onPointerLeave={() => setHoveredIndex(null)}
      >
        <g className="lb-loss-chart-grid" aria-hidden="true">
          {series.length > 0
            ? Array.from({ length: 4 }, (_, index) => {
                const value = max - (range * index) / 3;
                const y = yFor(value);

                return (
                  <g key={`grid-${index}`}>
                    <line x1={padLeft} x2={width - padRight} y1={y} y2={y} />
                    <text x={padLeft - 10} y={y} textAnchor="end" dominantBaseline="middle">
                      {formatMetricNumber(value, 3)}
                    </text>
                  </g>
                );
              })
            : null}
        </g>
        <line className="lb-loss-chart-baseline" x1={padLeft} x2={width - padRight} y1={height - padBottom} y2={height - padBottom} />
        {area ? <path className="lb-loss-chart-area" d={area} /> : null}
        {linePaths.map((d, index) => <path key={`line-${index}`} className="lb-loss-chart-line" d={d} />)}
        {points.map((point) => {
          if (point.value === null) {
            return (
              <circle
                key={`missing-${point.index}`}
                className="lb-loss-chart-point lb-loss-chart-point-missing"
                cx={xFor(point.index)}
                cy={height - padBottom - 2}
                r="3"
              />
            );
          }

          const y = yFor(point.value);

          return (
            <circle
              key={`${point.index}-${point.value}`}
              className={`lb-loss-chart-point${hoveredIndex === point.index ? " lb-loss-chart-point-active" : ""}`}
              cx={xFor(point.index)}
              cy={y}
              r={hoveredIndex === point.index ? "4.8" : "3.1"}
              onPointerEnter={() => setHoveredIndex(point.index)}
            >
              <title>{`Sample ${point.index + 1}: ${formatMetricNumber(point.value, 4)}`}</title>
            </circle>
          );
        })}
        {points.map((point, index) => (
          <g key={`tick-${point.index}`}>
            <line className="lb-loss-chart-tick" x1={xFor(index)} x2={xFor(index)} y1={height - padBottom} y2={height - padBottom + 5} />
            <text className="lb-loss-chart-sample-label" x={xFor(index)} y={height - 10} textAnchor="middle">
              {index + 1}
            </text>
          </g>
        ))}
        {hoveredX !== null && hoveredY !== null ? (
          <line className="lb-loss-chart-hover-line" x1={hoveredX} x2={hoveredX} y1={padTop} y2={height - padBottom} />
        ) : null}
        {hoveredPoint && hoveredTooltipX !== null && hoveredTooltipY !== null ? (
          <g className="lb-loss-chart-tooltip" transform={`translate(${hoveredTooltipX} ${hoveredTooltipY})`}>
            <rect width={tooltipWidth} height={tooltipHeight} />
            <text x="10" y="19">Sample {hoveredPoint.index + 1}</text>
            <text x="10" y="39">{hoveredPoint.value === null ? "missing" : `Loss ${formatMetricNumber(hoveredPoint.value, 4)}`}</text>
          </g>
        ) : null}
      </svg>
      <div className="lb-loss-chart-footnote">
        <span>First {formatMetricNumber(firstValue(values), 4)}</span>
        <span>Latest {formatMetricNumber(lastValue(values), 4)}</span>
        <span>Best {formatMetricNumber(bestValue(values), 4)}</span>
        <span>Worst {formatMetricNumber(worstValue(values), 4)}</span>
        <span>Δ {formatMetricNumber(deltaValue(values), 4)}</span>
      </div>
    </div>
  );
}

function firstValue(values: Array<number | null>) {
  return values.find((value) => value !== null && value !== undefined && Number.isFinite(value)) ?? null;
}

function lastValue(values: Array<number | null>) {
  const reversed = [...values].reverse();
  return reversed.find((value) => value !== null && value !== undefined && Number.isFinite(value)) ?? null;
}

function bestValue(values: Array<number | null>) {
  const series = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return series.length ? Math.min(...series) : null;
}

function worstValue(values: Array<number | null>) {
  const series = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return series.length ? Math.max(...series) : null;
}

function deltaValue(values: Array<number | null>) {
  const first = firstValue(values);
  const last = lastValue(values);

  if (first === null || last === null) {
    return null;
  }

  return last - first;
}

function formatLossTrendSummary(values: Array<number | null>) {
  const first = firstValue(values);
  const latest = lastValue(values);
  const best = bestValue(values);
  const worst = worstValue(values);
  const delta = deltaValue(values);

  return [
    `First ${formatMetricNumber(first, 4)}`,
    `Latest ${formatMetricNumber(latest, 4)}`,
    `Best ${formatMetricNumber(best, 4)}`,
    `Worst ${formatMetricNumber(worst, 4)}`,
    `Δ ${formatMetricNumber(delta, 4)}`
  ].join(" · ");
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

function getAverageValidatorLoss(row: MinerRow) {
  const values = row.validatorMetrics
    .map((metric) => metric.valLoss)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));

  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function getValidatorMetricForColumn(row: MinerRow, index: number) {
  const hasSlots = row.validatorMetrics.some((metric) => metric.slot !== null);
  return hasSlots ? row.validatorMetrics.find((metric) => metric.slot === index + 1) : row.validatorMetrics[index];
}

function getValidatorHealthForSlot(validatorHealth: ValidatorHealth[], index: number) {
  return validatorHealth.find((validator) => validator.slot === index + 1);
}

function formatAssignmentRole(role: string | null | undefined) {
  return formatStatusLabel(role);
}

function formatValidatorRank(metric: ValidatorMetric | undefined) {
  if (!metric || metric.rank === null) {
    return "-";
  }

  return metric.rankTotal === null ? formatInteger(metric.rank) : `${formatInteger(metric.rank)} / ${formatInteger(metric.rankTotal)}`;
}

function getRowStatusLabel(row: MinerRow) {
  if (row.uid === "0") {
    return "Burn";
  }

  if (row.weight === null || row.weight === 0) {
    return "No Weight";
  }

  if (row.evaluatedThisRound === false) {
    return "Pending";
  }

  return "OK";
}
