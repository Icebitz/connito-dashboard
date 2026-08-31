"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHeader } from "./components/dashboard-header";
import { LeaderboardSection } from "./components/leaderboard-section";
import { RoundDetailsPanel } from "./components/round-details-panel";
import { ValidatorsSection } from "./components/validators-section";
import {
  DEFAULT_REFRESH_INTERVAL_SECONDS,
  REFRESH_INTERVAL_OPTIONS_SECONDS,
  REFRESH_INTERVAL_STORAGE_KEY,
  type RefreshIntervalSeconds
} from "./constants";
import { buildDashboardModel } from "./model";
import type { ApiResponse } from "./types";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState<RefreshIntervalSeconds>(DEFAULT_REFRESH_INTERVAL_SECONDS);
  const [refreshIntervalReady, setRefreshIntervalReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ t: String(Date.now()) });
      const leaderboardResponse = await fetch(`/api/leaderboard?${params}`, { cache: "no-store" });
      const leaderboardBody = (await leaderboardResponse.json()) as ApiResponse;

      if (!leaderboardResponse.ok || !leaderboardBody.ok) {
        throw new Error(leaderboardBody.error ?? "Leaderboard request failed.");
      }

      setLeaderboard(leaderboardBody);
    } catch (loadError) {
      console.error(loadError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), refreshIntervalSeconds * 1_000);
    return () => window.clearInterval(timer);
  }, [load, refreshIntervalSeconds]);

  useEffect(() => {
    const storedRefreshInterval = Number(window.localStorage.getItem(REFRESH_INTERVAL_STORAGE_KEY));
    const initialRefreshInterval = REFRESH_INTERVAL_OPTIONS_SECONDS.includes(storedRefreshInterval as RefreshIntervalSeconds)
      ? storedRefreshInterval as RefreshIntervalSeconds
      : DEFAULT_REFRESH_INTERVAL_SECONDS;

    setRefreshIntervalSeconds(initialRefreshInterval);
    setRefreshIntervalReady(true);
  }, []);

  useEffect(() => {
    if (!refreshIntervalReady) {
      return;
    }

    window.localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(refreshIntervalSeconds));
  }, [refreshIntervalSeconds, refreshIntervalReady]);

  const model = useMemo(() => buildDashboardModel(leaderboard), [leaderboard]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return model.rows;
    }

    return model.rows.filter((row) => [
      row.uid,
      row.hotkey,
      row.repo
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase()
      .includes(needle));
  }, [model.rows, query]);
  return (
    <main className="lb-shell">
      <DashboardHeader
        netuid={model.subnet.netuid}
        source={model.source}
        refreshIntervalSeconds={refreshIntervalSeconds}
        phase={model.phase}
        isLoading={isLoading}
        onRefreshIntervalChange={setRefreshIntervalSeconds}
      />

      <RoundDetailsPanel
        round={model.round}
        miners={model.subnet.miners}
        history={model.round.history}
        isLoading={isLoading}
      />

      <LeaderboardSection
        allRows={model.rows}
        filteredRows={filteredRows}
        query={query}
        validatorHealth={model.meta.validatorHealth}
        isLoading={isLoading}
        onQueryChange={setQuery}
      />

      <ValidatorsSection rows={model.rows} validatorHealth={model.meta.validatorHealth} isLoading={isLoading} />
    </main>
  );
}
