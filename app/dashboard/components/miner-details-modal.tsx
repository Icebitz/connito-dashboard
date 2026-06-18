"use client";

import { X } from "lucide-react";
import { useEffect, useMemo } from "react";

import { VALIDATOR_COLUMNS } from "../constants";
import { formatInteger, formatMetricNumber, shortText } from "../format";
import type { MinerRow, ValidatorHealth, ValidatorMetric } from "../types";

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
            <span id="miner-details-title">Miner #{row.uid}</span>
            <button type="button" className="miner-details-close" onClick={onClose} aria-label="Close miner details">
              <X size={16} />
            </button>
          </div>
          <div className="miner-details-shell-row miner-details-shell-hotkey">{row.hotkey}</div>
          <div className="miner-details-shell-row miner-details-shell-repo">
            <span>Repo:</span>
            <strong>{row.repo}</strong>
            <span className="miner-details-shell-spacer" />
            <span>Rev:</span>
            <strong>{row.revision}</strong>
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
                      <td>{metric?.uid ?? health?.uid ?? "-"}</td>
                      <td>{shortText(metric?.hotkey ?? health?.hotkey ?? "-", 6, 4)}</td>
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
  const series = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));

  if (series.length < 2) {
    return <div className="miner-details-empty">No loss trend data</div>;
  }

  const width = 860;
  const height = 150;
  const padLeft = 44;
  const padRight = 18;
  const padTop = 14;
  const padBottom = 18;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const graphWidth = width - padLeft - padRight;
  const graphHeight = height - padTop - padBottom;
  const xFor = (index: number) => padLeft + graphWidth * (index / Math.max(1, series.length - 1));
  const yFor = (value: number) => padTop + ((max - value) / range) * graphHeight;
  const line = series.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(value).toFixed(2)}`).join(" ");
  const area = `${line} L ${xFor(series.length - 1).toFixed(2)} ${height - padBottom} L ${xFor(0).toFixed(2)} ${height - padBottom} Z`;

  return (
    <div className="miner-details-loss-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Loss trend chart">
        <line className="miner-details-chart-baseline" x1={padLeft} x2={width - padRight} y1={height - padBottom} y2={height - padBottom} />
        <path className="miner-details-chart-area" d={area} />
        <path className="miner-details-chart-line" d={line} />
        {series.map((value, index) => (
          <circle key={`${index}-${value}`} className="miner-details-chart-point" cx={xFor(index)} cy={yFor(value)} r="2.8" />
        ))}
      </svg>
    </div>
  );
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

  return `${Math.max(0, Math.round(value))}s`;
}
