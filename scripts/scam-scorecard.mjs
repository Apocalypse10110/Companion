/**
 * Scam scorecard: sends each message in evals/scam-set.json to Companion's real assistant and
 * records the verdict it gives ("scam", "suspicious", "safe"), exactly as returned. Nothing is rewritten.
 *
 *   npm run eval:scams                                  # against http://localhost:3000
 *   BASE_URL=https://your-site npm run eval:scams       # against the live site
 *
 * Counting: for a scam, "scam" or "suspicious" = caught. For a genuine message, "scam" or
 * "suspicious" = false alarm. No verdict (null) counts as not caught / not a false alarm, and is
 * listed separately so it's visible.
 * Writes evals/scam-results.json (or <SET>-results.json with SET=scam-holdout). Paces requests to stay under the server's rate limit.
 */
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const GAP_MS = Number(process.env.GAP_MS ?? 2200);
const SET = process.env.SET ?? "scam-set";
const set = JSON.parse(readFileSync(new URL(`../evals/${SET}.json`, import.meta.url), "utf8")).messages;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(text) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}/api/assistant`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `I got this message. Is it a scam? "${text}"`, history: [], language: "en-GB" }),
    });
    if (res.status === 429 || res.status >= 500) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error("server kept failing");
}

const rows = [];
for (const [i, m] of set.entries()) {
  let got = null;
  let reply = "";
  try {
    const d = await ask(m.text);
    got = d.scam ?? null;
    reply = (d.reply ?? "").slice(0, 160);
  } catch (e) {
    got = "error";
    reply = String(e.message);
  }
  rows.push({ id: m.id, kind: m.kind, expected: m.scam ? "scam" : "genuine", got, reply });
  process.stdout.write(`${String(i + 1).padStart(2)}/${set.length} ${m.id} ${m.scam ? "scam   " : "genuine"} -> ${got}\n`);
  await sleep(GAP_MS);
}

const flagged = (g) => g === "scam" || g === "suspicious";
const scams = rows.filter((r) => r.expected === "scam");
const genuine = rows.filter((r) => r.expected === "genuine");
const caught = scams.filter((r) => flagged(r.got)).length;
const falseAlarms = genuine.filter((r) => flagged(r.got)).length;
const noVerdict = rows.filter((r) => r.got === null || r.got === "error").map((r) => r.id);
const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => ({}));

const result = {
  when: new Date().toISOString(),
  site: BASE,
  model: health?.ai?.model ?? null,
  scams: { total: scams.length, caught, missed: scams.filter((r) => !flagged(r.got)).map((r) => r.id) },
  genuine: { total: genuine.length, falseAlarms, flagged: genuine.filter((r) => flagged(r.got)).map((r) => r.id) },
  noVerdict,
  rows,
};
writeFileSync(new URL(`../evals/${SET === "scam-set" ? "scam-results" : SET + "-results"}.json`, import.meta.url), JSON.stringify(result, null, 2));

console.log(`\nCaught ${caught} of ${scams.length} scams. ${falseAlarms} false alarms out of ${genuine.length} genuine messages.`);
if (result.scams.missed.length) console.log(`Missed scams: ${result.scams.missed.join(", ")}`);
if (result.genuine.flagged.length) console.log(`False alarms: ${result.genuine.flagged.join(", ")}`);
if (noVerdict.length) console.log(`No verdict given: ${noVerdict.join(", ")}`);
console.log(`Model: ${result.model ?? "unknown"}. Full results in evals/`);
