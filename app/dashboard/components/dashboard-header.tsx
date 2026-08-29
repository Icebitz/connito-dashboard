"use client";

import type { ReactNode } from "react";

import type { RefreshIntervalSeconds } from "../constants";
import type { DashboardModel } from "../types";
import { DashboardHeaderBar } from "./dashboard-header-bar";
import { DashboardHeaderInfo } from "./dashboard-header-info";

type DashboardHeaderProps = {
  netuid: number;
  source: string;
  refreshIntervalSeconds: RefreshIntervalSeconds;
  phase: DashboardModel["phase"];
  isLoading: boolean;
  subtitle?: ReactNode;
  onRefreshIntervalChange: (seconds: RefreshIntervalSeconds) => void;
};

export function DashboardHeader({
  netuid,
  source,
  refreshIntervalSeconds,
  phase,
  isLoading,
  subtitle,
  onRefreshIntervalChange
}: DashboardHeaderProps) {
  return (
    <header className="lb-header lb-header-compact">
      <DashboardHeaderBar
        netuid={netuid}
        source={source}
        refreshIntervalSeconds={refreshIntervalSeconds}
        subtitle={subtitle}
        onRefreshIntervalChange={onRefreshIntervalChange}
      />
      <DashboardHeaderInfo phase={phase} isLoading={isLoading} />
    </header>
  );
}
