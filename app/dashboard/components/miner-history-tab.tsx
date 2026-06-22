"use client";

import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { VALIDATOR_COLUMNS } from "../constants";
import { formatDuration, formatInteger, formatMetricNumber, formatNumber, shortText } from "../format";
import { Notice } from "./notice";
import { SectionTitle } from "./section-title";
import { CopyHotkeyButton } from "./copy-hotkey-button";

type MinerHistoryTabProps = {
  selectedMinerUids: string[];
};

type MinerHistoryApiResponse = {
  fetchedAt?: string;
  ok?: boolean;
  source?: string;
  data?: unknown;
  error?: string;
};

type MinerHistoryValidatorPoint = {
  slot: number;
  rank: number | null;
  rankTotal: number | null;
  loss: number | null;
  scoreLatest: number | null;
  scoreAverage: number | null;
};

type MinerHistoryRow = {
  timestamp: number;
  validators: MinerHistoryValidatorPoint[];
};

type MinerHistoryModel = {
  minerUid: string;
  hotkey: string | null;
  fetchedAt: string | null;
  startIso: string | null;
  endIso: string | null;
  stepSeconds: number | null;
  rows: MinerHistoryRow[];
  servedFrom: string | null;
};

type SeriesPoint = [number, number | null];

const EMPTY_METRIC_VALUE = "-";

export function MinerHistoryTab({ selectedMinerUids }: MinerHistoryTabProps) {
  const [activeMinerUids, setActiveMinerUids] = useState<string[]>(selectedMinerUids);
  const [minerInput, setMinerInput] = useState(selectedMinerUids.join(", "));
  const [histories, setHistories] = useState<MinerHistoryApiResponse[]>([]);
  const [historyPageIndex, setHistoryPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setActiveMinerUids(selectedMinerUids);
    setMinerInput(selectedMinerUids.join(", "));
    setHistories([]);
    setHistoryPageIndex(0);
  }, [selectedMinerUids]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async (uids: string[]) => {
    if (!uids.length) {
      setHistories([]);
      setError("Select miners from the leaderboard or enter miner UIDs.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requestTime = Date.now();
      const historyResponses = await Promise.all(uids.map(async (minerUid) => {
        const response = await fetch(`/api/miner/${encodeURIComponent(minerUid)}/history?t=${requestTime}`, { cache: "no-store" });
        const body = (await response.json()) as MinerHistoryApiResponse;

        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? `Miner history request failed for UID ${minerUid}.`);
        }

        return body;
      }));

      setHistories(historyResponses);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to refresh miner history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selectedMinerUids);
  }, [load, selectedMinerUids]);

  const historyModels = useMemo(
    () => histories.map((history, index) => buildMinerHistoryModel(history, activeMinerUids[index] ?? "")),
    [histories, activeMinerUids]
  );
  const latestFetchedAt = getLatestFetchedAt(historyModels);
  const fetchedAtMs = latestFetchedAt ? new Date(latestFetchedAt).getTime() : Number.NaN;
  const syncCounter = Number.isFinite(fetchedAtMs) ? formatAgeSeconds(nowMs - fetchedAtMs) : "-";
  const pageUids = activeMinerUids.length ? activeMinerUids : historyModels.map((historyModel) => historyModel.minerUid);
  const historyPageCount = pageUids.length;
  const boundedHistoryPageIndex = historyPageCount ? Math.min(historyPageIndex, historyPageCount - 1) : 0;
  const visibleHistoryModel = historyModels[boundedHistoryPageIndex] ?? (pageUids[boundedHistoryPageIndex] ? buildMinerHistoryModel(null, pageUids[boundedHistoryPageIndex]) : null);
  const visibleHistoryUid = visibleHistoryModel?.minerUid ?? pageUids[boundedHistoryPageIndex] ?? "";

  return (
    <section className="miner-history-view">
      <div className="miner-history-nav">
        <SectionTitle eyebrow="History" title="Miner Scores" />
        <form
          className="miner-history-search"
          onSubmit={(event) => {
            event.preventDefault();
            const uids = getMinerUids(minerInput);
            setActiveMinerUids(uids);
            setHistories([]);
            setHistoryPageIndex(0);
            void load(uids);
          }}
        >
          <label className="search-field miner-history-search-field">
            <Search size={15} />
            <input
              aria-label="Miner UID history"
              value={minerInput}
              onChange={(event) => setMinerInput(event.target.value)}
              placeholder="Miner UID, e.g. 132"
            />
          </label>
          <button type="submit" className="miner-history-search-button">History</button>
        </form>
        <span>Synced {syncCounter} ago</span>
      </div>

      <Notice message={error} />

      <div className="miner-history-panels">
        {historyPageCount ? (
          <section className="miner-history-panel" key={`miner-history-panel-${visibleHistoryUid}`}>
            <div className="miner-history-panel-top">
              <div className="miner-history-title-block">
                <SectionTitle eyebrow="Miner History" />
                <MinerHistoryPager
                  uids={pageUids}
                  activeIndex={boundedHistoryPageIndex}
                  onSelect={setHistoryPageIndex}
                />
                <div className="miner-history-identity">
                  <strong>
                    <CopyHotkeyButton
                      value={visibleHistoryModel?.hotkey ?? "-"}
                      className="hotkey-copy-button"
                      start={18}
                      end={8}
                    />
                  </strong>
                  <span>{visibleHistoryModel?.servedFrom ? `served from ${visibleHistoryModel.servedFrom}` : "series history"}</span>
                </div>
              </div>
              <div className="miner-history-panel-actions">
                <div className="miner-history-meta-strip" aria-label={`History summary for UID ${visibleHistoryUid}`}>
                  <HistoryMeta label="Points" value={formatNumber(visibleHistoryModel?.rows.length ?? 0, 0)} />
                  <HistoryMeta label="Step" value={visibleHistoryModel?.stepSeconds ? formatDuration(visibleHistoryModel.stepSeconds * 1000) : "-"} />
                  <HistoryMeta label="Oldest" value={visibleHistoryModel?.rows.length ? formatHistoryDate(visibleHistoryModel.rows[visibleHistoryModel.rows.length - 1].timestamp) : "-"} />
                  <HistoryMeta label="Newest" value={visibleHistoryModel?.rows.length ? formatHistoryDate(visibleHistoryModel.rows[0].timestamp) : "-"} />
                </div>
                <button type="button" className="miner-history-refresh-button" onClick={() => void load(activeMinerUids)} disabled={loading} title="Refresh miner history">
                  <RefreshCw size={15} className={loading ? "spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>

            <MinerHistoryTable model={visibleHistoryModel ?? buildMinerHistoryModel(null, pageUids[boundedHistoryPageIndex] ?? "")} loading={loading && !historyModels.length} />
          </section>
        ) : (
          <section className="miner-history-panel">
            <div className="miner-history-panel-top">
              <SectionTitle eyebrow="Miner History" title="No miners selected" />
            </div>
            <MinerHistoryTable model={buildMinerHistoryModel(null, activeMinerUids[0] ?? "")} loading={loading} />
          </section>
        )}
      </div>
    </section>
  );
}

