"use client";

import type { ReactNode } from "react";

import type { LeaderboardApiVersion, RefreshIntervalSeconds } from "../constants";
import type { DashboardModel, Theme } from "../types";
import { DashboardHeaderBar } from "./dashboard-header-bar";
import { DashboardHeaderInfo } from "./dashboard-header-info";

type DashboardHeaderProps = {
  netuid: number;
  source: string;
  theme: Theme;
  apiVersion: LeaderboardApiVersion;
  refreshIntervalSeconds: RefreshIntervalSeconds;
  phase: DashboardModel["phase"];
  isLoading: boolean;
  subtitle?: ReactNode;
  onApiVersionChange: (apiVersion: LeaderboardApiVersion) => void;
  onRefreshIntervalChange: (seconds: RefreshIntervalSeconds) => void;
  onThemeToggle: () => void;
};

export function DashboardHeader({
  netuid,
  source,
  theme,
  apiVersion,
  refreshIntervalSeconds,
  phase,
  isLoading,
  subtitle,
  onApiVersionChange,
  onRefreshIntervalChange,
  onThemeToggle
}: DashboardHeaderProps) {
  return (
    <header className="lb-header lb-header-compact">
      <DashboardHeaderBar
        netuid={netuid}
        source={source}
        theme={theme}
        apiVersion={apiVersion}
        refreshIntervalSeconds={refreshIntervalSeconds}
        subtitle={subtitle}
        onApiVersionChange={onApiVersionChange}
        onRefreshIntervalChange={onRefreshIntervalChange}
        onThemeToggle={onThemeToggle}
      />
      <DashboardHeaderInfo phase={phase} isLoading={isLoading} />
    </header>
  );
}
