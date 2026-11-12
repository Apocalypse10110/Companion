"use client";

import { useId } from "react";
import { cn } from "./cn";

export interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * An on/off switch row. The whole row is the tap target, and the state is
 * written as "On" or "Off", never shown by colour alone.
 */
export function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-desc` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="bw flex min-h-[var(--target)] w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl bg-surface px-4 py-4 text-left disabled:opacity-60"
    >
      <span className="flex min-w-[min(12rem,100%)] flex-1 flex-col gap-1">
        <span id={`${id}-label`} className="text-lg font-bold text-ink">
          {label}
        </span>
        {description && (
          <span id={`${id}-desc`} className="text-base text-muted">
            {description}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-3" aria-hidden="true">
        <span className="min-w-[2.5ch] text-right text-lg font-bold text-ink">{checked ? "On" : "Off"}</span>
        <span
          className={cn(
            "bwc relative h-9 w-16 rounded-full transition-colors",
            checked ? "bg-primary" : "bg-surface-2",
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 size-7 -translate-y-1/2 rounded-full transition-all",
              checked ? "left-[calc(100%-2rem)] bg-on-primary" : "left-1 bg-ink",
            )}
          />
        </span>
      </span>
    </button>
  );
}
