"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CompactMeta } from "./dashboard/components/compact-meta";
import { DashboardHeader } from "./dashboard/components/dashboard-header";
import { LeaderboardSection } from "./dashboard/components/leaderboard-section";
import { MetricChartsSection } from "./dashboard/components/metric-charts-section";
import { Notice } from "./dashboard/components/notice";
import { OverviewGrid } from "./dashboard/components/overview-grid";
import { PhasePanels } from "./dashboard/components/phase-panels";
import { RoundTrendSection } from "./dashboard/components/round-trend-section";
import { UpcomingPhases } from "./dashboard/components/upcoming-phases";
import { REFRESH_MS, SYNC_COUNTER_MS, THEME_STORAGE_KEY } from "./dashboard/constants";
import { formatDuration } from "./dashboard/format";
import { buildDashboardModel, getMinerKey } from "./dashboard/model";
import type { ApiResponse, DashboardStatus, MinerRow, Theme } from "./dashboard/types";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<ApiResponse | null>(null);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [selectedMinerKey, setSelectedMinerKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const leaderboardResponse = await fetch(`/api/leaderboard?t=${Date.now()}`, { cache: "no-store" });
      const leaderboardBody = (await leaderboardResponse.json()) as ApiResponse;

      if (!leaderboardResponse.ok || !leaderboardBody.ok) {
        throw new Error(leaderboardBody.error ?? "Leaderboard request failed.");
      }

      setLeaderboard(leaderboardBody);
      setError(leaderboardBody.warning ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to refresh dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), SYNC_COUNTER_MS);
    return () => window.clearInterval(timer);
  }, []);

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
      return model.rows.slice(0, 100);
    }

    return model.rows
      .filter((row) => `${row.uid} ${row.hotkey} ${row.repo} ${row.revision}`.toLowerCase().includes(needle))
      .slice(0, 100);
  }, [model.rows, query]);

  useEffect(() => {
    if (selectedMinerKey && !model.rows.some((row) => getMinerKey(row) === selectedMinerKey)) {
      setSelectedMinerKey(null);
    }
  }, [model.rows, selectedMinerKey]);

  const toggleMinerDetails = useCallback((row: MinerRow) => {
    const rowKey = getMinerKey(row);
    setSelectedMinerKey((current) => current === rowKey ? null : rowKey);
  }, []);

  const scoredPercent = model.round.roster && model.round.roster > 0
    ? Math.max(0, Math.min(100, ((model.round.scored ?? 0) / model.round.roster) * 100))
    : 0;
  const status: DashboardStatus = error ? "Degraded" : model.empty ? "Waiting" : model.stale ? "Cached" : "Live";
  const fetchedAtMs = model.fetchedAt ? new Date(model.fetchedAt).getTime() : Number.NaN;
  const hasSyncedAt = Number.isFinite(fetchedAtMs);
  const lastSync = hasSyncedAt ? new Date(fetchedAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
  const syncCounter = hasSyncedAt ? `${formatDuration(nowMs - fetchedAtMs)} ago` : "-";
  const topMiner = model.rows[0];

  return (
    <main className="dashboard-shell">
      <DashboardHeader
        netuid={model.subnet.netuid}
        source={model.source}
        status={status}
        theme={theme}
        loading={loading}
        onRefresh={() => void load()}
        onThemeToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")}
      />

      <CompactMeta
        lastSync={lastSync}
        syncCounter={syncCounter}
        shownRows={filteredRows.length}
        totalRows={model.metrics.rows}
        assignedRows={model.metrics.assigned}
        burnPercent={model.metrics.burnPercent}
        topScore={model.metrics.topScore}
        averageScore={model.metrics.averageScore}
      />

      <Notice message={error} />
      <OverviewGrid model={model} syncCounter={syncCounter} />
      <PhasePanels phase={model.phase} round={model.round} scoredPercent={scoredPercent} />
      <UpcomingPhases phases={model.phase.upcoming} />
      <RoundTrendSection points={model.round.history} />
      <MetricChartsSection rows={model.rows} />
      <LeaderboardSection
        filteredRows={filteredRows}
        query={query}
        selectedMinerKey={selectedMinerKey}
        topMiner={topMiner}
        burnPercent={model.metrics.burnPercent}
        onQueryChange={setQuery}
        onToggleMinerDetails={toggleMinerDetails}
      />
    </main>
  );
}
