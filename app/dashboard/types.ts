export type ApiResponse = {
  fetchedAt?: string;
  ok?: boolean;
  source?: unknown;
  data?: unknown;
  stale?: boolean;
  empty?: boolean;
  warning?: string;
  error?: string;
};

export type MinerRow = {
  rank: number;
  uid: string;
  hotkey: string;
  repo: string;
  revision: string;
  score: number | null;
  loss: number | null;
  deltaLoss: number | null;
  weight: number | null;
  evaluations: number | null;
  assigned: boolean | null;
  validatorMetrics: ValidatorMetric[];
};

export type ValidatorMetric = {
  label: string;
  slot: number | null;
  uid: number | null;
  chainUid: number | null;
  hotkey: string;
  score: number | null;
  valLoss: number | null;
  weightSubmitted: number | null;
  extractedAtBlock: number | null;
};

export type HistoryPoint = {
  round: number;
  value: number;
  timestamp: number | null;
};

export type UpcomingPhase = {
  name: string;
  startBlock: number;
  endBlock: number;
  blocksUntilStart: number;
  duration: number | null;
};

export type Theme = "dark" | "light";

export type DashboardStatus = "Degraded" | "Waiting" | "Cached" | "Live";

export type DashboardModel = {
  source: string;
  fetchedAt: string | null;
  stale: boolean;
  empty: boolean;
  subnet: {
    netuid: number;
    miners: number;
    validators: number | null;
  };
  phase: {
    name: string;
    headBlock: number | null;
    phaseStart: number | null;
    phaseEnd: number | null;
    blocksInto: number | null;
    blocksRemaining: number | null;
    cycleIndex: number | null;
    cycleLength: number | null;
    cycleBlock: number | null;
    progress: number;
    upcoming: UpcomingPhase[];
  };
  round: {
    id: number | null;
    baselineLoss: number | null;
    roster: number | null;
    scored: number | null;
    pending: number | null;
    failed: number | null;
    downloaded: number | null;
    claimed: number | null;
    history: HistoryPoint[];
  };
  metrics: {
    rows: number;
    assigned: number;
    topScore: number | null;
    averageScore: number | null;
    totalWeight: number | null;
    burnPercent: number | null;
  };
  rows: MinerRow[];
};
