/** Every preference the person can change. Each one changes real behaviour. */

export type TextSize = "standard" | "large" | "larger" | "largest";
export type ThemeChoice = "system" | "light" | "dark";
export type MotionChoice = "system" | "reduce" | "full";
/** How much Companion explains. */
export type DetailChoice = "short" | "normal" | "detailed";

/** Languages offered in Settings. "auto" follows the phone, and Companion also follows the person's own words. */
export const LANGUAGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "auto", label: "Same as my phone" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
  { value: "it-IT", label: "Italiano" },
  { value: "pt-BR", label: "Português" },
  { value: "zh-CN", label: "中文" },
  { value: "hi-IN", label: "हिन्दी" },
  { value: "ar-SA", label: "العربية" },
];

export interface Settings {
  version: 1;
  /** First-run walkthrough finished (or skipped). */
  onboardingComplete: boolean;

  // Display
  textSize: TextSize;
  boldText: boolean;
  theme: ThemeChoice;
  highContrast: boolean;
  motion: MotionChoice;
  extraLargeButtons: boolean;
  roomySpacing: boolean;
  showQuickActions: boolean;

  // Voice
  speakReplies: boolean;
  /** 0.6 (slow) to 1.4 (fast). 1 is normal. */
  speechRate: number;
  /** 0.2 (quiet) to 1 (loud). */
  volume: number;
  voiceId: string | null;
  /** "auto" or a BCP 47 tag from LANGUAGES. Used for listening, speaking and the AI's replies. */
  language: string;
  /** Short, normal or detailed explanations. */
  detail: DetailChoice;

  // Accessibility
  announcements: boolean;
  haptics: boolean;

  // Safety and privacy
  /** Ask before doing anything. High-risk actions are always asked, whatever this says. */
  confirmActions: boolean;
  saveHistory: boolean;
}

export const TEXT_SCALE: Record<TextSize, number> = {
  standard: 1,
  large: 1.2,
  larger: 1.4,
  largest: 1.65,
};

export const TEXT_SIZE_ORDER: TextSize[] = ["standard", "large", "larger", "largest"];

export const SPEECH_RATE_MIN = 0.6;
export const SPEECH_RATE_MAX = 1.4;
export const SPEECH_RATE_STEP = 0.1;
export const VOLUME_MIN = 0.2;
export const VOLUME_MAX = 1;
export const VOLUME_STEP = 0.2;

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  onboardingComplete: false,

  textSize: "large",
  boldText: false,
  theme: "system",
  highContrast: false,
  motion: "system",
  extraLargeButtons: false,
  roomySpacing: true,
  showQuickActions: true,

  speakReplies: true,
  speechRate: 0.9,
  volume: 1,
  voiceId: null,
  language: "auto",
  detail: "normal",

  announcements: true,
  haptics: true,

  confirmActions: true,
  saveHistory: true,
};
