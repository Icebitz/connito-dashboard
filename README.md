# Connito Subnet 102 Dashboard

Real-time dashboard for monitoring the Connito (Bittensor subnet 102) leaderboard and validator network.

## What is this?

This app displays up-to-date miner and validator activity for Connito.

- Tracks miners by UID, rank, weight, incentives, and loss trend.
- Shows validator health across slots, including commitment and availability status.
- Surfaces scheduler/phase context (phase, rounds, blocks remaining) and sync state.
- Renders quick miner details (repo/revision and validator metrics) from the same dataset.

## Data flow

- Backend route: `app/api/leaderboard/route.ts`
- Upstream API: `http://dashboard-api-v2.connito.ai/api/v2/leaderboard`
- Frontend endpoint: `/api/leaderboard`
- Fallback cache: `.next/cache/connito-leaderboard-v3.json` (runtime-only, not source of truth)

## Quick run

```bash
npm install
npm run dev
# open http://localhost:3000
```

For production:

```bash
npm run build && npm run start
```

## Tech

- Next.js 16
- React 19
- TypeScript
- Lucide React
- App styling in `app/leaderboard.css` and `app/globals.css`

## Notes

- Data refresh interval: 12 seconds.
- No environment variables are required for local setup.
