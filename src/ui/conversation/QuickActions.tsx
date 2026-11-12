"use client";

import { Bell, LifeBuoy, MessageSquare, Phone, type LucideIcon } from "lucide-react";
import type { QuickActionId } from "@/contracts";
import { cn } from "../components/cn";
import { QUICK_ACTIONS } from "./types";

const ICONS: Record<QuickActionId, LucideIcon> = {
  call: Phone,
  messages: MessageSquare,
  reminders: Bell,
  help: LifeBuoy,
};

export interface QuickActionsProps {
  onSelect: (id: QuickActionId) => void;
  /** Smaller tiles, used under a running conversation. */
  compact?: boolean;
  disabled?: boolean;
}

/** Four big shortcuts. Each has an icon and a word. Tapping one asks the assistant, it never acts by itself. */
export function QuickActions({ onSelect, compact, disabled }: QuickActionsProps) {
  return (
    <section aria-labelledby="quick-actions-heading" className="flex flex-col gap-3">
      <h2 id="quick-actions-heading" className="text-xl font-bold text-ink">
        {compact ? "Anything else?" : "Or tap one of these"}
      </h2>
      <ul className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map(({ id, label }) => {
          const Icon = ICONS[id];
          return (
            <li key={id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(id)}
                className={cn(
                  "bw flex w-full items-center rounded-2xl bg-surface text-ink shadow-soft transition active:scale-[0.97] disabled:opacity-60",
                  compact
                    ? "min-h-[var(--target)] flex-row justify-start gap-3 px-4 py-3"
                    : "min-h-[calc(var(--target)*1.45)] flex-col justify-center gap-1.5 px-3 py-3",
                )}
              >
                <Icon aria-hidden="true" className={cn("shrink-0", compact ? "size-7" : "size-9")} strokeWidth={2.25} />
                <span className="text-lg font-bold leading-tight">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
