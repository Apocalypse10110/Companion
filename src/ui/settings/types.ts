/** Every preference the person can change. Each one changes real behaviour. */

export type TextSize = "standard" | "large" | "larger" | "largest";
export type ThemeChoice = "system" | "light" | "dark";
export type MotionChoice = "system" | "reduce" | "full";

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

  announcements: true,
  haptics: true,

  confirmActions: true,
  saveHistory: true,
};
