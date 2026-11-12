import { describe, expect, it } from "vitest";
import { BOOTSTRAP_SCRIPT } from "./bootstrap-script";
import { deriveDocumentAttributes, type SystemPreferences } from "./apply";
import { SETTINGS_KEY, loadSettings, sanitizeSettings, saveSettings } from "./storage";
import { DEFAULT_SETTINGS, TEXT_SCALE, type Settings } from "./types";

describe("sanitizeSettings", () => {
  it("fills a complete valid object from nothing", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("garbage")).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and rejects invalid ones field by field", () => {
    const s = sanitizeSettings({ textSize: "largest", theme: "purple", boldText: "yes", highContrast: true, voiceId: "" });
    expect(s.textSize).toBe("largest");
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(s.boldText).toBe(DEFAULT_SETTINGS.boldText);
    expect(s.highContrast).toBe(true);
    expect(s.voiceId).toBeNull();
  });

  it("clamps speech speed and volume into their safe ranges", () => {
    expect(sanitizeSettings({ speechRate: 99, volume: -5 })).toMatchObject({ speechRate: 1.4, volume: 0.2 });
    expect(sanitizeSettings({ speechRate: 0, volume: 7 })).toMatchObject({ speechRate: 0.6, volume: 1 });
    expect(sanitizeSettings({ speechRate: Number.NaN })).toMatchObject({ speechRate: DEFAULT_SETTINGS.speechRate });
  });
});

describe("load/save", () => {
  it("round-trips through storage", () => {
    saveSettings({ ...DEFAULT_SETTINGS, textSize: "larger", theme: "dark" });
    expect(loadSettings()).toMatchObject({ textSize: "larger", theme: "dark" });
  });

  it("survives corrupted storage", () => {
    window.localStorage.setItem(SETTINGS_KEY, "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("does not throw when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadSettings(blocked)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, blocked)).not.toThrow();
  });
});

describe("deriveDocumentAttributes", () => {
  const light: SystemPreferences = { prefersDark: false, prefersReducedMotion: false };

  it("follows the device when set to system, and the person when not", () => {
    expect(deriveDocumentAttributes(DEFAULT_SETTINGS, { prefersDark: true, prefersReducedMotion: false }).theme).toBe("dark");
    expect(deriveDocumentAttributes({ ...DEFAULT_SETTINGS, theme: "light" }, { prefersDark: true, prefersReducedMotion: false }).theme).toBe("light");
    expect(deriveDocumentAttributes(DEFAULT_SETTINGS, { prefersDark: false, prefersReducedMotion: true }).motion).toBe("reduce");
    expect(deriveDocumentAttributes({ ...DEFAULT_SETTINGS, motion: "full" }, { prefersDark: false, prefersReducedMotion: true }).motion).toBe("full");
  });

  it("maps every display setting", () => {
    const a = deriveDocumentAttributes(
      { ...DEFAULT_SETTINGS, textSize: "largest", highContrast: true, boldText: true, extraLargeButtons: true, roomySpacing: false, motion: "reduce" },
      light,
    );
    expect(a).toEqual({ theme: "light", contrast: "high", motion: "reduce", bold: "true", buttons: "xl", spacing: "normal", textScale: TEXT_SCALE.largest });
  });
});

describe("pre-paint script matches the React code", () => {
  const cases: Array<[string, Partial<Settings>, SystemPreferences]> = [
    ["nothing saved, light device", {}, { prefersDark: false, prefersReducedMotion: false }],
    ["nothing saved, dark + reduced motion device", {}, { prefersDark: true, prefersReducedMotion: true }],
    ["everything customised", { textSize: "largest", theme: "dark", highContrast: true, boldText: true, extraLargeButtons: true, roomySpacing: false, motion: "full" }, { prefersDark: false, prefersReducedMotion: true }],
    ["explicit light on a dark device", { theme: "light", textSize: "standard" }, { prefersDark: true, prefersReducedMotion: false }],
  ];

  for (const [name, patch, system] of cases) {
    it(name, () => {
      if (Object.keys(patch).length) window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(patch));
      window.matchMedia = ((q: string) => ({ matches: q.includes("dark") ? system.prefersDark : system.prefersReducedMotion })) as unknown as typeof window.matchMedia;

      new Function(BOOTSTRAP_SCRIPT)();

      const expected = deriveDocumentAttributes(sanitizeSettings(patch), system);
      const d = document.documentElement;
      expect(d.dataset.theme).toBe(expected.theme);
      expect(d.dataset.contrast).toBe(expected.contrast);
      expect(d.dataset.motion).toBe(expected.motion);
      expect(d.dataset.bold).toBe(expected.bold);
      expect(d.dataset.buttons).toBe(expected.buttons);
      expect(d.dataset.spacing).toBe(expected.spacing);
      expect(d.style.getPropertyValue("--text-scale")).toBe(String(expected.textScale));
    });
  }

  it("does not throw on corrupted storage", () => {
    window.localStorage.setItem(SETTINGS_KEY, "{oops");
    expect(() => new Function(BOOTSTRAP_SCRIPT)()).not.toThrow();
    expect(document.documentElement.dataset.theme).toBeDefined();
  });
});
