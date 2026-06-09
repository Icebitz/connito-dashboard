# Connito Subnet 102 Leaderboard

Real-time dashboard for the Connito Bittensor subnet 102 leaderboard.

The app is built with Next.js and reads leaderboard data through a local API route that proxies the Connito dashboard API v2 endpoint.

## Features

- Subnet overview cards for miners, validators, phase, round, top score, and top weight.
- Current phase panel with progress and phase block timing.
- Upcoming phase cards.
- Round loss chart and round health summary.
- Weight and score bar charts.
- Leaderboard table with v2 validator metrics grouped by validator.
- Dark/light theme toggle persisted in local storage.
- Best-effort local cache fallback when the upstream API is slow or unavailable.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Lucide React icons
- CSS in `app/globals.css`

## Data Source

The server route [app/api/leaderboard/route.ts](app/api/leaderboard/route.ts) fetches:

```text
https://dashboard-api.connito.ai/api/v2/leaderboard
```

The route exposes the data to the frontend at:

```text
/api/leaderboard
```

The upstream response is cached in memory and, when possible, in:

```text
.next/cache/connito-leaderboard-v2.json
```

This cache is a runtime fallback only. It should not be treated as source data.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev
```

Starts the Next.js development server with Turbopack.

```bash
npm run build
```

Builds the production app.

```bash
npm run start
```

Starts the production server after a build.

```bash
npm run typecheck
```

Runs TypeScript without emitting files.

## Project Structure

```text
app/
  api/
    leaderboard/route.ts       Local proxy for Connito API v2
  dashboard/
    components/                Dashboard UI sections
    constants.ts               Refresh interval, source URL, table dimensions
    format.ts                  Formatting helpers
    model.ts                   API response normalization
    types.ts                   Dashboard and row types
  globals.css                  Global styles and dashboard layout
  leaderboard.tsx              Main dashboard page component
  layout.tsx                   App metadata and root layout
  page.tsx                     App entry page
public/
  favicon.svg
  logo.svg
```

## Data Model Notes

The v2 API includes validator-specific metrics such as:

- `validator_slot`
- `validator_status`
- `weight_submitted`
- `val_loss`
- `score_latest`
- `score_avg`
- `score_samples`
- `eval_status_label`
- `observed_failure_reasons`

[app/dashboard/model.ts](app/dashboard/model.ts) normalizes those fields into the dashboard model. Validator table columns are aligned by `validator_slot` so missing validator entries do not shift data into the wrong validator column.

## Development Notes

- The dashboard refreshes leaderboard data every 12 seconds.
- The local sync counter updates every second.
- The frontend fetches `/api/leaderboard` with `cache: "no-store"`.
- If the upstream request fails, the API route returns cached data when available and marks the response as stale.
- No environment variables are required for the current setup.
