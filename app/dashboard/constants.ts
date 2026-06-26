export const REFRESH_MS = 12_000;
export const REFRESH_INTERVAL_OPTIONS_SECONDS = [12, 30, 60, 300] as const;
export type RefreshIntervalSeconds = typeof REFRESH_INTERVAL_OPTIONS_SECONDS[number];
export const DEFAULT_REFRESH_INTERVAL_SECONDS: RefreshIntervalSeconds = 12;
export const SYNC_COUNTER_MS = 1_000;
export const BLOCK_TIME_SECONDS = 12;
export const ROUND_TREND_SAMPLE_COUNT = 50;
export const LEADERBOARD_SOURCES = {
  v2: "https://dashboard-api.connito.ai/api/v2/leaderboard",
  v3: "https://dashboard-api.connito.ai/api/v3/leaderboard"
} as const;
export type LeaderboardApiVersion = keyof typeof LEADERBOARD_SOURCES;
export const DEFAULT_LEADERBOARD_API_VERSION: LeaderboardApiVersion = "v3";
export const LEADERBOARD_SOURCE = LEADERBOARD_SOURCES[DEFAULT_LEADERBOARD_API_VERSION];
export const GITHUB_REPOSITORY_URL = "https://github.com/Icebitz/connito-dashboard";
export const THEME_STORAGE_KEY = "connito-dashboard-theme";
export const API_VERSION_STORAGE_KEY = "connito-dashboard-api-version";
export const REFRESH_INTERVAL_STORAGE_KEY = "connito-dashboard-refresh-interval";
export const VALIDATOR_COLUMN_COUNT = 5;
export const VALIDATOR_COLUMNS = Array.from({ length: VALIDATOR_COLUMN_COUNT }, (_, index) => index);
