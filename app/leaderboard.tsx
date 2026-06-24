"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHeader } from "./dashboard/components/dashboard-header";
import { LeaderboardSection } from "./dashboard/components/leaderboard-section";
import { Notice } from "./dashboard/components/notice";
import { RoundDetailsPanel } from "./dashboard/components/round-details-panel";
import { ValidatorsSection } from "./dashboard/components/validators-section";
import { REFRESH_MS, THEME_STORAGE_KEY } from "./dashboard/constants";
import { formatBlock } from "./dashboard/format";
import { buildDashboardModel } from "./dashboard/model";
import type { ApiResponse, Theme } from "./dashboard/types";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<ApiResponse | null>(null);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

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
  const headerSubtitle = `Cycle #${formatBlock(model.phase.cycleIndex)} · Head Block ${formatBlock(model.phase.headBlock)} · Blocks Remaining ${formatBlock(model.phase.blocksRemaining)}`;

  return (
    <main className="lb-shell">
      <DashboardHeader
        netuid={model.subnet.netuid}
        source={model.source}
        theme={theme}
        phase={model.phase}
        subnet={model.subnet}
        subtitle={headerSubtitle}
        onThemeToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")}
      />

      <RoundDetailsPanel
        round={model.round}
        phase={model.phase}
        miners={model.subnet.miners}
        history={model.round.history}
      />

      <LeaderboardSection
        allRows={model.rows}
        filteredRows={filteredRows}
        query={query}
        validatorHealth={model.meta.validatorHealth}
        onQueryChange={setQuery}
      />

      <ValidatorsSection rows={model.rows} validatorHealth={model.meta.validatorHealth} />

      <Notice message={error} />
    </main>
  );
}
