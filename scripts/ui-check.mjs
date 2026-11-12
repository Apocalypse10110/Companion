/**
 * Real-browser layout check. Opens every screen at a small phone size with the most extreme
 * settings (largest text, bold, dark high contrast, extra large buttons) and at normal settings,
 * then fails if anything spills sideways, content overflows its own box, any tappable thing is
 * under 44px, or the console errors.
 *
 *   npm run build && npm start            # in one terminal (port 3000)
 *   npm run test:ui                       # in another
 *
 * Env: BASE_URL (default http://localhost:3000), CHROME_PATH (default: Playwright's own Chromium),
 *      SHOTS_DIR (optional: save a screenshot of every screen there).
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const ROUTES = ["/", "/history", "/settings", "/settings/display", "/settings/voice", "/settings/accessibility", "/settings/privacy", "/settings/connections", "/onboarding"];
const SCENARIOS = {
  extreme: { viewport: { width: 360, height: 640 }, settings: { textSize: "largest", theme: "dark", highContrast: true, extraLargeButtons: true, boldText: true } },
  normal: { viewport: { width: 390, height: 844 }, settings: { textSize: "large", theme: "light" } },
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] });
let failures = 0;
for (const [name, { viewport, settings }] of Object.entries(SCENARIOS)) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().split("\n")[0]));
  await page.addInitScript((s) => localStorage.setItem("companion.settings.v1", JSON.stringify({ version: 1, onboardingComplete: true, ...s })), settings);

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const visible = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.closest("[inert]") && !e.classList.contains("sr-only") && !e.classList.contains("skip-link"); };
      const spill = [...document.querySelectorAll("body *")].filter((e) => visible(e) && (e.getBoundingClientRect().right > vw + 1 || e.getBoundingClientRect().left < -1)).map((e) => e.tagName.toLowerCase());
      const small = [...document.querySelectorAll("button, a[href], summary, textarea, input:not(.sr-only)")].filter(visible).filter((e) => { const b = e.getBoundingClientRect(); return b.height < 44 || b.width < 44; }).map((e) => `${(e.innerText || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 30)} (${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)})`);
      // Content poking out of its own box (e.g. a squashed row whose switch overlaps the next row).
      const clipped = [...document.querySelectorAll("button, a[href], label, [role=group], [role=note], [role=alert], li")].filter(visible).filter((e) => e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY === "visible").map((e) => `${(e.innerText || e.tagName).trim().slice(0, 30)} (${e.clientHeight}px box, ${e.scrollHeight}px content)`);
      return { pageScroll: document.documentElement.scrollWidth > vw, spill: spill.slice(0, 3), small: small.slice(0, 5), clipped: clipped.slice(0, 5) };
    });
    const ok = !r.pageScroll && r.spill.length === 0 && r.small.length === 0 && r.clipped.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name.padEnd(7)} ${route}${ok ? "" : "  " + JSON.stringify(r)}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}${route.replace(/\//g, "_") || "_home"}.png` });
  }
  if (errors.length) {
    failures++;
    console.log(`FAIL ${name} console errors: ${[...new Set(errors)].join(" | ")}`);
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} problem(s)` : "\nAll screens pass.");
process.exit(failures ? 1 : 0);
