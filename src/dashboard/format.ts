import { BLOCK_TIME_SECONDS } from "./constants";

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (Math.abs(value) >= 1_000_000) {
    return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  }

  if (Math.abs(value) >= 1_000) {
    return Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
  }

  if (Math.abs(value) > 0 && Math.abs(value) < 0.001) {
    return value.toExponential(2);
  }

  return Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(value);
}

export function formatMetricNumber(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (value === 0) {
    return "0";
  }

  if (Math.abs(value) > 0 && Math.abs(value) < 0.001) {
    return value.toExponential(2);
  }

  return Intl.NumberFormat("en", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function formatInteger(value: number | null | undefined) {
  return formatNumber(value, 0);
}

export function formatPercent(value: number | null | undefined, digits = 2) {
  const formatted = formatNumber(value, digits);
  return formatted === "-" ? "-" : `${formatted}%`;
}

export function formatBlock(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
}

export function formatAgeSecondsShort(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const totalSeconds = Math.max(0, Math.floor(value));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

export function formatBlockMinutes(blocks: number | null | undefined, digits = 1) {
  if (blocks === null || blocks === undefined || !Number.isFinite(blocks)) {
    return "-";
  }

  return `${formatNumber((blocks * BLOCK_TIME_SECONDS) / 60, digits)} min`;
}

export function shortText(value: string, start = 8, end = 6) {
  if (!value || value === "-") {
    return "-";
  }

  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${end > 0 ? value.slice(-end) : ""}`;
}

export function formatRepoRevision(repo: string, revision: string) {
  const hasRepo = Boolean(repo && repo !== "-");
  const hasRevision = Boolean(revision && revision !== "-");

  if (hasRepo && hasRevision) {
    return `${repo}:${revision}`;
  }

  if (hasRepo) {
    return repo;
  }

  return hasRevision ? revision : "-";
}

export function getHuggingFaceRepoUrl(repo: string) {
  return repo && repo !== "-" ? `https://huggingface.co/${repo.split("/").map(encodeURIComponent).join("/")}` : null;
}

export function getHuggingFaceRevisionUrl(repo: string, revision: string) {
  const repoUrl = getHuggingFaceRepoUrl(repo);

  if (!repoUrl || !revision || revision === "-") {
    return repoUrl;
  }

  return `${repoUrl}/tree/${encodeURIComponent(revision)}`;
}
