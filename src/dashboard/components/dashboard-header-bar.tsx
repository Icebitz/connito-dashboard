"use client";

import type { ReactNode } from "react";
import { Clock3, Database, ExternalLink, GitBranch } from "lucide-react";

import {
  GITHUB_REPOSITORY_URL,
  REFRESH_INTERVAL_OPTIONS_SECONDS,
  type RefreshIntervalSeconds
} from "../constants";
import { CONNITO_LOGO_URL } from "../brand";
import { formatInteger } from "../format";

type DashboardHeaderBarProps = {
  netuid: number;
  source: string;
  refreshIntervalSeconds: RefreshIntervalSeconds;
  subtitle?: ReactNode;
  onRefreshIntervalChange: (seconds: RefreshIntervalSeconds) => void;
};

export function DashboardHeaderBar({
  netuid,
  source,
  refreshIntervalSeconds,
  subtitle,
  onRefreshIntervalChange
}: DashboardHeaderBarProps) {
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
