"use client";

import type { ReactNode } from "react";
import { Clock3, Database, ExternalLink, GitBranch, MoonStar, SunMedium } from "lucide-react";

import {
  GITHUB_REPOSITORY_URL,
  REFRESH_INTERVAL_OPTIONS_SECONDS,
  type LeaderboardApiVersion,
  type RefreshIntervalSeconds
} from "../constants";
import { CONNITO_LOGO_URL } from "../brand";
import { formatInteger } from "../format";
import type { Theme } from "../types";

type DashboardHeaderBarProps = {
  netuid: number;
  source: string;
  theme: Theme;
  apiVersion: LeaderboardApiVersion;
  refreshIntervalSeconds: RefreshIntervalSeconds;
  subtitle?: ReactNode;
  onApiVersionChange: (apiVersion: LeaderboardApiVersion) => void;
  onRefreshIntervalChange: (seconds: RefreshIntervalSeconds) => void;
  onThemeToggle: () => void;
};

export function DashboardHeaderBar({
  netuid,
  source,
  theme,
  apiVersion,
  refreshIntervalSeconds,
  subtitle,
  onApiVersionChange,
  onRefreshIntervalChange,
  onThemeToggle
}: DashboardHeaderBarProps) {
  const isDark = theme === "dark";
  const themeTitle = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <div className="lb-header-top lb-panel lb-header-bar">
      <div className="lb-brand">
        <img className="lb-brand-logo" src={CONNITO_LOGO_URL} alt="Connito" />
        <div className="lb-brand-copy">
          <div className="lb-brand-line">
            <h1 className="lb-header-title">
              Connito Leaderboard <span>SN{formatInteger(netuid)}</span>
            </h1>
          </div>
          {subtitle ? <div className="lb-header-subline">{subtitle}</div> : null}
        </div>
      </div>

      <div className="lb-header-actions">
        <label className="lb-api-version-field" title="Select leaderboard API version">
          <Database size={15} />
          <select
            value={apiVersion}
            aria-label="Select leaderboard API version"
            onChange={(event) => onApiVersionChange(event.target.value as LeaderboardApiVersion)}
          >
            <option value="v2">API v2</option>
            <option value="v3">API v3</option>
          </select>
        </label>

        <label className="lb-refresh-interval-field" title="Select refresh interval">
          <Clock3 size={15} />
          <select
            value={refreshIntervalSeconds}
            aria-label="Select refresh interval"
            onChange={(event) => onRefreshIntervalChange(Number(event.target.value) as RefreshIntervalSeconds)}
          >
            {REFRESH_INTERVAL_OPTIONS_SECONDS.map((seconds) => (
              <option key={seconds} value={seconds}>{seconds}s</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="lb-icon-button lb-header-theme-button"
          onClick={onThemeToggle}
          title={themeTitle}
          aria-label={themeTitle}
        >
          {isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}
        </button>

        <a
          className="lb-action lb-header-link"
          href={source}
          target="_blank"
          rel="noreferrer"
          aria-label="Open leaderboard API source"
          title="Open leaderboard API source"
        >
          <Database size={15} />
          <span>API</span>
          <ExternalLink size={13} />
        </a>

        <a
          className="lb-action lb-header-link"
          href={GITHUB_REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Open GitHub repository"
          title="Open GitHub repository"
        >
          <GitBranch size={15} />
          <span>GitHub</span>
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}
