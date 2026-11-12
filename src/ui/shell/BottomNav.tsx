"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, House, Settings, type LucideIcon } from "lucide-react";
import { cn } from "../components/cn";

const ITEMS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Home", icon: House },
  { href: "/history", label: "History", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Three places, each an icon plus a word. The current one sits in a warm pill with a
 * heavier word and a filled marker, so it is not told apart by colour alone.
 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="bw shrink-0 border-x-0 border-b-0 bg-surface px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
      <ul className="grid grid-cols-3 gap-1.5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[var(--target)] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-base",
                  active ? "bw border-accent bg-accent-soft font-bold text-ink" : "text-muted hover:bg-surface-2",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn("size-7", active && "text-accent-ink")}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
