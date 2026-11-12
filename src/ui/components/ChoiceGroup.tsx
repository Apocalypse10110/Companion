"use client";

import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "./cn";

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** Optional small preview (an icon, or "Aa" at the right size). Decorative. */
  preview?: ReactNode;
  hint?: string;
}

export interface ChoiceGroupProps<T extends string> {
  legend: string;
  description?: string;
  value: T;
  choices: Choice<T>[];
  onChange: (value: T) => void;
  columns?: 1 | 2;
}

/**
 * Pick one of a few big options. Built on real radio buttons, so arrow keys,
 * grouping and screen-reader announcements ("2 of 4") all work for free.
 */
export function ChoiceGroup<T extends string>({
  legend,
  description,
  value,
  choices,
  onChange,
  columns = 1,
}: ChoiceGroupProps<T>) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-xl font-bold text-ink">{legend}</legend>
      {description && <p className="-mt-1 text-base text-muted">{description}</p>}
      <div className={cn("grid gap-3", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {choices.map((choice) => {
          const id = `${name}-${choice.value}`;
          const selected = choice.value === value;
          return (
            <div key={choice.value}>
              <input
                id={id}
                type="radio"
                name={name}
                value={choice.value}
                checked={selected}
                onChange={() => onChange(choice.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={cn(
                  "bw flex min-h-[var(--target)] cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3 text-lg font-bold",
                  "peer-focus-visible:outline-4 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-focus",
                  selected ? "border-primary bg-primary text-on-primary" : "bg-surface text-ink hover:bg-surface-2",
                )}
              >
                {choice.preview && (
                  <span aria-hidden="true" className="grid min-w-10 place-items-center">
                    {choice.preview}
                  </span>
                )}
                <span className="flex flex-col">
                  <span>{choice.label}</span>
                  {choice.hint && (
                    <span className={cn("text-base font-normal", selected ? "text-on-primary" : "text-muted")}>
                      {choice.hint}
                    </span>
                  )}
                </span>
                {selected && (
                  <span className="ml-auto flex items-center gap-1.5 text-base" aria-hidden="true">
                    <Check className="size-5 shrink-0" strokeWidth={3} />
                    Selected
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
