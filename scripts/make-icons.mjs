// Renders Companion's app icons (public/icon*.png, icon.svg, src/app/favicon.ico, apple-icon.png) from the
// drawn mark in src/ui/components/BrandMark.tsx. Run from the repo root: node scripts/make-icons.mjs [sheet.png]
import { createRequire } from "node:module"; import path from "node:path"; import { writeFileSync } from "node:fs";
const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("playwright-core");

const INK = "#1d1813", ORANGE = "#ff8a3d", CREAM = "#fbf8f3";
// The mark lives in a 48-unit box centred on (24,24); scale it into a 512 canvas.
const mark = (s) => `<g transform="translate(${256 - 24 * s} ${256 - 24 * s}) scale(${s})">
  <path d="M36.3 13.7A16 16 0 1 0 36.3 34.3" fill="none" stroke="${ORANGE}" stroke-width="7.5" stroke-linecap="round"/>
  <circle cx="35.5" cy="24" r="4.75" fill="${CREAM}"/></g>`;
const svg = ({ rounded, s }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="${INK}"/>${mark(s)}</svg>`;

const anySvg = svg({ rounded: true, s: 7.4 });       // launcher shows it as drawn
const maskSvg = svg({ rounded: false, s: 6.2 });     // full bleed; mark inside the 80% safe zone
writeFileSync("public/icon.svg", anySvg.replace("<svg ", '<svg role="img" aria-label="Companion" '));

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await b.newPage();
async function png(src, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${src.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  if (out) writeFileSync(out, buf);
  return buf;
}
await png(anySvg, 192, "public/icon-192.png");
await png(anySvg, 512, "public/icon-512.png");
await png(maskSvg, 512, "public/icon-maskable-512.png");
await png(maskSvg, 180, "src/app/apple-icon.png");
// favicon.ico: PNG images inside an ICO container (16, 32, 48).
const imgs = [];
for (const s of [16, 32, 48]) imgs.push([s, await png(anySvg, s)]);
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(imgs.length, 4);
let offset = 6 + 16 * imgs.length; const dir = [];
for (const [s, buf] of imgs) {
  const e = Buffer.alloc(16); e[0] = s; e[1] = s; e[2] = 0; e[3] = 0;
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
  dir.push(e); offset += buf.length;
}
writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...dir, ...imgs.map(([, b]) => b)]));
// Contact sheet for checking by eye.
await page.setViewportSize({ width: 760, height: 300 });
const sheet = (src, size, bg) => `<div style="background:${bg};padding:16px;display:inline-block"><img src="data:image/svg+xml;base64,${Buffer.from(src).toString("base64")}" width="${size}" height="${size}" style="${src === maskSvg ? "border-radius:50%" : ""}"></div>`;
await page.setContent(`<body style="margin:0">${sheet(anySvg, 192, "#fff")}${sheet(anySvg, 192, "#222")}${sheet(maskSvg, 192, "#e9e2d6")}<span>${[48,32,16].map(s=>sheet(anySvg,s,"#fff")).join("")}</span></body>`);
await page.screenshot({ path: process.argv[2] ?? "sheet.png" });
await b.close();
console.log("icons written");
