"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { formatInteger, formatNumber } from "../format";
import type { HistoryPoint } from "../types";

type MiniLineChartProps = {
  points: HistoryPoint[];
};

export function MiniLineChart({ points }: MiniLineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 960, height: 190 });

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
  }, [points.length]);

  if (points.length < 2) {
    return <div className="empty-state">Waiting for round history</div>;
  }

  const { width, height } = chartSize;
  const padX = 34;
  const padTop = 18;
  const padBottom = 28;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const graphWidth = width - padX * 2;
  const graphHeight = height - padTop - padBottom;
  const xFor = (index: number) => padX + graphWidth * (index / Math.max(1, points.length - 1));
  const yFor = (value: number) => padTop + ((max - value) / range) * graphHeight;
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(point.value).toFixed(2)}`).join(" ");
  const area = `${line} L ${xFor(points.length - 1).toFixed(2)} ${height - padBottom} L ${xFor(0).toFixed(2)} ${height - padBottom} Z`;
  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((value, index, array) => array.indexOf(value) === index);
  const latest = points[points.length - 1];
  const hovered = hoverIndex === null ? latest : points[hoverIndex];
  const hoveredX = xFor(hoverIndex ?? points.length - 1);
  const hoveredY = yFor(hovered.value);
  const tooltipX = hoveredX > width - 220 ? hoveredX - 172 : hoveredX + 14;
  const tooltipY = Math.max(10, Math.min(height - 62, hoveredY - 42));

  const updateHover = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round(((relativeX - padX) / graphWidth) * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, index)));
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
        <path className="chart-area" d={area} />
        <path className="chart-line" d={line} />
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
        {ticks.map((index) => (
          <g key={points[index].round}>
            <line className="chart-tick" x1={xFor(index)} x2={xFor(index)} y1={height - padBottom} y2={height - padBottom + 5} />
            <text x={xFor(index)} y={height - 10} textAnchor="middle">
              {formatInteger(points[index].round)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
