"use client";

import { useMemo } from "react";

import { VALIDATOR_COLUMNS } from "../constants";
import { formatAgeSecondsShort, formatInteger, shortText } from "../format";
import { formatStatusLabel, statusTone } from "../status";
import type { MinerRow, ValidatorHealth, ValidatorMetric } from "../types";

type ValidatorsSectionProps = {
  rows: MinerRow[];
  validatorHealth: ValidatorHealth[];
};

type ValidatorSummaryRow = {
  index: number;
  label: string;
  hotkey: string;
  status: string;
  chainActive: boolean | null;
  promReachable: boolean | null;
  sampleAge: number | null;
  scored: number | null;
  commits: number | null;
  failed: number | null;
};

export function ValidatorsSection({ rows, validatorHealth }: ValidatorsSectionProps) {
  const validatorRows = useMemo(() => {
    return VALIDATOR_COLUMNS.map((index) => buildValidatorSummary(rows, validatorHealth, index));
  }, [rows, validatorHealth]);
  const liveCount = validatorRows.filter((row) => row.status.trim().toLowerCase() === "live").length;

  return (
    <section className="lb-validator lb-panel">
      <div className="lb-section-top">
        <div className="lb-section-title">
          <span>Validators</span>
          <strong>{`${liveCount} live · ${validatorRows.length} slots`}</strong>
        </div>
      </div>

      <div className="lb-table-frame">
        <table className="lb-table lb-validator-table">
          <thead>
            <tr>
              <th className="lb-validator-slot">Slot</th>
              <th className="lb-validator-name">Name</th>
              <th className="lb-validator-hotkey">Hotkey</th>
              <th className="lb-validator-status">Status</th>
              <th className="lb-validator-flag">Chain Active</th>
              <th className="lb-validator-flag">Prometheus</th>
              <th className="lb-validator-age">Sample Age</th>
              <th className="lb-validator-num">Scored</th>
              <th className="lb-validator-num">Commits</th>
              <th className="lb-validator-num">Failed</th>
            </tr>
          </thead>
          <tbody>
            {validatorRows.map((validator) => (
              <tr key={`validator-${validator.index}`}>
                <td className="lb-validator-slot">{`V${validator.index + 1}`}</td>
                <td className="lb-validator-name" title={validator.label}>
                  {validator.label}
                </td>
                <td className="lb-validator-hotkey" title={validator.hotkey}>
                  {shortText(validator.hotkey, 12, 8)}
                </td>
                <td className="lb-validator-status">
                  <span className={`lb-pill lb-pill-${statusTone(validator.status)}`}>{formatStatusLabel(validator.status)}</span>
                </td>
                <td className="lb-validator-flag">{booleanText(validator.chainActive)}</td>
                <td className="lb-validator-flag">{booleanText(validator.promReachable)}</td>
                <td className="lb-validator-age">{formatAgeSecondsShort(validator.sampleAge)}</td>
                <td className="lb-validator-num">{formatInteger(validator.scored)}</td>
                <td className="lb-validator-num">{formatInteger(validator.commits)}</td>
                <td className="lb-validator-num">{formatInteger(validator.failed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildValidatorSummary(rows: MinerRow[], validatorHealth: ValidatorHealth[], index: number): ValidatorSummaryRow {
  const health = validatorHealth.find((validator) => validator.slot === index + 1);
  const metrics = rows
    .map((row) => getValidatorMetricForColumn(row, index))
    .filter((metric): metric is ValidatorMetric => Boolean(metric));

  const scored = metrics.filter((metric) => hasMetricValue(metric.scoreLatest) || hasMetricValue(metric.score) || hasMetricValue(metric.scoreAverage) || hasMetricValue(metric.valLoss)).length;
  const commits = metrics.filter((metric) => hasMetricValue(metric.weightSubmitted) || hasMetricValue(metric.lastObservedCommitBlock) || Boolean(metric.assignmentRole)).length;
  const failed = metrics.filter((metric) => Boolean(metric.failureReasons.length) || !isOkStatus(metric.evalStatusLabel)).length;
  const fallbackMetric = metrics[0];
  const hasMetrics = metrics.length > 0;

  return {
    index,
    label: health?.label ?? fallbackMetric?.label ?? `Validator ${index + 1}`,
    hotkey: health?.hotkey ?? fallbackMetric?.hotkey ?? "-",
    status: normalizeStatus(health?.status ?? deriveValidatorStatus(health, metrics)),
    chainActive: health?.chainActive ?? null,
    promReachable: health?.promReachable ?? null,
    sampleAge: health?.lastPromSampleAgeSeconds ?? null,
    scored: hasMetrics ? scored : null,
    commits: hasMetrics ? commits : null,
    failed: hasMetrics ? failed : null
  };
}

function getValidatorMetricForColumn(row: MinerRow, index: number) {
  const hasSlots = row.validatorMetrics.some((metric) => metric.slot !== null);
  return hasSlots ? row.validatorMetrics.find((metric) => metric.slot === index + 1) : row.validatorMetrics[index];
}

function hasMetricValue(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function booleanText(value: boolean | null) {
  if (value === null) {
    return "-";
  }

  return value ? "Yes" : "No";
}

function normalizeStatus(status: string | null | undefined) {
  return status ? status.trim().toLowerCase() : "missing";
}

function deriveValidatorStatus(health: ValidatorHealth | undefined, metrics: ValidatorMetric[]) {
  if (health?.chainActive === false || health?.promReachable === false) {
    return "down";
  }

  if (!metrics.length) {
    return "unconfigured";
  }

  const failed = metrics.filter((metric) => Boolean(metric.failureReasons.length) || !isOkStatus(metric.evalStatusLabel)).length;
  return failed > 0 ? "partial" : "live";
}

function isOkStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() === "ok";
}
