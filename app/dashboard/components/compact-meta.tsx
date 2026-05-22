import { formatInteger, formatNumber, formatPercent } from "../format";

type CompactMetaProps = {
  lastSync: string;
  syncCounter: string;
  shownRows: number;
  totalRows: number;
  assignedRows: number;
  burnPercent: number | null;
  topScore: number | null;
  averageScore: number | null;
};

export function CompactMeta({
  lastSync,
  syncCounter,
  shownRows,
  totalRows,
  assignedRows,
  burnPercent,
  topScore,
  averageScore
}: CompactMetaProps) {
  return (
    <section className="compact-meta" aria-label="Dashboard details">
      <span title={lastSync === "-" ? undefined : `Last sync ${lastSync}`}>Sync {syncCounter}</span>
      <span>{formatInteger(shownRows)} shown</span>
      <span>{formatInteger(totalRows)} rows</span>
      <span>{formatInteger(assignedRows)} assigned</span>
      <span>Burn {formatPercent(burnPercent, 2)}</span>
      <span>Top {formatNumber(topScore, 4)}</span>
      <span>Avg {formatNumber(averageScore, 4)}</span>
    </section>
  );
}
