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
          className="-ml-2 inline-flex min-h-[var(--target)] w-fit items-center gap-2 rounded-2xl px-3 text-lg font-bold text-primary"
        >
          <ChevronLeft aria-hidden="true" className="size-7" strokeWidth={2.5} />
          {backLabel}
        </Link>
      )}
      <h1 className="text-3xl font-bold leading-tight text-ink">{title}</h1>
      {children}
    </header>
  );
}
