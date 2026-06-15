"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { formatInteger, formatNumber } from "../format";
import type { HistoryPoint } from "../types";

type MiniLineChartProps = {
  points: HistoryPoint[];
};

type ChartPoint = {
  x: number;
  y: number;
};

function buildLinearPath(chartPoints: ChartPoint[]) {
  if (chartPoints.length === 0) {
    return "";
  }

  if (chartPoints.length === 1) {
    const point = chartPoints[0];
    return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  return chartPoints.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    return `${path} L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");
}

export function MiniLineChart({ points }: MiniLineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 960, height: 190 });
  const visiblePoints = points.slice(-20);

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
  }, [visiblePoints.length]);

  if (visiblePoints.length < 2) {
    return <div className="empty-state">Waiting for round history</div>;
  }

  const { width, height } = chartSize;
  const padLeft = 58;
  const padRight = 28;
  const padTop = 18;
  const padBottom = 28;
  const values = visiblePoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rawRange = max - min;
  const range = rawRange || 1;
  const graphWidth = width - padLeft - padRight;
  const graphHeight = height - padTop - padBottom;
  const xFor = (index: number) => padLeft + graphWidth * (index / Math.max(1, visiblePoints.length - 1));
  const yFor = (value: number) => padTop + ((max - value) / range) * graphHeight;
  const chartPoints = visiblePoints.map((point, index) => ({ x: xFor(index), y: yFor(point.value) }));
  const line = buildLinearPath(chartPoints);
  const area = `${line} L ${xFor(visiblePoints.length - 1).toFixed(2)} ${height - padBottom} L ${xFor(0).toFixed(2)} ${height - padBottom} Z`;
  const valueTicks = rawRange === 0
    ? [max]
    : Array.from({ length: 5 }, (_, index) => max - (rawRange * index) / 4);
  const latest = visiblePoints[visiblePoints.length - 1];
  const boundedHoverIndex = hoverIndex === null ? null : Math.min(hoverIndex, visiblePoints.length - 1);
  const hovered = boundedHoverIndex === null ? latest : visiblePoints[boundedHoverIndex];
  const hoveredX = xFor(boundedHoverIndex ?? visiblePoints.length - 1);
  const hoveredY = yFor(hovered.value);
  const tooltipX = hoveredX > width - 220 ? hoveredX - 172 : hoveredX + 14;
  const tooltipY = Math.max(10, Math.min(height - 62, hoveredY - 42));

  const updateHover = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round(((relativeX - padLeft) / graphWidth) * (visiblePoints.length - 1));
    setHoverIndex(Math.max(0, Math.min(visiblePoints.length - 1, index)));
  };

  return (
    <div className="chart-box">
      <div className="chart-summary">
        <span>Baseline loss</span>
        <strong>{formatNumber(hovered.value, 4)}</strong>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Baseline loss history"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={updateHover}
      >
        <g className="chart-value-grid" aria-hidden="true">
          {valueTicks.map((value) => {
            const y = yFor(value);

            return (
              <g key={value}>
                <line x1={padLeft} x2={width - padRight} y1={y} y2={y} />
                <text x={padLeft - 8} y={y} textAnchor="end" dominantBaseline="middle">
                  {formatNumber(value, 3)}
                </text>
              </g>
            );
          })}
        </g>
        <path className="chart-area" d={area} />
        <path className="chart-line" d={line} />
        {chartPoints.map((point, index) => (
          <circle
            aria-hidden="true"
            className="chart-dot"
            cx={point.x}
            cy={point.y}
            key={`${visiblePoints[index].round}-${index}`}
            r="3.25"
          />
        ))}
        {hoverIndex !== null ? (
          <>
            <line className="chart-hover-line" x1={hoveredX} x2={hoveredX} y1={padTop} y2={height - padBottom} />
            <circle className="chart-hover-dot" cx={hoveredX} cy={hoveredY} r="5" />
            <g className="chart-tooltip-svg" transform={`translate(${tooltipX} ${tooltipY})`}>
              <rect width="158" height="52" rx="8" />
              <text x="10" y="19">Round {formatInteger(hovered.round)}</text>
              <text x="10" y="39">Loss {formatNumber(hovered.value, 4)}</text>
            </g>
          </>
        ) : null}
        {visiblePoints.map((point, index) => (
          <g key={point.round}>
            <line className="chart-tick" x1={xFor(index)} x2={xFor(index)} y1={height - padBottom} y2={height - padBottom + 5} />
            <text x={xFor(index)} y={height - 10} textAnchor="middle">
              {formatInteger(point.round)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
