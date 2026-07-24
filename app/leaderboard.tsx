"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHeader } from "./dashboard/components/dashboard-header";
import { LeaderboardSection } from "./dashboard/components/leaderboard-section";
import { RoundDetailsPanel } from "./dashboard/components/round-details-panel";
import { ValidatorsSection } from "./dashboard/components/validators-section";
import {
  API_VERSION_STORAGE_KEY,
  DEFAULT_LEADERBOARD_API_VERSION,
  DEFAULT_REFRESH_INTERVAL_SECONDS,
  REFRESH_INTERVAL_OPTIONS_SECONDS,
  REFRESH_INTERVAL_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type LeaderboardApiVersion,
  type RefreshIntervalSeconds
} from "./dashboard/constants";
import { buildDashboardModel } from "./dashboard/model";
import type { ApiResponse, Theme } from "./dashboard/types";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [apiVersion, setApiVersion] = useState<LeaderboardApiVersion>(DEFAULT_LEADERBOARD_API_VERSION);
  const [apiVersionReady, setApiVersionReady] = useState(false);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState<RefreshIntervalSeconds>(DEFAULT_REFRESH_INTERVAL_SECONDS);
  const [refreshIntervalReady, setRefreshIntervalReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        version: apiVersion,
        t: String(Date.now())
      });
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
  }, [apiVersion]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), refreshIntervalSeconds * 1_000);
    return () => window.clearInterval(timer);
  }, [load, refreshIntervalSeconds]);

  useEffect(() => {
    const storedApiVersion = window.localStorage.getItem(API_VERSION_STORAGE_KEY);
    const initialApiVersion: LeaderboardApiVersion = storedApiVersion === "v1"
      || storedApiVersion === "v2"
      || storedApiVersion === "v3"
      ? storedApiVersion
      : DEFAULT_LEADERBOARD_API_VERSION;

    setApiVersion(initialApiVersion);
    setApiVersionReady(true);
  }, []);

  useEffect(() => {
    if (!apiVersionReady) {
      return;
    }

    window.localStorage.setItem(API_VERSION_STORAGE_KEY, apiVersion);
  }, [apiVersion, apiVersionReady]);

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

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme: Theme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : "dark";

    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) {
      return;
    }

    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, themeReady]);

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
        theme={theme}
        apiVersion={apiVersion}
        refreshIntervalSeconds={refreshIntervalSeconds}
        phase={model.phase}
        isLoading={isLoading}
        onApiVersionChange={(nextApiVersion) => {
          setLeaderboard(null);
          setIsLoading(true);
          setApiVersion(nextApiVersion);
        }}
        onRefreshIntervalChange={setRefreshIntervalSeconds}
        onThemeToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")}
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
