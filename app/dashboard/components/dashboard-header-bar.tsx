"use client";

import { Database, ExternalLink, GitBranch, MoonStar, SunMedium } from "lucide-react";

import { GITHUB_REPOSITORY_URL } from "../constants";
import { formatInteger } from "../format";
import type { Theme } from "../types";

type DashboardHeaderBarProps = {
  netuid: number;
  source: string;
  theme: Theme;
  subtitle: string;
  onThemeToggle: () => void;
};

export function DashboardHeaderBar({
  netuid,
  source,
  theme,
  subtitle,
  onThemeToggle
}: DashboardHeaderBarProps) {
  const isDark = theme === "dark";
  const themeTitle = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <div className="lb-header-top lb-panel lb-header-bar">
      <div className="lb-brand-copy">
        <div className="lb-brand-line">
          <h1 className="lb-header-title">
            Connito Leaderboard <span>SN{formatInteger(netuid)}</span>
          </h1>
        </div>
        <div className="lb-header-subline">{subtitle}</div>
      </div>

      <div className="lb-header-actions">
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