function HistoryMeta({ label, value }: { label: string; value: string }) {
  return (
    <span className="miner-history-meta-item">
      <em>{label}</em>
      <strong>{value}</strong>
    </span>
  );
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

function MinerHistoryPager({ uids, activeIndex, onSelect }: { uids: string[]; activeIndex: number; onSelect: (index: number) => void }) {
  const previousDisabled = activeIndex <= 0;
  const nextDisabled = activeIndex >= uids.length - 1;
  const pagerItems = getMinerHistoryPagerItems(uids, activeIndex);

  return (
    <nav className="miner-history-pager" aria-label="Miner history UID pages">
      <button
        type="button"
        className="miner-history-page-arrow"
        onClick={() => onSelect(Math.max(0, activeIndex - 1))}
        disabled={previousDisabled}
        aria-label="Previous miner history"
        title="Previous miner"
      >
        <ChevronLeft size={15} />
      </button>
      <div className="miner-history-page-list">
        {pagerItems.map((item) => (
          item.type === "ellipsis" ? (
            <span className="miner-history-page-ellipsis" key={item.key} aria-hidden="true">...</span>
          ) : (
            <button
              type="button"
              className={item.index === activeIndex ? "miner-history-page-button miner-history-page-active" : "miner-history-page-button"}
              key={`miner-history-page-${item.uid}-${item.index}`}
              onClick={() => onSelect(item.index)}
              aria-current={item.index === activeIndex ? "page" : undefined}
              title={`Show history for UID ${item.uid}`}
            >
              {item.uid}
            </button>
          )
        ))}
      </div>
      <button
        type="button"
        className="miner-history-page-arrow"
        onClick={() => onSelect(Math.min(uids.length - 1, activeIndex + 1))}
        disabled={nextDisabled}
        aria-label="Next miner history"
        title="Next miner"
      >
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}

function getMinerHistoryPagerItems(uids: string[], activeIndex: number) {
  if (uids.length <= 9) {
    return uids.map((uid, index) => ({ type: "page" as const, uid, index }));
  }

  const lastIndex = uids.length - 1;
  const visibleIndexes = new Set<number>([0, lastIndex]);

  if (activeIndex <= 3) {
    for (let index = 0; index <= 4; index += 1) {
      visibleIndexes.add(index);
    }
  } else if (activeIndex >= lastIndex - 3) {
    for (let index = lastIndex - 4; index <= lastIndex; index += 1) {
      visibleIndexes.add(index);
    }
  } else {
    visibleIndexes.add(activeIndex - 1);
    visibleIndexes.add(activeIndex);
    visibleIndexes.add(activeIndex + 1);
  }

  const sortedIndexes = Array.from(visibleIndexes).filter((index) => index >= 0 && index <= lastIndex).sort((a, b) => a - b);
  return sortedIndexes.flatMap((index, itemIndex) => {
    const items: Array<{ type: "page"; uid: string; index: number } | { type: "ellipsis"; key: string }> = [];
    const previousIndex = sortedIndexes[itemIndex - 1];

    if (previousIndex !== undefined && index - previousIndex > 1) {
      items.push({ type: "ellipsis", key: `ellipsis-${previousIndex}-${index}` });
    }

    items.push({ type: "page", uid: uids[index], index });
    return items;
  });
}

function MinerHistoryTable({ model, loading }: { model: MinerHistoryModel; loading: boolean }) {
  if (loading) {
    return <p className="miner-history-empty">Loading miner history...</p>;
  }

  if (!model.rows.length) {
    return <p className="miner-history-empty">No miner history points returned for this UID.</p>;
  }

  return (
    <div className="score-history-scroll miner-history-scroll">
      <table className="score-history-table miner-history-table" aria-label={`Validator history for miner UID ${model.minerUid}`}>
        <thead>
          <tr>
            <th>Time</th>
            {VALIDATOR_COLUMNS.map((index) => (
              <th key={`miner-history-validator-${index}`}>V{index + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr key={`miner-history-${row.timestamp}`}>
              <td className="score-history-round-cell miner-history-time-cell" title={formatHistoryDate(row.timestamp)}>
                <span>{formatHistoryDate(row.timestamp)}</span>
              </td>
              {VALIDATOR_COLUMNS.map((index) => {
                const validator = row.validators.find((point) => point.slot === index + 1);

                return (
                  <td key={`miner-history-${row.timestamp}-validator-${index}`} title={formatHistoryValidatorTitle(row.timestamp, validator)}>
                    <HistoryValidatorPointCell validator={validator} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryValidatorPointCell({ validator }: { validator: MinerHistoryValidatorPoint | undefined }) {
  return (
    <span className="validator-mini-card score-history-mini-card miner-history-mini-card">
      <strong className="validator-mini-rank-metric" title="Rank"><span>R</span>{formatHistoryRank(validator)}</strong>
      <strong className="validator-mini-loss-metric" title="Loss"><span>L</span>{formatHistoryMetric(validator?.loss, 4)}</strong>
      <small className="validator-mini-weight-metric" title="Latest score"><span>S</span>{formatHistoryMetric(validator?.scoreLatest, 3)}</small>
      <small className="validator-mini-eval-metric" title="Average score"><span>A</span>{formatHistoryMetric(validator?.scoreAverage, 3)}</small>
    </span>
  );
}

function buildMinerHistoryModel(response: MinerHistoryApiResponse | null, fallbackMinerUid: string): MinerHistoryModel {
  const payload = isRecord(response?.data) ? response.data : {};
  const data = isRecord(payload.data) ? payload.data : {};
  const range = isRecord(data.range) ? data.range : {};
  const meta = isRecord(payload.meta) ? payload.meta : {};
  const minerUid = asText(data.miner_uid) ?? fallbackMinerUid;
  const startUnix = asNumber(range.start_unix);
  const endUnix = asNumber(range.end_unix);

  return {
    minerUid,
    hotkey: asText(data.hotkey),
    fetchedAt: asText(response?.fetchedAt),
    startIso: asText(range.start_iso),
    endIso: asText(range.end_iso),
    stepSeconds: asNumber(range.step_seconds),
    rows: buildHistoryRows(isRecord(data.series) ? data.series : {}, startUnix, endUnix),
    servedFrom: asText(meta.served_from)
  };
}

function buildHistoryRows(series: Record<string, unknown>, startUnix: number | null, endUnix: number | null): MinerHistoryRow[] {
  const timestamps = new Set<number>();
  const slots = new Set<number>();

  for (const seriesName of ["val_loss", "score_latest", "score_avg", "rank", "rank_total"]) {
    const metricSeries = isRecord(series[seriesName]) ? series[seriesName] : {};

    for (const [slotKey, rawPoints] of Object.entries(metricSeries)) {
      const slot = asNumber(slotKey);
      if (slot === null) {
        continue;
      }

      slots.add(slot);
      for (const point of getSeriesPoints(rawPoints)) {
        const timestamp = point[0];
        if ((startUnix === null || timestamp >= startUnix) && (endUnix === null || timestamp <= endUnix)) {
          timestamps.add(timestamp);
        }
      }
    }
  }

  return Array.from(timestamps)
    .sort((a, b) => b - a)
    .map((timestamp) => ({
      timestamp,
      validators: Array.from(slots)
        .sort((a, b) => a - b)
        .map((slot) => ({
          slot,
          rank: getSeriesValue(series, "rank", slot, timestamp, startUnix, endUnix),
          rankTotal: getSeriesValue(series, "rank_total", slot, timestamp, startUnix, endUnix),
          loss: getSeriesValue(series, "val_loss", slot, timestamp, startUnix, endUnix),
          scoreLatest: getSeriesValue(series, "score_latest", slot, timestamp, startUnix, endUnix),
          scoreAverage: getSeriesValue(series, "score_avg", slot, timestamp, startUnix, endUnix)
        }))
    }));
}

function getSeriesValue(series: Record<string, unknown>, seriesName: string, slot: number, timestamp: number, startUnix: number | null, endUnix: number | null) {
  const metricSeries = isRecord(series[seriesName]) ? series[seriesName] : {};
  const points = getSeriesPoints(metricSeries[String(slot)])
    .filter(([pointTimestamp]) => (
      (startUnix === null || pointTimestamp >= startUnix) &&
      (endUnix === null || pointTimestamp <= endUnix)
    ));
  const point = points.find(([pointTimestamp]) => pointTimestamp === timestamp);
  return point ? point[1] : null;
}

function getSeriesPoints(value: unknown): SeriesPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((point) => {
    if (!Array.isArray(point) || point.length < 2) {
      return [];
    }

    const timestamp = asNumber(point[0]);
    const metric = point[1] === null ? null : asNumber(point[1]);
    return timestamp === null ? [] : [[timestamp, metric] satisfies SeriesPoint];
  });
}

function formatHistoryValidatorTitle(timestamp: number, validator: MinerHistoryValidatorPoint | undefined) {
  if (!validator) {
    return `${new Date(timestamp * 1000).toLocaleString()}: no validator history returned.`;
  }

  return [
    new Date(timestamp * 1000).toLocaleString(),
    `V${validator.slot}`,
    `rank ${formatHistoryRank(validator)}`,
    `loss ${formatHistoryMetric(validator.loss, 6)}`,
    `latest ${formatHistoryMetric(validator.scoreLatest, 6)}`,
    `average ${formatHistoryMetric(validator.scoreAverage, 6)}`
  ].join(" | ");
}

function formatHistoryRank(validator: MinerHistoryValidatorPoint | undefined) {
  if (!validator || validator.rank === null) {
    return EMPTY_METRIC_VALUE;
  }

  return validator.rankTotal === null ? formatInteger(validator.rank) : `${formatInteger(validator.rank)} / ${formatInteger(validator.rankTotal)}`;
}

function formatHistoryMetric(value: number | null | undefined, digits: number) {
  return value === null || value === undefined ? EMPTY_METRIC_VALUE : formatMetricNumber(value, digits);
}

function formatHistoryDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getLatestFetchedAt(models: MinerHistoryModel[]) {
  return models.reduce<string | null>((latest, model) => {
    if (!model.fetchedAt) {
      return latest;
    }

    if (!latest) {
      return model.fetchedAt;
    }

    return new Date(model.fetchedAt).getTime() > new Date(latest).getTime() ? model.fetchedAt : latest;
  }, null);
}

function getMinerUids(value: string | null | undefined) {
  return Array.from(new Set((value ?? "").split(/[,\s]+/).map((uid) => uid.trim()).filter((uid) => /^\d+$/.test(uid))));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asText(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}
