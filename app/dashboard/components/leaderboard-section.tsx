import { AlertTriangle, BarChart3, Search, ShieldCheck, X } from "lucide-react";
import { Fragment } from "react";
import type { KeyboardEvent } from "react";

import { LEADERBOARD_COLUMN_COUNT, VALIDATOR_COLUMNS } from "../constants";
import { formatInteger, formatMetricNumber, formatNumber, formatPercent, getHotkeyUrl, getHuggingFaceRepoUrl, shortText } from "../format";
import { getMinerKey } from "../model";
import type { DashboardModel, MinerRow, ValidatorHealth, ValidatorMetric } from "../types";
import { SectionTitle } from "./section-title";

type LeaderboardSectionProps = {
  filteredRows: MinerRow[];
  query: string;
  selectedMinerKey: string | null;
  topMiner: MinerRow | undefined;
  burnPercent: number | null;
  meta: DashboardModel["meta"];
  onQueryChange: (value: string) => void;
  onToggleMinerDetails: (row: MinerRow) => void;
};

export function LeaderboardSection({
  filteredRows,
  query,
  selectedMinerKey,
  topMiner,
  burnPercent,
  meta,
  onQueryChange,
  onToggleMinerDetails
}: LeaderboardSectionProps) {
  return (
    <section className="leaderboard-section">
      <div className="leaderboard-header">
        <SectionTitle eyebrow="Leaderboard" title="Top Miners" />
        <label className="search-field">
          <Search size={15} />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search UID, hotkey, repo" />
          {query ? (
            <button type="button" onClick={() => onQueryChange("")} title="Clear search">
              <X size={14} />
            </button>
          ) : null}
        </label>
      </div>

      <LeaderboardSummaryStrip topMiner={topMiner} burnPercent={burnPercent} meta={meta} />

      <div className="table-frame">
        <table>
          <thead>
            <tr>
              <th className="rank-column">#</th>
              <th className="uid-column">UID</th>
              <th className="miner-column">Miner</th>
              <th className="revision-column">Revision</th>
              <th className="weight-column">Weight</th>
              <th className="loss-column">Loss</th>
              <th className="delta-loss-column">Delta</th>
              <th className="assigned-column">Assigned</th>
              <th className="validator-grid-column">Validators</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <LeaderboardRow
                key={getMinerKey(row)}
                row={row}
                validatorHealth={meta.validatorHealth}
                selected={selectedMinerKey === getMinerKey(row)}
                onToggleMinerDetails={onToggleMinerDetails}
              />
            ))}
            {!filteredRows.length ? (
              <tr>
                <td colSpan={LEADERBOARD_COLUMN_COUNT}>No miners match the current search.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type LeaderboardSummaryStripProps = {
  topMiner: MinerRow | undefined;
  burnPercent: number | null;
  meta: DashboardModel["meta"];
};

function LeaderboardSummaryStrip({ topMiner, burnPercent, meta }: LeaderboardSummaryStripProps) {
  const topMinerHotkeyUrl = topMiner ? getHotkeyUrl(topMiner.hotkey) : null;
  const topMinerRepoUrl = topMiner ? getHuggingFaceRepoUrl(topMiner.repo) : null;
  const liveValidators = meta.validatorHealth.length
    ? meta.validatorHealth.filter((validator) => getValidatorTone(validator) === "live").length
    : meta.polledValidatorCount ?? 0;
  const validatorTotal = meta.validatorCount ?? meta.validatorHealth.length;
  const validatorLabel = validatorTotal ? `${liveValidators}/${validatorTotal}` : "-";

  return (
    <div className="leaderboard-summary-strip">
      <div className="leaderboard-summary-card leaderboard-summary-primary">
        <BarChart3 size={17} />
        <div>
          <span>Top Chain Weight</span>
          <strong>{topMiner ? `${formatNumber(topMiner.weight, 6)}` : "-"}</strong>
        </div>
        <div className="summary-miner-target">
          <em>
            {topMiner && topMinerHotkeyUrl ? (
              <a className="table-link" href={topMinerHotkeyUrl} target="_blank" rel="noreferrer">
                UID {topMiner.uid}
              </a>
            ) : topMiner ? `UID ${topMiner.uid}` : "-"}
          </em>
          <small>
            {topMiner && topMinerRepoUrl ? (
              <a className="table-link" href={topMinerRepoUrl} target="_blank" rel="noreferrer">
                {shortText(topMiner.repo, 24, 0)}
              </a>
            ) : topMiner ? shortText(topMiner.repo, 24, 0) : "-"}
          </small>
        </div>
      </div>

      <div className="leaderboard-summary-card leaderboard-summary-compact">
        <span>Burn</span>
        <strong>{formatPercent(burnPercent, 2)}</strong>
      </div>

      <div className="leaderboard-summary-card validator-health-summary">
        <ShieldCheck size={17} />
        <div>
          <span>Validators</span>
          <strong>{validatorLabel} live</strong>
        </div>
        <div className="validator-health-chips" aria-label="Validator slot health">
          {VALIDATOR_COLUMNS.map((index) => {
            const health = getValidatorHealthForSlot(meta.validatorHealth, index);
            const tone = getValidatorTone(health);

            return (
              <span className={`validator-health-chip validator-health-${tone}`} key={`validator-health-${index}`} title={`Validator ${index + 1}: ${formatValidatorStatus(health?.status)}`}>
                V{index + 1}
              </span>
            );
          })}
        </div>
      </div>

      <div className={`leaderboard-summary-card source-summary${meta.stale ? " source-summary-stale" : ""}`}>
        {meta.stale ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
        <div>
          <span>{meta.servedFrom ?? "API"}</span>
          <strong>{meta.staleReason ? formatValidatorStatus(meta.staleReason) : "Current"}</strong>
        </div>
      </div>
    </div>
  );
}

type LeaderboardRowProps = {
  row: MinerRow;
  validatorHealth: ValidatorHealth[];
  selected: boolean;
  onToggleMinerDetails: (row: MinerRow) => void;
};

function LeaderboardRow({ row, validatorHealth, selected, onToggleMinerDetails }: LeaderboardRowProps) {
  const hotkeyUrl = getHotkeyUrl(row.hotkey);
  const repoUrl = getHuggingFaceRepoUrl(row.repo);
  const rowKey = getMinerKey(row);
  const detailsId = `miner-details-${row.rank}-${row.uid}`;
  const rowWeight = formatMetricNumber(row.weight, 4);
  const rowLoss = formatMetricNumber(row.loss, 4);
  const rowDeltaLoss = formatMetricNumber(row.deltaLoss, 4);

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input")) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggleMinerDetails(row);
    }
  };

  return (
    <Fragment>
      <tr
        className={`leaderboard-row${selected ? " leaderboard-row-selected" : ""}`}
        tabIndex={0}
        aria-expanded={selected}
        aria-controls={detailsId}
        title="Click for validator weight and loss details"
        onClick={() => onToggleMinerDetails(row)}
        onKeyDown={handleKeyDown}
      >
        <td className="rank-column">{row.rank}</td>
        <td className="uid-column">{row.uid}</td>
        <td className="miner-column" title={`${row.hotkey} ${row.repo}`}>
          <div className="miner-cell">
            <strong>
              {hotkeyUrl ? (
                <a className="table-link" href={hotkeyUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                  {shortText(row.hotkey, 8, 6)}
                </a>
              ) : shortText(row.hotkey, 8, 6)}
            </strong>
            <span>
              {repoUrl ? (
                <a className="table-link" href={repoUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                  {shortText(row.repo, 30, 0)}
                </a>
              ) : shortText(row.repo, 30, 0)}
            </span>
          </div>
        </td>
        <td className="revision-column" title={row.revision}>{shortText(row.revision, 10, 0)}</td>
        <td className="weight-column">{rowWeight}</td>
        <td className="loss-column">{rowLoss}</td>
        <td className="delta-loss-column">{rowDeltaLoss}</td>
        <td className="assigned-column">
          <span className={`assignment-pill assignment-${row.assigned === null ? "unknown" : row.assigned ? "yes" : "no"}`}>
            {row.assigned === null ? "-" : row.assigned ? "Yes" : "No"}
          </span>
        </td>
        <td className="validator-grid-column">
          <div className="validator-mini-grid" aria-label={`Validator metrics for UID ${row.uid}`}>
            {VALIDATOR_COLUMNS.map((index) => {
              const metric = getValidatorMetricForColumn(row, index);
              const health = getValidatorHealthForSlot(validatorHealth, index);
              const tone = getValidatorTone(health, metric);
              const valLoss = formatMetricNumber(metric?.valLoss, 4);
              const weight = formatMetricNumber(metric?.weightSubmitted, 4);

              return (
                <span
                  className={`validator-mini-card validator-mini-${tone}`}
                  key={`${rowKey}-validator-${index}`}
                  title={metric ? `${metric.label}: loss ${valLoss}, weight ${weight}` : `Validator ${index + 1}: ${formatValidatorStatus(health?.status)}`}
                >
                  <em>V{index + 1}</em>
                  <strong>{valLoss}</strong>
                  <small>{weight}</small>
                </span>
              );
            })}
          </div>
        </td>
      </tr>
      {selected ? (
        <tr className="leaderboard-details-row" id={detailsId}>
          <td className="leaderboard-details-cell" colSpan={LEADERBOARD_COLUMN_COUNT}>
            <MinerValidatorDetails row={row} />
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

function getValidatorMetricForColumn(row: MinerRow, index: number) {
  const hasSlots = row.validatorMetrics.some((metric) => metric.slot !== null);
  return hasSlots ? row.validatorMetrics.find((metric) => metric.slot === index + 1) : row.validatorMetrics[index];
}

function getValidatorHealthForSlot(validatorHealth: ValidatorHealth[], index: number) {
  return validatorHealth.find((validator) => validator.slot === index + 1);
}

function getValidatorTone(health: ValidatorHealth | undefined, metric?: ValidatorMetric) {
  const status = health?.status?.toLowerCase() ?? null;

  if (status === "live" && health?.chainActive !== false && health?.promReachable !== false) {
    return metric && metric.valLoss === null && metric.weightSubmitted === null ? "partial" : "live";
  }

  if (status === "down" || health?.chainActive === false || health?.promReachable === false) {
    return "down";
  }

  return metric ? "partial" : "missing";
}

function formatValidatorStatus(status: string | null | undefined) {
  return status ? status.replace(/_/g, " ") : "missing";
}

function formatEvalStatus(status: string | null | undefined) {
  if (!status) {
    return "-";
  }

  return status
    .replace(/^no_chain_commit$/, "no commit")
    .replace(/_/g, " ");
}

function MinerValidatorDetails({ row }: { row: MinerRow }) {
  const hotkeyUrl = getHotkeyUrl(row.hotkey);
  const repoUrl = getHuggingFaceRepoUrl(row.repo);

  return (
    <div className="miner-details">
      <div className="miner-summary-grid">
        <div className="miner-summary-item">
          <span>Revision</span>
          <strong title={row.revision}>{shortText(row.revision, 10, 0)}</strong>
        </div>
        <div className="miner-summary-item miner-summary-important">
          <span>Reports</span>
          <strong>{formatInteger(row.validatorMetrics.length)}</strong>
        </div>
        <div className="miner-summary-item miner-summary-important">
          <span>Val Loss</span>
          <strong>{formatMetricNumber(row.loss, 6)}</strong>
        </div>
        <div className="miner-summary-item miner-summary-important">
          <span>Weight</span>
          <strong>{formatMetricNumber(row.weight, 4)}</strong>
        </div>
        <div className="miner-summary-item miner-summary-important">
          <span>Delta Loss</span>
          <strong>{formatMetricNumber(row.deltaLoss, 6)}</strong>
        </div>
        <div className="miner-summary-item">
          <span>Assigned</span>
          <strong>{row.assigned === null ? "-" : row.assigned ? "Yes" : "No"}</strong>
        </div>
        <div className="miner-summary-item miner-summary-wide">
          <span>Hotkey</span>
          <strong title={row.hotkey}>
            {hotkeyUrl ? (
              <a className="table-link" href={hotkeyUrl} target="_blank" rel="noreferrer">
                {shortText(row.hotkey, 10, 7)}
              </a>
            ) : shortText(row.hotkey, 10, 7)}
          </strong>
        </div>
        <div className="miner-summary-item miner-summary-wide">
          <span>Repository</span>
          <strong title={row.repo}>
            {repoUrl ? (
              <a className="table-link" href={repoUrl} target="_blank" rel="noreferrer">
                {shortText(row.repo, 18, 0)}
              </a>
            ) : shortText(row.repo, 18, 0)}
          </strong>
        </div>
      </div>

      <div className="validator-detail-frame">
        <table className="validator-detail-table" aria-label={`Validator metrics for UID ${row.uid}`}>
          <thead>
            <tr>
              <th>Label</th>
              <th>Slot</th>
              <th>Status</th>
              <th>Chain UID</th>
              <th>Val Loss</th>
              <th>Weight</th>
              <th>Block</th>
              <th>Eval</th>
            </tr>
          </thead>
          <tbody>
            {row.validatorMetrics.length ? (
              row.validatorMetrics.map((metric, index) => (
                <tr key={`${metric.label}-${metric.uid ?? "uid"}-${metric.slot ?? "slot"}-${index}`}>
                  <td>{metric.label}</td>
                  <td>{formatInteger(metric.slot)}</td>
                  <td>{metric.validatorStatus ?? "-"}</td>
                  <td>{formatInteger(metric.chainUid)}</td>
                  <td title={metric.valLoss === null ? undefined : String(metric.valLoss)}>{formatMetricNumber(metric.valLoss, 6)}</td>
                  <td>{formatMetricNumber(metric.weightSubmitted, 4)}</td>
                  <td>{formatInteger(metric.extractedAtBlock)}</td>
                  <td title={metric.failureReasons.length ? metric.failureReasons.join(", ") : undefined}>{formatEvalStatus(metric.evalStatusLabel)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>No validator metrics reported for this miner.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
