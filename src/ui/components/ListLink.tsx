import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type React from "react";

export interface ListLinkProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description?: string;
}

/**
 * A big row that opens another page. Icon, words and an arrow, so it is obviously tappable.
 * Rows are meant to sit together inside a <ListGroup>, which draws one outline and the dividers.
 */
export function ListLink({ href, icon: Icon, title, description }: ListLinkProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[var(--target)] items-center gap-4 px-4 py-4 hover:bg-surface-2"
    >
      <Icon aria-hidden="true" className="size-7 shrink-0 text-accent-ink" strokeWidth={2.25} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xl font-bold text-ink">{title}</span>
        {description && <span className="text-base text-muted">{description}</span>}
      </span>
      <ChevronRight aria-hidden="true" className="size-7 shrink-0 text-muted" strokeWidth={2.5} />
    </Link>
  );
}

/** One outlined group of rows with dividers between them, instead of a stack of separate cards. */
export function ListGroup({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="bw divide-y divide-line overflow-hidden rounded-3xl bg-surface">
      {children}
    </ul>
  );
}
