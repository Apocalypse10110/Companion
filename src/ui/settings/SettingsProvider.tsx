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
import { applyToDocument, deriveDocumentAttributes, readSystemPreferences } from "./apply";
import { loadSettings, saveSettings } from "./storage";
import { DEFAULT_SETTINGS, type Settings } from "./types";

interface SettingsContextValue {
  settings: Settings;
  /** False until saved settings have been read from the device. */
  ready: boolean;
  /** True when animation should be avoided (setting or device preference). */
  motionReduced: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  children,
  initial,
}: {
  children: ReactNode;
  /** For tests: skip reading from the device. */
  initial?: Settings;
}) {
  const [settings, setSettings] = useState<Settings>(initial ?? DEFAULT_SETTINGS);
  const [ready, setReady] = useState(Boolean(initial));
  const [system, setSystem] = useState(readSystemPreferences);
  const loaded = useRef(Boolean(initial));

  // Read saved settings once, after the first render (keeps server and client markup identical).
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setSettings(loadSettings());
    setReady(true);
  }, []);

  // Follow the device's dark-mode and reduced-motion preferences while they are set to "system".
  useEffect(() => {
    if (!window.matchMedia) return;
    const queries = [
      window.matchMedia("(prefers-color-scheme: dark)"),
      window.matchMedia("(prefers-reduced-motion: reduce)"),
    ];
    const onChange = () => setSystem(readSystemPreferences());
    queries.forEach((q) => q.addEventListener("change", onChange));
    return () => queries.forEach((q) => q.removeEventListener("change", onChange));
  }, []);

  const attrs = useMemo(() => deriveDocumentAttributes(settings, system), [settings, system]);

  // Apply to the page whenever anything changes.
  useEffect(() => {
    applyToDocument(document.documentElement, attrs);
  }, [attrs]);

  // Save after every change (but never overwrite saved settings with defaults before loading).
  useEffect(() => {
    if (ready) saveSettings(settings);
  }, [settings, ready]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setSettings((prev) => ({ ...DEFAULT_SETTINGS, onboardingComplete: prev.onboardingComplete }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, ready, motionReduced: attrs.motion === "reduce", update, reset }),
    [settings, ready, attrs.motion, update, reset],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
