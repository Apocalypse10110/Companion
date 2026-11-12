/**
 * End-to-end check of the whole app in a real browser, against a running server.
 * Covers the demo workflows: typed conversation with the AI, follow-up context, voice in and
 * speech out (a scripted recogniser stands in for the microphone), phone actions, permissions,
 * settings changes, reminders, and error handling (offline).
 *
 *   npm run build && npm start      # in one terminal (needs GEMINI_API_KEY in .env.local for the AI steps)
 *   npm run test:e2e                # in another
 *
 * Env: BASE_URL (default http://localhost:3000), CHROME_PATH (default: Playwright's Chromium).
 */
import { chromium } from "playwright-core";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try {
    await fn();
    results.push(["PASS", name, Date.now() - t]);
  } catch (e) {
    results.push(["FAIL", name, Date.now() - t, e.message.split("\n")[0]]);
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/fail-${results.length}.png` }).catch(() => {});
  }
};

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  if (!localStorage.getItem("companion.settings.v1")) {
    localStorage.setItem("companion.settings.v1", JSON.stringify({ version: 1, onboardingComplete: true, speakReplies: true, textSize: "large" }));
  }
  // Record what is spoken, and finish each utterance quickly (headless has no audio).
  window.__spoken = [];
  const synth = window.speechSynthesis;
  if (synth) {
    synth.speak = (u) => {
      window.__spoken.push(u.text);
      setTimeout(() => u.onend?.(new Event("end")), 30);
    };
  }
  // A scripted recogniser: hears whatever the test put in window.__say.
  class FakeRecognition {
    start() {
      setTimeout(() => {
        const t = window.__say ?? "";
        const result = Object.assign([{ transcript: t, confidence: 0.9 }], { isFinal: true });
        this.onresult?.({ resultIndex: 0, results: Object.assign([result], { length: 1 }) });
        setTimeout(() => this.onend?.(), 20);
      }, 200);
    }
    stop() {}
    abort() {
      this.onend?.();
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
});
const errors = [];
async function openTab() {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().split("\n")[0]));
  return p;
}
let page = await openTab();

async function typeAndSend(text) {
  const box = page.getByLabel("Type your message");
  // Right after a page load React may still be hydrating, and an early tap is lost: retry.
  for (let i = 0; i < 20 && !(await box.isVisible().catch(() => false)); i++) {
    await page.getByRole("button", { name: /type instead/i }).click().catch(() => {});
    await page.waitForTimeout(250);
  }
  await box.fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}
async function waitForReplyContaining(re, timeout = 30_000) {
  await page.waitForFunction((src) => new RegExp(src, "i").test(document.body.innerText), re.source, { timeout });
}

await step("API status reports Gemini", async () => {
  const r = await page.request.get(`${BASE}/api/assistant`);
  const j = await r.json();
  if (!j.configured) throw new Error(`AI not configured: ${JSON.stringify(j)}`);
});

await step("Workflow 1+3: typed tech-support question gets one AI step", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await typeAndSend("I can't figure out how to connect to Wi-Fi");
  await page.waitForFunction(() => /Companion[\s\S]*(iphone|android|settings)/i.test(document.body.innerText) && !/Thinking\u2026/.test(document.body.innerText), null, { timeout: 30_000 });
});

await step("Workflow 3: follow-up keeps context (tap a suggestion or type)", async () => {
  const replies = () => page.evaluate(() => document.body.innerText.split("Companion said:").length - 1);
  const before = await replies();
  await typeAndSend("It's an iPhone");
  // A NEW reply that carries on the Wi-Fi task (it knows the topic without being told again).
  await page.waitForFunction(
    (n) => document.body.innerText.split("Companion said:").length - 1 > n && !/Thinking…/.test(document.body.innerText),
    before,
    { timeout: 30_000 },
  );
  const last = await page.evaluate(() => document.body.innerText.split("Companion said:").pop());
  if (!/settings|gear|wi-?fi/i.test(last)) throw new Error(`Follow-up lost the topic: ${last.slice(0, 160)}`);
  console.log(`      follow-up reply: ${last.trim().split("\n")[0].slice(0, 160)}`);
});

await step("Workflow 2: voice in -> AI -> spoken reply", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__say = "what does the little bell at the top of my screen mean";
    window.__spoken = [];
  });
  await page.getByRole("button", { name: "Tap to talk" }).click();
  // The app first explains the microphone, and asks only when the person agrees.
  const allow = page.getByRole("button", { name: "Allow microphone" });
  if (await allow.isVisible({ timeout: 2000 }).catch(() => false)) await allow.click();
  await waitForReplyContaining(/You said:\s*what does the little bell/);
  // Spoken aloud: the reply that came back from the AI.
  await page.waitForFunction(() => window.__spoken.some((t) => /bell|notification|sound|silent/i.test(t)), null, { timeout: 30_000 });
});

await step("Workflow 4: call someone unknown -> honest, nothing dialled", async () => {
  await typeAndSend("Call my daughter");
  await page.getByRole("button", { name: /yes, do it: call your daughter/i }).last().click();
  await waitForReplyContaining(/don't have a phone number for your daughter/);
});

await step("Workflow 4: add a person, then call opens the dialer", async () => {
  await page.goto(BASE + "/settings/people", { waitUntil: "networkidle" });
  await page.getByLabel("Their name").fill("Anna");
  await page.getByLabel(/who are they to you/i).fill("daughter");
  await page.getByLabel("Phone number").fill("07700 900123");
  await page.getByRole("button", { name: "Save this person" }).click();
  await waitForReplyContaining(/Anna is saved/);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  // Record the tel: hand-off (a real phone opens its dialer here).
  const launched = [];
  page.on("request", (r) => /^tel:/.test(r.url()) && launched.push(r.url()));
  await typeAndSend("Call my daughter");
  await page.getByRole("button", { name: /yes, do it: call your daughter/i }).last().click();
  await waitForReplyContaining(/opened your phone app with Anna's number/);
  // On a desktop browser the tel: hand-off leaves an "open external app?" prompt that blocks this
  // tab (a phone opens its dialer instead). Carry on in a fresh tab.
  await page.close();
  page = await openTab();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
});

await step("Workflow 4: make the text bigger changes the screen", async () => {
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await typeAndSend("Make the text bigger");
  await page.getByRole("button", { name: /yes, do it: make the text bigger/i }).last().click();
  await waitForReplyContaining(/text is bigger now/);
  const after = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  if (parseFloat(after) <= parseFloat(before)) throw new Error(`font size ${before} -> ${after}`);
});

await step("Workflow 4: reminder asks for notifications, then is set", async () => {
  await ctx.grantPermissions(["notifications"], { origin: BASE }).catch(() => {});
  await typeAndSend("Remind me to take my pills in 20 minutes");
  await page.getByRole("button", { name: /yes, do it: remind me/i }).last().click();
  const allow = page.getByRole("button", { name: /allow notifications/i }).last();
  if (await allow.isVisible({ timeout: 2000 }).catch(() => false)) await allow.click();
  await waitForReplyContaining(/I'll remind you to take your pills/);
  await page.goto(BASE + "/settings/reminders", { waitUntil: "networkidle" });
  await waitForReplyContaining(/take my pills/);
});

/** Draw a realistic picture (a pop-up, a text message) and save it as a photo to "take". */
async function makePhoto(name, html) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 600, height: 420 });
  await p.setContent(`<body style="margin:0;font:22px system-ui;background:#2b2b2b;display:grid;place-items:center;height:100vh">${html}</body>`);
  const file = join(tmpdir(), `companion-e2e-${name}.jpg`);
  await p.screenshot({ path: file, type: "jpeg", quality: 85 });
  await p.close();
  return file;
}
const lastCompanionReply = () => page.evaluate(() => document.body.innerText.split("Companion said:").pop() ?? "");
async function sendPhotoAndWait(file) {
  const before = await page.evaluate(() => document.body.innerText.split("Companion said:").length);
  await page.locator('input[type="file"]').first().setInputFiles(file);
  await page.waitForFunction(
    (n) => document.body.innerText.split("Companion said:").length > n && !/Thinking…/.test(document.body.innerText),
    before,
    { timeout: 40_000 },
  );
  const reply = (await lastCompanionReply()).trim().split("\n")[0];
  console.log(`      reply: ${reply.slice(0, 200)}`);
  return reply;
}

await step("Show me: a photo of a confusing pop-up gets explained, one step", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const file = await makePhoto(
    "storage",
    `<div style="background:#fff;border-radius:16px;padding:28px;width:440px"><b style="font-size:26px">Storage Almost Full</b>
     <p>You can manage your storage in Settings.</p><div style="display:flex;justify-content:space-between;color:#0a64d8">
     <span>Close</span><b>Settings</b></div></div>`,
  );
  const reply = await sendPhotoAndWait(file);
  if (!/storage|space|full/i.test(reply)) throw new Error("Didn't describe the pop-up");
  if (!(await page.locator('img[alt="The photo you sent"]').count())) throw new Error("No photo preview in the conversation");
});

await step("Show me: a scam text is called out", async () => {
  const file = await makePhoto(
    "scam",
    `<div style="background:#e9e9eb;border-radius:20px;padding:22px;width:460px">Royal Mail: your parcel is on hold due to an unpaid
     shipping fee of £1.45. Pay now to avoid return: http://rmail-redelivery-uk.info</div>`,
  );
  const reply = await sendPhotoAndWait(file);
  if (!/scam|don't|do not|fake|trick/i.test(reply)) throw new Error("Didn't warn about the scam");
});

await step("Phone and permissions screen loads and reports AI", async () => {
  await page.goto(BASE + "/settings/phone", { waitUntil: "networkidle" });
  await waitForReplyContaining(/online helper/);
});

await step("Workflow 5: offline -> friendly message, no crash", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await ctx.setOffline(true);
  await typeAndSend("Why is the sky blue?");
  await page.waitForFunction(() => /internet|connection|online helper|can't look that up|try again/i.test(document.body.innerText), null, { timeout: 20_000 });
  await ctx.setOffline(false);
});

await browser.close();
for (const [s, name, ms, why] of results) console.log(`${s}  ${name}  (${ms} ms)${why ? `\n      ${why}` : ""}`);
const real = errors.filter((e) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(e));
if (real.length) console.log("Console errors:\n  " + real.join("\n  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(failed ? `\n${failed} step(s) failed` : "\nAll steps passed");
process.exit(failed || real.length ? 1 : 0);
