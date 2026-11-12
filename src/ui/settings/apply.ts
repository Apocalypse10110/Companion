import { TEXT_SCALE, type Settings } from "./types";

export interface SystemPreferences {
  prefersDark: boolean;
  prefersReducedMotion: boolean;
}

export interface DocumentAttributes {
  theme: "light" | "dark";
  contrast: "standard" | "high";
  motion: "reduce" | "full";
  bold: "true" | "false";
  buttons: "large" | "xl";
  spacing: "roomy" | "normal";
  textScale: number;
}

/** Pure: what the page should look like for these settings and this device. */
export function deriveDocumentAttributes(
  settings: Settings,
  system: SystemPreferences,
): DocumentAttributes {
  return {
    theme: settings.theme === "system" ? (system.prefersDark ? "dark" : "light") : settings.theme,
    contrast: settings.highContrast ? "high" : "standard",
    motion:
      settings.motion === "system"
        ? system.prefersReducedMotion
          ? "reduce"
          : "full"
        : settings.motion,
    bold: settings.boldText ? "true" : "false",
    buttons: settings.extraLargeButtons ? "xl" : "large",
    spacing: settings.roomySpacing ? "roomy" : "normal",
    textScale: TEXT_SCALE[settings.textSize],
  };
}

export function applyToDocument(root: HTMLElement, attrs: DocumentAttributes): void {
  root.dataset.theme = attrs.theme;
  root.dataset.contrast = attrs.contrast;
  root.dataset.motion = attrs.motion;
  root.dataset.bold = attrs.bold;
  root.dataset.buttons = attrs.buttons;
  root.dataset.spacing = attrs.spacing;
  root.style.setProperty("--text-scale", String(attrs.textScale));
}

export function readSystemPreferences(): SystemPreferences {
  if (typeof window === "undefined" || !window.matchMedia) {
    return { prefersDark: false, prefersReducedMotion: false };
  }
  return {
    prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
    prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}
