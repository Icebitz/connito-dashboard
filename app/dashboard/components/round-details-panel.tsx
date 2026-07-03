"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, FocusEvent } from "react";

import { MiniLineChart } from "./mini-line-chart";
import { formatBlock, formatBlockMinutes, formatInteger, formatMetricNumber, formatPercent } from "../format";
import type { DashboardModel, HistoryPoint } from "../types";

type RoundDetailsPanelProps = {
  round: DashboardModel["round"];
  phase: DashboardModel["phase"];
  miners: number;
  history: HistoryPoint[];
};

type ProgressSegment = {
  key: "scored" | "pending" | "failed";
  label: string;
  count: number;
  tone: "green" | "amber" | "red";
};

export function RoundDetailsPanel({ round, phase, miners, history }: RoundDetailsPanelProps) {
  const roster = round.roster ?? null;
  const scored = round.scored ?? 0;
  const pending = round.pending ?? 0;
  const failed = round.failed ?? 0;
  const rosterTotal = roster && roster > 0 ? roster : scored + pending + failed;
  const scoredPercent = ratio(scored, rosterTotal);
  const pendingPercent = ratio(pending, rosterTotal);
  const failedPercent = ratio(failed, rosterTotal);
  const successfulCommits = round.successfulCommitsCount ?? null;
  const commitSuccessPercent = round.successfulCommitsRate ?? ratio(successfulCommits, miners);
  const segmentSummary: ProgressSegment[] = [
    { key: "scored", label: "Scored", count: scored, tone: "green" },
    { key: "pending", label: "Pending", count: pending, tone: "amber" },
    { key: "failed", label: "Failed", count: failed, tone: "red" }
  ];

  return (
    <section className="lb-round lb-panel">
      <div className="lb-section-top">
        <div className="lb-section-title">
          <span>Round Details</span>
        </div>
      </div>

      <div className="lb-round-head">
        <StatCell label="Round" value={`#${formatBlock(round.id)}`} />
        <StatCell label="Baseline Loss" value={formatMetricNumber(round.baselineLoss, 4)} />
        <StatCell label="Next Cycle In" value={formatBlockMinutes(phase.blocksRemaining)} />
      </div>

      <div className="lb-round-grid">
        <MetricTile
          tone="neutral"
          label="Roster"
          value={formatInteger(roster)}
          note={roster === null ? "-" : `${formatInteger(rosterTotal)} total`}
        />
        <MetricTile
          tone="green"
          label="Scored"
          value={formatInteger(scored)}
          note={rosterTotal > 0 ? `${formatPercent(scoredPercent, 2)} of roster` : "-"}
        />
        <MetricTile
          tone="amber"
          label="Pending"
          value={formatInteger(pending)}
          note={rosterTotal > 0 ? `${formatPercent(pendingPercent, 2)} of roster` : "-"}
        />
        <MetricTile
          tone="red"
          label="Failed"
          value={formatInteger(failed)}
          note={rosterTotal > 0 ? `${formatPercent(failedPercent, 2)} of roster` : "-"}
        />
        <MetricTile
          tone="violet"
          label="Commit Success"
          value={successfulCommits === null ? "-" : `${formatInteger(successfulCommits)} / ${formatInteger(miners)}`}
          note={commitSuccessPercent === null ? "-" : `${formatPercent(commitSuccessPercent, 2)} of miners`}
        />
      </div>

      <div className="lb-round-progress-panel">
        <div className="lb-round-progress-head">
          <span>Scoring Progress</span>
          <strong>{rosterTotal > 0 ? `${formatPercent(scoredPercent, 2)} scored · ${formatInteger(pending)} pending` : "-"}</strong>
        </div>
        <RoundProgressBar segments={segmentSummary} total={rosterTotal} />
      </div>

      <MiniLineChart points={history} />
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="lb-round-head-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricTile({
  tone,
  label,
  value,
  note
}: {
  tone: "neutral" | "green" | "amber" | "red" | "violet";
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className={`lb-round-tile lb-round-tile-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function RoundProgressBar({ segments, total }: { segments: ProgressSegment[]; total: number }) {
  const [tooltip, setTooltip] = useState<{
    left: number;
    label: string;
    count: number;
    percent: number;
    tone: ProgressSegment["tone"];
  } | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const visibleSegments = useMemo(() => {
    if (total <= 0) {
      return segments.map((segment) => ({
        ...segment,
        percent: 0
      }));
    }

    return segments.map((segment) => ({
      ...segment,
      percent: Math.max(0, (segment.count / total) * 100)
    }));
  }, [segments, total]);

  if (total <= 0) {
    return <div className="lb-round-progress-empty">No scoring data</div>;
  }

  const showTooltip = (element: HTMLButtonElement, segment: ProgressSegment & { percent: number }) => {
    const barElement = barRef.current;
    if (!barElement) {
      return;
    }

    const barRect = barElement.getBoundingClientRect();
    const buttonRect = element.getBoundingClientRect();
    const left = buttonRect.left - barRect.left + buttonRect.width / 2;

    setTooltip({
      left: Math.max(72, Math.min(barRect.width - 72, left)),
      label: segment.label,
      count: segment.count,
      percent: segment.percent,
      tone: segment.tone
    });
  };

  return (
    <div className="lb-round-progress-wrap">
      <div className="lb-round-progress-bar" ref={barRef} onPointerLeave={() => setTooltip(null)}>
        {visibleSegments.map((segment) => (
          <button
            key={segment.key}
            type="button"
            className={`lb-round-segment lb-round-segment-${segment.tone}`}
            style={{ width: `${segment.percent}%` } as CSSProperties}
            onPointerEnter={(event) => showTooltip(event.currentTarget, segment)}
            onFocus={(event: FocusEvent<HTMLButtonElement>) => showTooltip(event.currentTarget, segment)}
            aria-label={`${segment.label} ${formatInteger(segment.count)} (${formatPercent(segment.percent, 2)})`}
            title={`${segment.label} ${formatInteger(segment.count)} (${formatPercent(segment.percent, 2)})`}
          />
        ))}
        {tooltip ? (
          <div className={`lb-round-tooltip lb-round-tooltip-${tooltip.tone}`} style={{ left: `${tooltip.left}px` }}>
            <strong>{tooltip.label}</strong>
            <span>{formatInteger(tooltip.count)} items</span>
            <small>{formatPercent(tooltip.percent, 2)} of roster</small>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ratio(value: number | null | undefined, total: number) {
  if (value === null || value === undefined || !Number.isFinite(value) || total <= 0) {
    return null;
  }

  return (value / total) * 100;
}
