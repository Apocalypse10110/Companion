import {
  DEFAULT_SETTINGS,
  LANGUAGES,
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  TEXT_SCALE,
  VOLUME_MAX,
  VOLUME_MIN,
  type DetailChoice,
  type MotionChoice,
  type Settings,
  type TextSize,
  type ThemeChoice,
} from "./types";

export const SETTINGS_KEY = "companion.settings.v1";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** Turn anything (including corrupted storage) into a complete, valid Settings object. */
export function sanitizeSettings(input: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  return {
    version: 1,
    onboardingComplete: bool(o.onboardingComplete, d.onboardingComplete),

    textSize: pick<TextSize>(o.textSize, Object.keys(TEXT_SCALE) as TextSize[], d.textSize),
    boldText: bool(o.boldText, d.boldText),
    theme: pick<ThemeChoice>(o.theme, ["system", "light", "dark"], d.theme),
    highContrast: bool(o.highContrast, d.highContrast),
    motion: pick<MotionChoice>(o.motion, ["system", "reduce", "full"], d.motion),
    extraLargeButtons: bool(o.extraLargeButtons, d.extraLargeButtons),
    roomySpacing: bool(o.roomySpacing, d.roomySpacing),
    showQuickActions: bool(o.showQuickActions, d.showQuickActions),

    speakReplies: bool(o.speakReplies, d.speakReplies),
    speechRate: round1(clamp(num(o.speechRate, d.speechRate), SPEECH_RATE_MIN, SPEECH_RATE_MAX)),
    volume: round1(clamp(num(o.volume, d.volume), VOLUME_MIN, VOLUME_MAX)),
    voiceId: typeof o.voiceId === "string" && o.voiceId.length > 0 ? o.voiceId : null,
    language: pick<string>(o.language, LANGUAGES.map((l) => l.value), d.language),
    detail: pick<DetailChoice>(o.detail, ["short", "normal", "detailed"], d.detail),

    announcements: bool(o.announcements, d.announcements),
    haptics: bool(o.haptics, d.haptics),

    confirmActions: bool(o.confirmActions, d.confirmActions),
    saveHistory: bool(o.saveHistory, d.saveHistory),
  };
}

export function loadSettings(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Settings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeSettings(null);
  }
}

export function saveSettings(
  settings: Settings,
  storage: Pick<Storage, "setItem"> | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Storage full or blocked (private mode). Settings still work for this visit. */
  }
}

export function safeStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
