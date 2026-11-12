import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export interface ListLinkProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Runs before navigating, e.g. to save something first. */
  onClick?: () => void;
}

/** A big row that opens another page. Icon, words and an arrow, so it is obviously tappable. */
export function ListLink({ href, icon: Icon, title, description, onClick }: ListLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="bw flex min-h-[var(--target)] items-center gap-4 rounded-2xl bg-surface p-4 hover:bg-surface-2"
    >
      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-ink">
        <Icon className="size-7" strokeWidth={2.25} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xl font-bold text-ink">{title}</span>
        {description && <span className="text-base text-muted">{description}</span>}
      </span>
      <ChevronRight aria-hidden="true" className="size-7 shrink-0 text-muted" strokeWidth={2.5} />
    </Link>
  );
}
