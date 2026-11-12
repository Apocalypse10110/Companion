import type { ReactNode } from "react";

/** Scrolling content area for any page that is not the home screen. */
export function ScrollPage({ children }: { children: ReactNode }) {
  return <div className="flex h-full flex-col gap-6 overflow-y-auto px-5 pb-8 pt-2">{children}</div>;
}
