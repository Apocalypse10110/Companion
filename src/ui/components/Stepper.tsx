"use client";

import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { cn } from "./cn";

export interface StepperProps {
  label: string;
  description?: string;
  /** Text describing the current value, for example "Normal". */
  valueText: string;
  decreaseLabel: string;
  increaseLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease: boolean;
  canIncrease: boolean;
  /** 0 to 1, drawn as a bar so the amount is visible at a glance. */
  fraction: number;
}

/**
 * Two big buttons instead of a slider: sliders are hard to hit with a shaky hand.
 * The current value is spoken by screen readers whenever it changes.
 */
export function Stepper({
  label,
  description,
  valueText,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
  canDecrease,
  canIncrease,
  fraction,
}: StepperProps) {
  const id = useId();
  const btn =
    "bw flex min-h-[var(--target)] min-w-0 items-center justify-center gap-2 rounded-2xl bg-surface px-3 py-2 text-lg font-bold text-ink disabled:opacity-40";
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="bw flex flex-col gap-4 rounded-2xl bg-surface p-4">
      <div className="flex flex-col gap-1">
        <span id={`${id}-label`} className="text-lg font-bold text-ink">
          {label}
        </span>
        {description && <span className="text-base text-muted">{description}</span>}
      </div>
      <div className="flex flex-col items-center gap-2">
        <span aria-live="polite" className="text-xl font-bold text-ink">
          {valueText}
        </span>
        <span aria-hidden="true" className="bw block h-3 w-full overflow-hidden rounded-full bg-surface-2">
          <span
            className={cn("block h-full bg-primary")}
            style={{ width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` }}
          />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={btn} onClick={onDecrease} disabled={!canDecrease}>
          <Minus aria-hidden="true" className="size-6 shrink-0" strokeWidth={2.5} />
          <span>{decreaseLabel}</span>
        </button>
        <button type="button" className={btn} onClick={onIncrease} disabled={!canIncrease}>
          <Plus aria-hidden="true" className="size-6 shrink-0" strokeWidth={2.5} />
          <span>{increaseLabel}</span>
        </button>
      </div>
    </div>
  );
}
