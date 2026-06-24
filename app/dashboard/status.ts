export function formatStatusLabel(status: string | null | undefined) {
  return status ? status.replace(/_/g, " ") : "missing";
}

export function statusTone(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();

  if (!normalized || normalized === "-") {
    return "neutral";
  }

  if (normalized.includes("ok") || normalized.includes("live") || normalized.includes("fresh") || normalized.includes("committed")) {
    return "green";
  }

  if (normalized.includes("pending") || normalized.includes("partial") || normalized.includes("unconfigured") || normalized.includes("no weight")) {
    return "amber";
  }

  if (normalized.includes("failed") || normalized.includes("down") || normalized.includes("burn") || normalized.includes("missing")) {
    return "red";
  }

  return "violet";
}
