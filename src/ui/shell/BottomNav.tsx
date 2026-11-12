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

/** Three places, each an icon plus a word. The current one is marked in words for screen readers too. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="bw shrink-0 border-x-0 border-b-0 bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-3">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[calc(var(--target)*1.15)] flex-col items-center justify-center gap-1 px-2 py-2 text-base font-bold",
                  active ? "bg-primary text-on-primary" : "text-ink",
                )}
              >
                <Icon aria-hidden="true" className="size-7" strokeWidth={2.25} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
