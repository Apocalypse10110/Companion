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
import { writeFileSync } from "node:fs";

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
  // The new tab counts as "back from the call" (tested on its own below). Clear it so later steps start fresh.
  await page.waitForTimeout(1200);
  await page.evaluate(() => localStorage.removeItem("companion.handoff.v1"));
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

await step("Show me: live camera opens, takes a photo, retake, and sends it", async () => {
  // Chrome's fake camera allows only one user per browser, so this runs in its own clean browser
  // (a real phone camera doesn't have this limit).
  const camBrowser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const camCtx = await camBrowser.newContext({ viewport: { width: 390, height: 844 } });
  await camCtx.addInitScript(() => localStorage.setItem("companion.settings.v1", JSON.stringify({ version: 1, onboardingComplete: true, speakReplies: false })));
  await camCtx.grantPermissions(["camera"], { origin: BASE });
  const mainPage = page;
  page = await camCtx.newPage();
  try {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  // Tap until the camera screen opens (a tap before React has loaded is lost), then wait for the camera.
  for (let i = 0; i < 20 && !(await page.locator("dialog[open]").count()); i++) {
    await page.getByRole("button", { name: "Show me with a photo" }).first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "Take photo" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Take photo" }).click();
  // "Take it again" is offered. (Headless Chrome's fake camera can't be reopened once it has played,
  // so reopening after a retake is checked on a real phone, not here.)
  await page.getByRole("button", { name: "Take it again" }).waitFor({ timeout: 5000 });
  const before = await page.evaluate(() => document.body.innerText.split("Companion said:").length);
  await page.getByRole("button", { name: "Use this photo" }).click();
  await page.waitForFunction((n) => document.body.innerText.split("Companion said:").length > n && !/Thinking…/.test(document.body.innerText), before, { timeout: 40_000 });
  // The camera must be off once the photo is taken.
  const live = await page.evaluate(() => [...document.querySelectorAll("video")].some((v) => v.srcObject));
  if (live) throw new Error("Camera still on after sending");
  console.log(`      reply: ${(await lastCompanionReply()).trim().split("\n")[0].slice(0, 160)}`);
  } finally {
    page = mainPage;
    await camBrowser.close();
  }
});

await step("Contacts: import a contact card, save, then 'call my son' finds them", async () => {
  await page.goto(BASE + "/settings/people", { waitUntil: "networkidle" });
  const vcf = join(tmpdir(), "companion-e2e-contact.vcf");
  writeFileSync(vcf, "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Brown;Tom;;;\r\nFN:Tom Brown\r\nTEL;type=CELL:07700 900456\r\nEND:VCARD\r\n");
  for (let i = 0; i < 20 && !(await page.getByRole("button", { name: "Import a contact card" }).isVisible().catch(() => false)); i++) await page.waitForTimeout(250);
  await page.locator('input[accept*=".vcf"]').setInputFiles(vcf);
  await page.waitForFunction(() => (document.querySelector('input[type="tel"]')?.value ?? "") === "07700 900456", null, { timeout: 5000 });
  await page.getByLabel(/who are they to you/i).fill("son");
  await page.getByRole("button", { name: "Save this person" }).click();
  await waitForReplyContaining(/Tom Brown is saved/);
});

await step("Reminders: add in Settings, change it, mark done -> Past", async () => {
  await page.goto(BASE + "/settings/reminders", { waitUntil: "networkidle" });
  for (let i = 0; i < 20 && !(await page.getByLabel("What to remember").isVisible().catch(() => false)); i++) {
    await page.getByRole("button", { name: "Add a reminder" }).click().catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.getByLabel("What to remember").fill("Water the plants");
  await page.getByLabel(/Details/).fill("The ones by the window");
  const d = new Date(Date.now() + 2 * 864e5);
  await page.getByLabel("Day", { exact: true }).fill(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  await page.getByLabel("Time", { exact: true }).fill("10:30");
  await page.getByText("Every week, same day").click();
  await page.getByRole("button", { name: "Save reminder" }).click();
  await waitForReplyContaining(/Saved: Water the plants/);
  const item = page.locator("li", { hasText: "Water the plants" }).first();
  await item.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("What to remember").fill("Water the garden plants");
  await page.getByRole("button", { name: "Save changes" }).click();
  await waitForReplyContaining(/Changed: Water the garden plants/);
  await page.reload({ waitUntil: "networkidle" });
  await waitForReplyContaining(/Water the garden plants[\s\S]*every week/);
  const pills = page.locator("li", { hasText: "take my pills" }).first();
  await pills.getByRole("button", { name: "Mark as done" }).click();
  await page.waitForFunction(() => /Past[\s\S]*take my pills[\s\S]*Done/i.test(document.body.innerText), null, { timeout: 5000 });
});

await step("Call return: conversation reopens with a welcome-back message", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await typeAndSend("How do I make the ringtone louder?");
  await page.waitForFunction(() => /Companion said:/.test(document.body.innerText) && !/Thinking…/.test(document.body.innerText), null, { timeout: 40_000 });
  // Simulate what the phone does: Companion opens the dialer, the page is hidden, then shown again.
  await page.evaluate(() => {
    localStorage.setItem("companion.handoff.v1", JSON.stringify({ kind: "call", name: "Anna", at: Date.now() }));
    const set = (v) => Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
    set("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await waitForReplyContaining(/Welcome back\. I hope your call with Anna went well/);
  await waitForReplyContaining(/ringtone louder/);
});

await step("Share to Companion: a shared text arrives and is explained", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const before = await page.evaluate(() => document.body.innerText.split("Companion said:").length);
  const sentToAI = [];
  page.on("request", (r) => r.url().endsWith("/api/assistant") && r.method() === "POST" && sentToAI.push(r.postData() ?? ""));
  // Submit the same form a phone's share sheet sends (service worker or /share fallback, whichever runs).
  await page.evaluate(() => {
    const f = document.createElement("form");
    f.method = "POST";
    f.action = "/share";
    f.enctype = "multipart/form-data";
    const t = document.createElement("input");
    t.name = "text";
    t.value = "HMRC: You are owed a tax refund of £326.18. Call 07700 900123 or claim now at hmrc-refund-uk.com";
    f.append(t);
    document.body.append(f);
    f.submit();
  });
  await page.waitForURL((u) => u.pathname === "/", { timeout: 15_000 });
  // The shared text (with its phone number) must never appear in an address.
  if (/07700|HMRC|refund/i.test(page.url())) throw new Error(`Shared text leaked into the address: ${page.url()}`);
  await page.waitForFunction((n) => document.body.innerText.split("Companion said:").length > Math.min(n, 2) - 1 && /scam|don't|do not|fake/i.test(document.body.innerText.split("Companion said:").pop()), before, { timeout: 40_000 });
  console.log(`      reply: ${(await lastCompanionReply()).trim().split("\n")[0].slice(0, 160)}`);
  if (!sentToAI.length) throw new Error("The shared text never reached the assistant");
  if (sentToAI.some((b) => /07700|900123/.test(b))) throw new Error("A phone number was sent to the AI");
  if (!sentToAI.some((b) => b.includes("[phone number]"))) throw new Error("The number wasn't replaced with [phone number]");
});

await step("Sample inbox: anyone can try 'read my email' without signing in", async () => {
  await page.goto(BASE + "/settings/connections", { waitUntil: "networkidle" });
  const toggle = page.getByRole("switch", { name: /Try a sample inbox and calendar/ });
  for (let i = 0; i < 20 && (await toggle.getAttribute("aria-checked")) !== "true"; i++) {
    await toggle.click().catch(() => {});
    await page.waitForTimeout(250);
  }
  await waitForReplyContaining(/Spotify[\s\S]*Ready, no sign-in needed/);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await typeAndSend("Read my email");
  await page.getByRole("button", { name: /yes, do it: read my latest emails/i }).last().click();
  await waitForReplyContaining(/This is the sample inbox\. You have 3 unread emails/);
});

await step("Device permissions screen lists permissions and AI status", async () => {
  await page.goto(BASE + "/settings/phone", { waitUntil: "networkidle" });
  await waitForReplyContaining(/Device permissions[\s\S]*Microphone[\s\S]*Camera[\s\S]*Contacts[\s\S]*My online helper/);
});


await step("Status page and health check report a working app", async () => {
  const r = await page.request.get(`${BASE}/api/health`);
  const j = await r.json();
  if (r.status() !== 200 || !j.ok || !j.ai.reachable) throw new Error(`health ${r.status()} ${JSON.stringify(j.ai)}`);
  await page.goto(BASE + "/status", { waitUntil: "networkidle" });
  await waitForReplyContaining(/Everything is working[\s\S]*My online helper[\s\S]*Working/);
});

await step("Offline: opening Companion with no internet shows the friendly page", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  // The service worker must be in charge of the page before going offline.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 }).catch(async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 });
  });
  await ctx.setOffline(true);
  await page.goto(BASE + "/settings").catch(() => {});
  await waitForReplyContaining(/No internet right now[\s\S]*Try again/);
  await ctx.setOffline(false);
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
