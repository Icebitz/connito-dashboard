export type ApiResponse = {
  fetchedAt?: string;
  ok?: boolean;
  source?: unknown;
  data?: unknown;
  leaderboardHistory?: unknown;
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
  cohortGroup: string | null;
  cohortGroupCode: number | null;
  lastObservedCommitBlock: number | null;
  lastObservedCommitBlockLag: number | null;
  committedRecently: boolean | null;
  committedThisCycle: boolean | null;
  evaluatedThisRound: boolean | null;
  score: number | null;
  loss: number | null;
  deltaLoss: number | null;
  incentive: number | null;
  lossTrend: Array<number | null>;
  weight: number | null;
  validatorMetrics: ValidatorMetric[];
};

export type ValidatorMetric = {
  label: string;
  slot: number | null;
  uid: number | null;
  chainUid: number | null;
  hotkey: string;
  score: number | null;
  scoreLatest: number | null;
  scoreAverage: number | null;
  scoreSamples: number | null;
  valLoss: number | null;
  weightSubmitted: number | null;
  extractedAtBlock: number | null;
  validatorStatus: string | null;
  evalStatusCode: number | null;
  evalStatusLabel: string | null;
  assignmentRole: string | null;
  assignmentRoleCode: number | null;
  lastObservedCommitBlock: number | null;
  rank: number | null;
  rankTotal: number | null;
  failureReasons: string[];
};

export type ValidatorHealth = {
  slot: number | null;
  uid: number | null;
  label: string | null;
  hotkey: string | null;
  status: string | null;
  chainActive: boolean | null;
  promReachable: boolean | null;
  lastChainUpdateBlock: number | null;
  lastPromSampleAgeSeconds: number | null;
};

export type HistoryPoint = {
  round: number;
  value: number;
  timestamp: number | null;
};

export type UpcomingPhase = {
  name: string;
  startBlock: number;
  endBlock: number | null;
  blocksUntilStart: number;
  duration: number | null;
  actor: string | null;
};

export type Theme = "dark" | "light";

export type DashboardStatus = "Degraded" | "Waiting" | "Cached" | "Partial" | "Live";

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
    successfulCommitsCount: number | null;
    successfulCommitsRate: number | null;
    history: HistoryPoint[];
  };
  meta: {
    validatorCount: number | null;
    polledValidatorCount: number | null;
    lastSuccessTs: number | null;
    pollIntervalSeconds: number | null;
    stale: boolean;
    staleReason: string | null;
    servedFrom: string | null;
    contributingValidators: number[];
    chainActiveValidators: number[];
    validatorHealth: ValidatorHealth[];
  };
  rows: MinerRow[];
};
