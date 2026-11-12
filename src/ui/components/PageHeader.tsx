import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  /** Where "Back" goes. Omit on top-level pages. */
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
}

/** Page title. The only h1 on each page. Back is always a labelled link, never just an arrow. */
export function PageHeader({ title, backHref, backLabel = "Back", children }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {backHref && (
        <Link
          href={backHref}
          className="-ml-2 inline-flex min-h-[var(--target)] w-fit items-center gap-1.5 rounded-2xl px-3 text-lg font-bold text-ink hover:bg-surface-2"
        >
          <ChevronLeft aria-hidden="true" className="size-7 text-accent-ink" strokeWidth={2.5} />
          {backLabel}
        </Link>
      )}
      <h1 className="display text-[2.125rem] text-ink">{title}</h1>
      {children}
    </header>
  );
}
