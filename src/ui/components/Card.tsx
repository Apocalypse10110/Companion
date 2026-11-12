import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "./cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bw rounded-3xl bg-surface p-4", className)} {...rest} />;
}

type Tone = "info" | "warning" | "error" | "success";

const TONES: Record<Tone, { box: string; icon: LucideIcon; word: string }> = {
  info: { box: "bg-primary-soft", icon: Info, word: "Note" },
  warning: { box: "bg-accent-soft", icon: TriangleAlert, word: "Heads up" },
  error: { box: "bg-danger-soft", icon: CircleAlert, word: "Problem" },
  success: { box: "bg-success-soft", icon: CircleCheck, word: "Done" },
};

export interface BannerProps {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  /** Buttons or links shown under the message. */
  actions?: ReactNode;
  /** Use role="alert" for things that need immediate attention. */
  urgent?: boolean;
}

/** A message box. Every tone has an icon AND a word, so colour is never the only clue. */
export function Banner({ tone = "info", title, children, actions, urgent }: BannerProps) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div role={urgent ? "alert" : "note"} className={cn("bw flex gap-4 rounded-2xl p-4", t.box)}>
      <Icon aria-hidden="true" className="mt-1 size-7 shrink-0 text-ink" strokeWidth={2.25} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-lg text-ink">
          <span className="font-bold">{title ?? t.word}. </span>
          {children}
        </p>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  );
}
