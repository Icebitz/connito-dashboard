import { BarChart3, Search, X } from "lucide-react";
import { Fragment } from "react";
import type { KeyboardEvent } from "react";

import { LEADERBOARD_COLUMN_COUNT, VALIDATOR_COLUMNS } from "../constants";
import { formatInteger, formatMetricNumber, formatNumber, formatPercent, getHotkeyUrl, getHuggingFaceRepoUrl, shortText } from "../format";
import { getMinerKey } from "../model";
import type { MinerRow } from "../types";
import { SectionTitle } from "./section-title";

type LeaderboardSectionProps = {
  filteredRows: MinerRow[];
  query: string;
  selectedMinerKey: string | null;
  topMiner: MinerRow | undefined;
  burnPercent: number | null;
  onQueryChange: (value: string) => void;
  onToggleMinerDetails: (row: MinerRow) => void;
};

export function LeaderboardSection({
  filteredRows,
  query,
  selectedMinerKey,
  topMiner,
  burnPercent,
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

      <TopMinerStrip topMiner={topMiner} burnPercent={burnPercent} />

      <div className="table-frame">
        <table>
          <thead>
            <tr>
              <th className="rank-column">#</th>
              <th className="uid-column">UID</th>
              <th className="hotkey-column">Hotkey</th>
              <th className="repo-column">Repository</th>
              <th className="revision-column">Revision</th>
              <th className="weight-column">Weight</th>
              <th className="loss-column">Loss</th>
              <th className="delta-loss-column">Delta</th>
              <th className="assigned-column">Assigned</th>
              {VALIDATOR_COLUMNS.map((index) => (
                <Fragment key={`validator-heading-${index}`}>
                  <th className={`validator-metric-heading validator-${index + 1}-column`} title={`Validator ${index + 1} evaluation status`}>
                    V{index + 1} Eval
                  </th>
                  <th className={`validator-metric-heading validator-${index + 1}-column`} title={`Validator ${index + 1} val loss`}>
                    V{index + 1} Loss
                  </th>
                  <th className={`validator-metric-heading validator-${index + 1}-column`} title={`Validator ${index + 1} average score`}>
                    V{index + 1} Score
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <LeaderboardRow
                key={getMinerKey(row)}
                row={row}
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

type TopMinerStripProps = {
  topMiner: MinerRow | undefined;
  burnPercent: number | null;
};

function TopMinerStrip({ topMiner, burnPercent }: TopMinerStripProps) {
  const topMinerHotkeyUrl = topMiner ? getHotkeyUrl(topMiner.hotkey) : null;
  const topMinerRepoUrl = topMiner ? getHuggingFaceRepoUrl(topMiner.repo) : null;

  return (
    <div className="top-miner-strip">
      <div className="top-miner-info">
        <BarChart3 size={17} />
        <span>Top Chain Weight</span>
        <em>{topMiner ? `${formatNumber(topMiner.weight, 6)}` : "-"}</em>
        <strong>
          {topMiner && topMinerHotkeyUrl ? (
            <a className="table-link" href={topMinerHotkeyUrl} target="_blank" rel="noreferrer">
              UID {topMiner.uid}
            </a>
          ) : topMiner ? `UID ${topMiner.uid}` : "-"}
        </strong>
        <small>
          {topMiner && topMinerRepoUrl ? (
            <a className="table-link" href={topMinerRepoUrl} target="_blank" rel="noreferrer">
              {shortText(topMiner.repo, 22, 0)}
            </a>
          ) : topMiner ? shortText(topMiner.repo, 22, 0) : "-"}
        </small>
      </div>
      <div className="burn-info">
        <span>Burn</span>
        <em>{formatPercent(burnPercent, 2)}</em>
      </div>
    </div>
  );
}

type LeaderboardRowProps = {
  row: MinerRow;
  selected: boolean;
  onToggleMinerDetails: (row: MinerRow) => void;
};

function LeaderboardRow({ row, selected, onToggleMinerDetails }: LeaderboardRowProps) {
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
        title="Click for validator score and loss details"
        onClick={() => onToggleMinerDetails(row)}
        onKeyDown={handleKeyDown}
      >
        <td className="rank-column">{row.rank}</td>
        <td className="uid-column">{row.uid}</td>
        <td className="hotkey-column" title={row.hotkey}>
          {hotkeyUrl ? (
            <a className="table-link" href={hotkeyUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
              {shortText(row.hotkey, 8, 6)}
            </a>
          ) : shortText(row.hotkey, 8, 6)}
        </td>
        <td className="repo-column" title={row.repo}>
          {repoUrl ? (
            <a className="table-link" href={repoUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
              {shortText(row.repo, 24, 0)}
            </a>
          ) : shortText(row.repo, 24, 0)}
        </td>
        <td className="revision-column" title={row.revision}>{shortText(row.revision, 10, 0)}</td>
        <td className="weight-column">{rowWeight}</td>
        <td className="loss-column">{rowLoss}</td>
        <td className="delta-loss-column">{rowDeltaLoss}</td>
        <td className="assigned-column">{row.assigned === null ? "-" : row.assigned ? "Yes" : "No"}</td>
        {VALIDATOR_COLUMNS.map((index) => {
          const metric = getValidatorMetricForColumn(row, index);
          const score = formatMetricNumber(metric?.score, 4);
          const valLoss = formatMetricNumber(metric?.valLoss, 4);
          const evalStatus = formatEvalStatus(metric?.evalStatusLabel);

          return (
            <Fragment key={`${rowKey}-validator-${index}`}>
              <td
                className={`validator-metric-cell validator-status-cell validator-${index + 1}-column`}
                title={metric ? `${metric.label} eval ${metric.evalStatusLabel ?? "-"}${metric.failureReasons.length ? ` (${metric.failureReasons.join(", ")})` : ""}` : undefined}
              >
                {evalStatus}
              </td>
              <td
                className={`validator-metric-cell validator-${index + 1}-column`}
                title={metric ? `${metric.label} val loss ${valLoss}` : undefined}
              >
                {valLoss}
              </td>
              <td
                className={`validator-metric-cell validator-${index + 1}-column`}
                title={metric ? `${metric.label} score ${score}` : undefined}
              >
                {score}
              </td>
            </Fragment>
          );
        })}
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
          <span>Score</span>
          <strong>{formatMetricNumber(row.score, 4)}</strong>
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
              <th>Eval</th>
              <th>Score</th>
              <th>Val Loss</th>
              <th>Weight</th>
              <th>Samples</th>
            </tr>
          </thead>
          <tbody>
            {row.validatorMetrics.length ? (
              row.validatorMetrics.map((metric, index) => (
                <tr key={`${metric.label}-${metric.uid ?? "uid"}-${metric.slot ?? "slot"}-${index}`}>
                  <td>{metric.label}</td>
                  <td>{formatInteger(metric.slot)}</td>
                  <td>{metric.validatorStatus ?? "-"}</td>
                  <td title={metric.failureReasons.length ? metric.failureReasons.join(", ") : undefined}>{formatEvalStatus(metric.evalStatusLabel)}</td>
                  <td>{formatMetricNumber(metric.score, 4)}</td>
                  <td title={metric.valLoss === null ? undefined : String(metric.valLoss)}>{formatMetricNumber(metric.valLoss, 6)}</td>
                  <td>{formatMetricNumber(metric.weightSubmitted, 4)}</td>
                  <td>{formatInteger(metric.scoreSamples)}</td>
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
