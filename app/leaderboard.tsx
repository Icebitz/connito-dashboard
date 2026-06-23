"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHeader } from "./dashboard/components/dashboard-header";
import { LeaderboardSection } from "./dashboard/components/leaderboard-section";
import { MinerHistoryTab } from "./dashboard/components/miner-history-tab";
import { OverviewGrid } from "./dashboard/components/overview-grid";
import { PhasePanels, RoundHealthPanel } from "./dashboard/components/phase-panels";
import { REFRESH_MS, SYNC_COUNTER_MS, THEME_STORAGE_KEY } from "./dashboard/constants";
import { formatAgeSecondsShort, formatBlock } from "./dashboard/format";
import { buildDashboardModel } from "./dashboard/model";
import type { ApiResponse, DashboardStatus, Theme } from "./dashboard/types";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<ApiResponse | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "history">("dashboard");
  const [historyMinerUids, setHistoryMinerUids] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>("dark");
  const [themeReady, setThemeReady] = useState(false);
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
      return model.rows;
    }

    return model.rows.filter((row) => [
      row.uid,
      row.hotkey,
      row.repo,
      row.revision,
      row.cohortGroup,
      row.cohortGroupCode,
      row.lastObservedCommitBlock
    ].filter((value) => value !== null && value !== undefined).join(" ").toLowerCase().includes(needle));
  }, [model.rows, query]);

  const openMinerHistory = useCallback((uids: string[]) => {
    setHistoryMinerUids(uids);
    setActiveTab("history");
  }, []);

  const scoredPercent = model.round.roster && model.round.roster > 0
    ? Math.max(0, Math.min(100, ((model.round.scored ?? 0) / model.round.roster) * 100))
    : 0;
  const status: DashboardStatus = error
    ? "Degraded"
    : model.empty ? "Waiting"
      : leaderboard?.stale ? "Cached"
        : model.meta.stale ? "Partial"
          : "Live";
  const fetchedAtMs = model.fetchedAt ? new Date(model.fetchedAt).getTime() : Number.NaN;
  const hasSyncedAt = Number.isFinite(fetchedAtMs);
  const lastSync = hasSyncedAt ? new Date(fetchedAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
  const syncCounter = hasSyncedAt ? formatAgeSecondsShort(Math.max(0, (nowMs - fetchedAtMs) / 1000)) : "-";
  const firstLoad = loading && leaderboard === null;
  const headerSubtitle = `Cycle #${formatBlock(model.phase.cycleIndex)} · Head Block ${formatBlock(model.phase.headBlock)} · Blocks Remaining ${formatBlock(model.phase.blocksRemaining)}`;

  return (
    <main className="dashboard-shell">
      <DashboardHeader
        netuid={model.subnet.netuid}
        source={model.source}
        status={status}
        theme={theme}
        activeTab={activeTab}
        loading={loading}
        subtitle={headerSubtitle}
        onRefresh={() => void load()}
        onTabChange={setActiveTab}
        onThemeToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")}
      />

      {activeTab === "dashboard" ? (
        <>
          <OverviewGrid model={model} syncCounter={syncCounter} loading={firstLoad} />
          <RoundHealthPanel
            round={model.round}
            phase={model.phase}
            miners={model.subnet.miners}
            history={model.round.history}
            scoredPercent={scoredPercent}
            loading={firstLoad}
          />
          <LeaderboardSection
            allRows={model.rows}
            filteredRows={filteredRows}
            query={query}
            burnPercent={model.metrics.burnPercent}
            theme={theme}
            meta={model.meta}
            onQueryChange={setQuery}
            onThemeToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            onOpenHistory={openMinerHistory}
          />
        </>
      ) : (
        <>
          <PhasePanels phase={model.phase} fetchedAt={model.fetchedAt} nowMs={nowMs} loading={firstLoad} />
          <MinerHistoryTab selectedMinerUids={historyMinerUids} />
        </>
      )}
      <footer className="site-footer">
        <div>
          <strong>Connito Subnet {model.subnet.netuid}</strong>
          <span>Leaderboard dashboard</span>
        </div>
        <div className="site-footer-meta">
          <span>Status {status}</span>
          <span>Synced {syncCounter} ago</span>
          <span>Last updated {lastSync}</span>
          <span>Subnet {model.subnet.netuid}</span>
        </div>
      </footer>
    </main>
  );
}
