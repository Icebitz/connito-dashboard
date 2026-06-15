import { BarChart3, Clock3, Gauge, ShieldCheck, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";

import { formatBlock, formatBlockDurationWithCount, formatInteger, formatNumber } from "../format";
import type { DashboardModel } from "../types";

type DataCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: "miners" | "validators" | "phase" | "round" | "score" | "weight";
  loading?: boolean;
};

function DataCard({ label, value, detail, icon, tone, loading = false }: DataCardProps) {
  return (
    <article className={`data-card data-card-${tone}${loading ? " data-card-skeleton" : ""}`} aria-busy={loading}>
      <div className="card-top">
        <span className="icon-bubble" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      {loading ? (
        <>
          <strong aria-hidden="true"><span /></strong>
          <p aria-hidden="true"><span /></p>
        </>
      ) : (
        <>
          <strong>{value}</strong>
          <p>{detail}</p>
        </>
      )}
    </article>
  );
}

type OverviewGridProps = {
  model: DashboardModel;
  syncCounter: string;
  loading: boolean;
};

export function OverviewGrid({ model, syncCounter, loading }: OverviewGridProps) {
  return (
    <section className="overview-grid" aria-label="Subnet overview">
      <DataCard loading={loading} tone="miners" label="Miners" value={formatInteger(model.subnet.miners)} detail="registered on subnet" icon={<Users size={17} />} />
      <DataCard loading={loading} tone="validators" label="Validators" value={formatInteger(model.subnet.validators)} detail="active validator set" icon={<ShieldCheck size={17} />} />
      <DataCard loading={loading} tone="phase" label="Phase" value={model.phase.name} detail={`${formatBlockDurationWithCount(model.phase.blocksRemaining)} remaining`} icon={<Clock3 size={17} />} />
      <DataCard loading={loading} tone="round" label="Round" value={formatBlock(model.round.id)} detail={`synced ${syncCounter}`} icon={<Trophy size={17} />} />
      <DataCard loading={loading} tone="score" label="Best Loss" value={formatNumber(model.metrics.bestLoss, 4)} detail={`avg ${formatNumber(model.metrics.averageLoss, 4)}`} icon={<Gauge size={17} />} />
      <DataCard loading={loading} tone="weight" label="Top Weight" value={formatNumber(model.metrics.topWeight, 4)} detail={`total ${formatNumber(model.metrics.totalWeight, 3)}`} icon={<BarChart3 size={17} />} />
    </section>
  );
}
