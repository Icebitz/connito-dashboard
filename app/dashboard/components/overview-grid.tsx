import { formatBlock, formatBlockDuration, formatInteger, formatNumber } from "../format";
import type { DashboardModel } from "../types";

type OverviewGridProps = {
  model: DashboardModel;
  syncCounter: string;
  loading: boolean;
};

function OverviewStatCard({
  label,
  value,
  detail,
  loading
}: {
  label: string;
  value: string;
  detail: string;
  loading: boolean;
}) {
  return (
    <article className={`overview-card${loading ? " overview-card-loading" : ""}`}>
      <span className="overview-card-label">{label}</span>
      {loading ? (
        <>
          <strong aria-hidden="true"><span /></strong>
          <small aria-hidden="true"><span /></small>
        </>
      ) : (
        <>
          <strong>{value}</strong>
          <small>{detail}</small>
        </>
      )}
    </article>
  );
}

function OverviewProgressCard({ phase, loading }: { phase: DashboardModel["phase"]; loading: boolean }) {
  const progress = Math.max(0, Math.min(100, phase.progress));
  const blocksInto = phase.blocksInto ?? 0;
  const cycleLength = phase.cycleLength ?? 0;
  const remaining = formatBlockDuration(phase.blocksRemaining);

  return (
    <article className={`overview-card overview-card-progress${loading ? " overview-card-loading" : ""}`}>
      <span className="overview-card-label">Train Progress</span>
      {loading ? (
        <>
          <strong aria-hidden="true"><span /></strong>
          <div className="overview-progress-track overview-progress-track-loading" aria-hidden="true"><i /></div>
          <small aria-hidden="true"><span /></small>
        </>
      ) : (
        <>
          <strong>{formatNumber(progress, 2)}%</strong>
          <div className="overview-progress-track" title={`${formatNumber(progress, 2)}% complete, ${remaining} remaining`}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <small>{formatInteger(blocksInto)} / {formatInteger(cycleLength)} blocks completed</small>
        </>
      )}
    </article>
  );
}

function OverviewUpcomingCard({ phase, loading }: { phase: DashboardModel["phase"]; loading: boolean }) {
  const upcoming = phase.upcoming.slice(0, 3);

  return (
    <article className={`overview-card overview-card-upcoming${loading ? " overview-card-loading" : ""}`}>
      <span className="overview-card-label">Upcoming</span>
      {loading ? (
        <>
          <strong aria-hidden="true"><span /></strong>
          <div className="overview-upcoming-list" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="overview-upcoming-item" key={index}>
                <span />
                <span />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <strong>{upcoming.length ? `${upcoming.length} phases` : "-"}</strong>
          <div className="overview-upcoming-list" aria-label="Upcoming phases">
            {upcoming.length ? upcoming.map((item, index) => (
              <div className="overview-upcoming-item" key={`${item.name}-${item.startBlock}`}>
                <span>{`${index + 1}. ${item.name}`}</span>
                <span>{`#${formatBlock(item.startBlock)}`}</span>
              </div>
            )) : <div className="overview-upcoming-empty">Waiting for phase data</div>}
          </div>
        </>
      )}
    </article>
  );
}

export function OverviewGrid({ model, syncCounter, loading }: OverviewGridProps) {
  return (
    <section className="overview-strip" aria-label="Subnet overview">
      <OverviewStatCard
        loading={loading}
        label="Miners"
        value={formatInteger(model.subnet.miners)}
        detail="registered on subnet"
      />
      <OverviewStatCard
        loading={loading}
        label="Validators"
        value={formatInteger(model.subnet.validators)}
        detail={loading ? "active validator set" : `active validator set · synced ${syncCounter} ago`}
      />
      <OverviewProgressCard loading={loading} phase={model.phase} />
      <OverviewUpcomingCard loading={loading} phase={model.phase} />
    </section>
  );
}
