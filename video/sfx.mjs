// Sound effects for the launch film, synthesised here (no samples, no licensing).
//   node video/sfx.mjs → video/sfx.wav (length from video/timeline.json)
// Every effect is placed from the timeline, so it lands on the beat it belongs to:
//   cut → soft whoosh on each scene cut · stat → warm bell on the figure · flash → soft shutter
//   chime → gentle ring when Companion circles the button · tap → small click on a button
//   stamp → thud on the LEARNED stamp · bell → soft bell under the closing line
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TL = JSON.parse(readFileSync(join(here, "timeline.json"), "utf8"));
const SR = 44100, DUR = TL.total, N = Math.ceil(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
const TWO_PI = Math.PI * 2;

let seed = 9001; // deterministic noise, so every render is identical
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

function add(start, len, fn, amp, pan = 0) {
  const s0 = Math.floor(start * SR), n = Math.floor(len * SR);
  for (let i = 0; i < n; i++) {
    const k = s0 + i; if (k < 0 || k >= N) continue;
    const v = fn(i / SR) * amp;
    L[k] += v * (0.5 - pan * 0.5); R[k] += v * (0.5 + pan * 0.5);
  }
}
const bell = f => t => (Math.sin(TWO_PI * f * t) * 0.7 + Math.sin(TWO_PI * f * 2.76 * t) * 0.25 + Math.sin(TWO_PI * f * 5.4 * t) * 0.06)
  * Math.exp(-t * 2.6) * Math.min(1, t / 0.005);
const chime = (start, f, amp, pan) => add(start, 3.2, bell(f), amp, pan);

let lp = 0;
function whoosh(start, amp, pan) {
  add(start, 1.0, t => {
    const env = Math.sin(Math.PI * Math.min(1, t / 1.0)) ** 2;
    lp += (rnd() - lp) * (0.02 + 0.5 * t);
    return lp * env * 0.9;
  }, amp, pan);
}
const tap = (start, amp, pan) => add(start, 0.06, t => (rnd() * 0.6 + Math.sin(TWO_PI * 1800 * t) * 0.4) * Math.exp(-t * 90), amp, pan);
const thud = (start, amp) => add(start, 0.5, t => Math.sin(TWO_PI * (110 * Math.exp(-t * 6)) * t) * Math.exp(-t * 9), amp, 0);
const shutter = (start, amp) => add(start, 0.12, t => rnd() * Math.exp(-t * 40), amp, 0);

// ---- place each effect from the timeline ----
let cutIndex = 0;
for (const b of TL.beats) {
  const at = b.speechStart;
  switch (b.cue) {
    case "cut":   whoosh(b.start - 0.25, 0.09, cutIndex++ % 2 ? 0.3 : -0.3); break;
    case "stat":  chime(at + 0.2, 659.3, 0.16, 0); break;
    case "chime": chime(at + 0.3, 987.8, 0.10, 0.4); break;
    case "flash": shutter(b.start + 0.05, 0.25); break;
    case "tap":   tap(at + 0.8, 0.16, -0.2); break;
    case "stamp": thud(at + 0.2, 0.22); break;
    case "bell":  chime(at, 523.25, 0.12, 0); chime(at + 0.6, 659.3, 0.08, 0.2); break;
  }
}

// ---- write 16-bit stereo WAV ----
const dataBytes = N * 2 * 2;
const buf = Buffer.alloc(44 + dataBytes);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(dataBytes, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
}
const out = join(here, "sfx.wav");
writeFileSync(out, buf);
console.log("wrote", out, `(${DUR}s, ${TL.beats.length} beats)`);
