"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSettings } from "../settings/SettingsProvider";

type Politeness = "polite" | "assertive";
type Announce = (message: string, politeness?: Politeness) => void;

const AnnounceContext = createContext<Announce>(() => {});

/**
 * One shared, invisible live region. Screen readers speak whatever is put in it.
 * Use for things that happen without the person moving focus: "Listening",
 * "Thinking", a new reply, an action finishing.
 */
export function LiveAnnouncer({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const enabled = settings.announcements;
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback<Announce>(
    (message, politeness = "polite") => {
      if (!enabled) return;
      const set = politeness === "assertive" ? setAssertive : setPolite;
      // Clear first so the same sentence twice in a row is still announced.
      set("");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => set(message), 60);
    },
    [enabled],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => announce, [announce]);

  return (
    <AnnounceContext.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true" role="status" data-testid="live-polite">
        {polite}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true" role="alert" data-testid="live-assertive">
        {assertive}
      </div>
    </AnnounceContext.Provider>
  );
}

export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}
