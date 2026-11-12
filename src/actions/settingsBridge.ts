/**
 * Lets the ActionService change Companion's own settings ("make the text bigger").
 * Settings live in Developer A's React SettingsProvider; `<PhoneBridge>` connects them here.
 * Owner: Developer C.
 */
import {
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  SPEECH_RATE_STEP,
  TEXT_SIZE_ORDER,
  VOLUME_MAX,
  VOLUME_MIN,
  VOLUME_STEP,
  type Settings,
  type TextSize,
} from "@/ui/settings/types";

export interface SettingsBridge {
  get(): Settings;
  update(patch: Partial<Settings>): void;
}

let bridge: SettingsBridge | null = null;

export function connectSettings(next: SettingsBridge): () => void {
  bridge = next;
  return () => {
    if (bridge === next) bridge = null;
  };
}

export function settingsBridge(): SettingsBridge | null {
  return bridge;
}

const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Work out the change for one accessibility action, and what to tell the person. */
export function planSetting(s: Settings, setting: string, value: string): { patch: Partial<Settings>; message: string } | null {
  const on = value === "on";
  switch (setting) {
    case "textSize": {
      const i = TEXT_SIZE_ORDER.indexOf(s.textSize);
      if (value === "increase") {
        if (i === TEXT_SIZE_ORDER.length - 1) return { patch: {}, message: "The text is already as big as it goes." };
        return { patch: { textSize: TEXT_SIZE_ORDER[i + 1] }, message: "The text is bigger now." };
      }
      if (value === "decrease") {
        if (i === 0) return { patch: {}, message: "The text is already at its smallest." };
        return { patch: { textSize: TEXT_SIZE_ORDER[i - 1] }, message: "The text is smaller now." };
      }
      if ((TEXT_SIZE_ORDER as string[]).includes(value)) return { patch: { textSize: value as TextSize }, message: "I've changed the text size." };
      return null;
    }
    case "highContrast":
      return { patch: { highContrast: on }, message: on ? "High contrast is on." : "High contrast is off." };
    case "theme":
      if (value !== "light" && value !== "dark" && value !== "system") return null;
      return {
        patch: { theme: value },
        message: value === "dark" ? "I've switched to dark colours." : value === "light" ? "I've switched to light colours." : "Colours now follow your phone.",
      };
    case "boldText":
      return { patch: { boldText: on }, message: on ? "Text is bold now." : "Bold text is off." };
    case "motion":
      return { patch: { motion: value === "reduce" ? "reduce" : "full" }, message: value === "reduce" ? "I've turned animations down." : "Animations are back on." };
    case "extraLargeButtons":
      return { patch: { extraLargeButtons: on }, message: on ? "Buttons are extra large now." : "Buttons are back to normal size." };
    case "speakReplies":
      return { patch: { speakReplies: on }, message: on ? "I'll read my answers aloud." : "I won't read my answers aloud. You can still tap Read aloud." };
    case "speechRate": {
      const next =
        value === "normal" ? 0.9 : clamp(round(s.speechRate + (value === "faster" ? SPEECH_RATE_STEP : -SPEECH_RATE_STEP)), SPEECH_RATE_MIN, SPEECH_RATE_MAX);
      if (next === s.speechRate) return { patch: {}, message: value === "faster" ? "I'm already talking as fast as I can." : "I'm already talking as slowly as I can." };
      return { patch: { speechRate: next }, message: value === "faster" ? "I'll talk a bit faster." : value === "slower" ? "I'll talk more slowly." : "I'm talking at normal speed." };
    }
    case "volume": {
      const next = clamp(round(s.volume + (value === "louder" ? VOLUME_STEP : -VOLUME_STEP)), VOLUME_MIN, VOLUME_MAX);
      if (next === s.volume) return { patch: {}, message: value === "louder" ? "My voice is already as loud as it goes. You can also use your phone's volume buttons." : "My voice is already as quiet as it goes." };
      return { patch: { volume: next }, message: value === "louder" ? "I'll speak louder." : "I'll speak more quietly." };
    }
    default:
      return null;
  }
}
