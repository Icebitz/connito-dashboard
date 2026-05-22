export const REFRESH_MS = 60_000;
export const SYNC_COUNTER_MS = 1_000;
export const BLOCK_TIME_SECONDS = 12;
export const LEADERBOARD_SOURCE = "https://dashboard-api.connito.ai/api/v1/leaderboard";
export const THEME_STORAGE_KEY = "connito-dashboard-theme";
export const VALIDATOR_COLUMN_COUNT = 5;
export const LEADERBOARD_COLUMN_COUNT = 5 + VALIDATOR_COLUMN_COUNT * 2;
export const VALIDATOR_COLUMNS = Array.from({ length: VALIDATOR_COLUMN_COUNT }, (_, index) => index);
