import { BarChart3, Clock3, Gauge, ShieldCheck, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";

import { formatBlockDurationWithCount, formatInteger, formatNumber } from "../format";
import type { DashboardModel } from "../types";

type DataCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
};

function DataCard({ label, value, detail, icon }: DataCardProps) {
  return (
    <article className="data-card">
      <div className="card-top">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

type OverviewGridProps = {
  model: DashboardModel;
  syncCounter: string;
};

export function OverviewGrid({ model, syncCounter }: OverviewGridProps) {
  return (
    <section className="overview-grid" aria-label="Subnet overview">
      <DataCard label="Miners" value={formatInteger(model.subnet.miners)} detail="registered on subnet" icon={<Users size={17} />} />
      <DataCard label="Validators" value={formatInteger(model.subnet.validators)} detail="active validator set" icon={<ShieldCheck size={17} />} />
      <DataCard label="Phase" value={model.phase.name} detail={`${formatBlockDurationWithCount(model.phase.blocksRemaining)} remaining`} icon={<Clock3 size={17} />} />
      <DataCard label="Round" value={formatInteger(model.round.id)} detail={`synced ${syncCounter}`} icon={<Trophy size={17} />} />
      <DataCard label="Top Score" value={formatNumber(model.metrics.topScore, 4)} detail={`avg ${formatNumber(model.metrics.averageScore, 4)}`} icon={<Gauge size={17} />} />
      <DataCard label="Weight" value={formatNumber(model.metrics.totalWeight, 3)} detail={`${formatInteger(model.metrics.assigned)} assigned`} icon={<BarChart3 size={17} />} />
    </section>
  );
}
