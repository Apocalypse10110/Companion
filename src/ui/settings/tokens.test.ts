import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Reads the real colour tokens out of globals.css and checks WCAG contrast for each theme. */

// Normalise line endings so the block lookup works on Windows checkouts (CRLF) too.
const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8").replace(/\r\n/g, "\n");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector + " {");
  if (start < 0) throw new Error(`missing block ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--c-([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) vars[m[1]] = m[2];
  return vars;
}

const light = block(':root[data-theme="light"]') ;
const themes: Record<string, Record<string, string>> = {
  light: { ...block(":root,\n:root[data-theme=\"light\"]") },
  dark: block(':root[data-theme="dark"]'),
  "light high-contrast": block(':root[data-theme="light"][data-contrast="high"]'),
  "dark high-contrast": block(':root[data-theme="dark"][data-contrast="high"]'),
};
void light;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio, what it is used for]
const TEXT: Array<[string, string, number]> = [
  ["ink", "bg", 7],
  ["ink", "surface", 7],
  ["ink", "surface-2", 7],
  ["ink", "primary-soft", 7],
  ["ink", "accent-soft", 7],
  ["ink", "danger-soft", 7],
  ["ink", "success-soft", 7],
  ["muted", "bg", 4.5],
  ["muted", "surface", 4.5],
  ["muted", "surface-2", 4.5],
  ["muted", "primary-soft", 4.5],
  ["on-primary", "primary", 4.5],
  ["primary", "bg", 4.5],
  ["primary", "surface", 4.5],
  ["on-accent", "accent", 4.5],
  ["accent-ink", "bg", 4.5],
  ["accent-ink", "surface", 4.5],
  ["accent-ink", "accent-soft", 4.5],
  ["success", "success-soft", 4.5],
  ["on-danger", "danger", 4.5],
];
// Non-text parts a person must see: focus ring and form-control borders (WCAG 1.4.11, 3:1).
const UI: Array<[string, string, number]> = [
  ["focus", "bg", 3],
  ["focus", "surface", 3],
  // The microphone disc must stand out from the page around it.
  ["accent", "bg", 3],
  ["control", "bg", 3],
  ["control", "surface", 3],
  ["control", "surface-2", 3],
];

describe("colour tokens meet WCAG", () => {
  for (const [theme, t] of Object.entries(themes)) {
    describe(theme, () => {
      it("defines every token", () => {
        for (const k of ["bg", "surface", "surface-2", "ink", "muted", "line", "control", "primary", "on-primary", "primary-soft", "accent", "on-accent", "accent-soft", "accent-ink", "danger", "on-danger", "danger-soft", "success", "success-soft", "focus"]) {
          expect(t[k], `--c-${k}`).toMatch(/^#[0-9a-f]{6}$/i);
        }
      });
      for (const [fg, bg, min] of [...TEXT, ...UI]) {
        // High-contrast themes aim higher (AAA) for ordinary text.
        const need = theme.includes("high") && min === 4.5 ? 7 : min;
        it(`${fg} on ${bg} is at least ${need}:1`, () => {
          expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(need);
        });
      }
    });
  }

  it("the contrast helper agrees with known values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
});
