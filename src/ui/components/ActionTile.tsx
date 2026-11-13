import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

interface Common {
  icon: LucideIcon;
  title: string;
  description: string;
  /** The main action on the screen gets the strongest colour. */
  tone?: "primary" | "plain";
  className?: string;
}

type ActionTileProps = Common & ({ href: string; onClick?: never; disabled?: never } | { href?: never; onClick: () => void; disabled?: boolean });

/**
 * A large, whole-card action: an icon, a short title and one line saying what happens.
 * Used for the home screen's three ways to get help. Text always visible; never icon alone.
 */
export function ActionTile({ icon: Icon, title, description, tone = "plain", className, ...rest }: ActionTileProps) {
  const classes = cn(
    "bw flex w-full min-h-[calc(var(--target)*1.3)] items-center gap-4 rounded-3xl px-4 py-3 text-left transition-[transform,background-color] duration-150 ease-out active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
    tone === "primary" ? "bg-primary text-on-primary" : "bg-surface text-ink hover:bg-surface-2",
    className,
  );
  const body = (
    <>
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", tone === "primary" ? "bg-on-primary/15" : "bg-accent-soft")}>
        <Icon aria-hidden="true" className="size-7" strokeWidth={2.25} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="display text-[1.375rem] font-bold leading-tight [overflow-wrap:anywhere]">{title}</span>
        <span className={cn("text-lg leading-snug", tone === "primary" ? "text-on-primary" : "text-muted")}>{description}</span>
      </span>
    </>
  );
  if (rest.href) {
    return (
      <Link href={rest.href} className={classes}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} onClick={rest.onClick} disabled={rest.disabled}>
      {body}
    </button>
  );
}
