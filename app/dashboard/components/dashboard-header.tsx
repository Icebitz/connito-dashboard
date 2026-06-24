"use client";

import type { DashboardModel, Theme } from "../types";
import { DashboardHeaderBar } from "./dashboard-header-bar";
import { DashboardHeaderInfo } from "./dashboard-header-info";

type DashboardHeaderProps = {
  netuid: number;
  source: string;
  theme: Theme;
  phase: DashboardModel["phase"];
  subnet: DashboardModel["subnet"];
  subtitle: string;
  onThemeToggle: () => void;
};

export function DashboardHeader({
  netuid,
  source,
  theme,
  phase,
  subnet,
  subtitle,
  onThemeToggle
}: DashboardHeaderProps) {
  return (
    <header className="lb-header lb-header-compact">
      <DashboardHeaderBar
        netuid={netuid}
        source={source}
        theme={theme}
        subtitle={subtitle}
        onThemeToggle={onThemeToggle}
      />
      <DashboardHeaderInfo phase={phase} subnet={subnet} />
    </header>
  );
}
