"use client";

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";

import { shortText } from "../format";

type CopyHotkeyButtonProps = {
  value: string;
  className?: string;
  start?: number;
  end?: number;
  title?: string;
  onClick?: () => void;
};

export function CopyHotkeyButton({ value, className, start = 8, end = 6, title, onClick }: CopyHotkeyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onClick?.();
    } catch {
      setCopied(false);
    }
  };

  if (!value || value === "-") {
    return <span className={className ?? "hotkey-copy-button"}>-</span>;
  }

  return (
    <button
      type="button"
      className={className ?? "hotkey-copy-button"}
      onClick={handleClick}
      title={title ?? `Copy hotkey ${value}`}
      aria-label={copied ? "Hotkey copied" : `Copy hotkey ${value}`}
    >
      {copied ? "Copied" : shortText(value, start, end)}
    </button>
  );
}
