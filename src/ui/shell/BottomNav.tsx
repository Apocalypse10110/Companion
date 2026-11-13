"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, House, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "../components/cn";

const ITEMS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Home", icon: House },
  { href: "/skills", label: "My Skills", icon: Award },
  { href: "/safety", label: "Safety", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Four places, each an icon plus a word. The current one sits in a warm pill with a
 * heavier word and a filled marker, so it is not told apart by colour alone.
 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="bw shrink-0 border-x-0 border-b-0 bg-surface px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
      <ul className="grid grid-cols-4 gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // Labels grow with the text size but stop at 19px, so "Settings" never breaks mid-word in a
                  // quarter of a phone's width. Words wrap only between words ("My / Skills").
                  "relative flex min-h-[var(--target)] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-center text-[length:min(1rem,19px)] leading-tight [overflow-wrap:normal] [word-break:keep-all]",
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
