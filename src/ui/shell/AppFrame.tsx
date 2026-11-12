"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { BrandMark } from "../components/BrandMark";
import { useConversation } from "../conversation/ConversationProvider";
import { useSettings } from "../settings/SettingsProvider";
import { BottomNav } from "./BottomNav";

/**
 * The phone-shaped frame around every screen: header, content, bottom navigation.
 * It also makes sure leaving a screen never leaves the microphone open, and that the
 * first time someone opens the app they land on the welcome walkthrough.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings, ready } = useSettings();
  const { interrupt } = useConversation();
  const main = useRef<HTMLElement>(null);
  const previous = useRef(pathname);

  const onboarding = pathname === "/onboarding";

  // First visit: go to the walkthrough.
  useEffect(() => {
    if (ready && !settings.onboardingComplete && !onboarding) router.replace("/onboarding");
  }, [ready, settings.onboardingComplete, onboarding, router]);

  // Changing screen: stop listening/speaking, and move focus to the new page for screen-reader users.
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    interrupt();
    main.current?.focus({ preventScroll: true });
  }, [pathname, interrupt]);

  if (!ready) {
    return (
      <div className="mx-auto grid h-dvh w-full max-w-[34rem] place-items-center" role="status">
        <div className="flex flex-col items-center gap-4">
          <BrandMark showTagline />
          <p className="text-xl text-muted">Getting ready…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[34rem] flex-col bg-bg">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="flex shrink-0 items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <BrandMark />
      </header>
      <main id="main" ref={main} tabIndex={-1} className="min-h-0 flex-1 overflow-hidden outline-none">
        {children}
      </main>
      {!onboarding && <BottomNav />}
    </div>
  );
}
