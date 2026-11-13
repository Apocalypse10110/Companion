"use client";

import { CircleHelp, OctagonAlert, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ScamCheck, ScamVerdict as Verdict } from "@/contracts";
import { cn } from "../components/cn";

const LOOKS: Record<Verdict, { icon: LucideIcon; title: string; box: string; lead: string }> = {
  scam: {
    icon: OctagonAlert,
    title: "STOP. This message may be a scam.",
    box: "bg-danger-soft border-danger",
    lead: "Don't tap any links, don't call numbers in it, and don't share codes or card details.",
  },
  suspicious: {
    icon: TriangleAlert,
    title: "Be careful. Some things look wrong.",
    box: "bg-accent-soft border-accent",
    lead: "Don't tap anything in it until you've checked another way.",
  },
  safe: {
    icon: ShieldCheck,
    title: "I didn't find warning signs.",
    box: "bg-success-soft border-success",
    lead: "That doesn't prove it's genuine. If anything feels odd, check with the company directly.",
  },
  unsure: {
    icon: CircleHelp,
    title: "I can't tell if this is real.",
    box: "bg-surface-2",
    lead: "When in doubt, don't tap anything in it. Check with the company directly.",
  },
};

/** How to check a message without using anything inside it. Shown for every verdict except "safe". */
export const VERIFY_STEPS = [
  "Don't reply, tap links or call numbers in the message.",
  "Contact the company yourself, using the number on your card, bill or their official website.",
  "Ask someone you trust to look at it with you.",
];

/**
 * The scam warning: a word title and an icon (never colour alone), what looks wrong, what not to
 * do, and how to check independently. It never says a message is definitely safe.
 */
export function ScamVerdict({ check, compact }: { check: ScamCheck; compact?: boolean }) {
  const look = LOOKS[check.verdict];
  const Icon = look.icon;
  return (
    <section
      aria-label="Scam check"
      role={check.verdict === "scam" ? "alert" : undefined}
      data-verdict={check.verdict}
      className={cn("bw flex flex-col gap-3 rounded-3xl border-4 px-4 py-4", look.box)}
    >
      <h3 className="flex items-start gap-3 text-2xl font-bold text-ink">
        <Icon aria-hidden="true" className="mt-0.5 size-8 shrink-0" strokeWidth={2.5} />
        <span>{look.title}</span>
      </h3>
      <p className="text-lg text-ink">{look.lead}</p>
      {check.reasons.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">{check.verdict === "safe" ? "What I looked at" : "What looks wrong"}</p>
          <ul className="flex list-disc flex-col gap-1 pl-6 text-lg text-ink">
            {check.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {!compact && check.verdict !== "safe" && (
        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">How to check safely</p>
          <ol className="flex list-decimal flex-col gap-1 pl-6 text-lg text-ink">
            {VERIFY_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-base text-muted">Companion can make mistakes. This is a warning, not a guarantee.</p>
    </section>
  );
}
