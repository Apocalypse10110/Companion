// Renders video/launch.html to an MP4, frame by frame.
//   node video/render.mjs                 full film → video/companion-launch.mp4
//   node video/render.mjs --stills 3,12   single frames → video/stills/t3.png …
// Needs Playwright (Chromium) and ffmpeg on PATH.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const args = process.argv.slice(2);
const stillsArg = args.includes("--stills") ? args[args.indexOf("--stills") + 1] : null;
const outFile = join(here, "companion-launch.mp4");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, "launch.html")).href + "?render");
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);

async function frameAt(t) {
  await page.evaluate(t => window.render(t), t);
  return page.screenshot({ type: "png" });
}

if (stillsArg) {
  mkdirSync(join(here, "stills"), { recursive: true });
  for (const t of stillsArg.split(",").map(Number)) {
    const buf = await frameAt(t);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(here, "stills", `t${t}.png`), buf);
    console.log("still", t);
  }
} else {
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outFile,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const total = Math.round(duration * FPS);
  for (let i = 0; i < total; i++) {
    const buf = await frameAt(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (i % 150 === 0) console.log(`frame ${i}/${total}`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on("close", c => (c === 0 ? res() : rej(new Error("ffmpeg exited " + c)))));
  console.log("wrote", outFile);
}
await browser.close();
