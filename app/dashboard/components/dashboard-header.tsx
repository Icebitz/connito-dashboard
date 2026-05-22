import { Database, ExternalLink, Moon, RefreshCw, Sun } from "lucide-react";

import { formatInteger } from "../format";
import type { DashboardStatus, Theme } from "../types";

type DashboardHeaderProps = {
  netuid: number;
  source: string;
  status: DashboardStatus;
  theme: Theme;
  loading: boolean;
  onRefresh: () => void;
  onThemeToggle: () => void;
};

export function DashboardHeader({
  netuid,
  source,
  status,
  theme,
  loading,
  onRefresh,
  onThemeToggle
}: DashboardHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-block">
        <img className="brand-logo" src="/logo.svg" alt="" width="48" height="48" />
        <div className="brand-copy">
          <span className="eyebrow">Connito Subnet</span>
          <h1>Subnet {formatInteger(netuid)} Dashboard</h1>
        </div>
      </div>

      <div className="header-actions">
        <a className="api-button" href={source} target="_blank" rel="noreferrer" aria-label="Open leaderboard API source">
          <Database size={15} />
          API
          <ExternalLink size={13} />
        </a>
        <button
          type="button"
          className="theme-toggle"
          onClick={onThemeToggle}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <span className={`status-pill status-${status.toLowerCase()}`}>
          <span />
          {status}
        </span>
        <button type="button" onClick={onRefresh} disabled={loading} title="Refresh dashboard">
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
      </div>
    </header>
  );
}
