// Sound effects for the launch film, synthesised here (no samples, no licensing).
//   node video/sfx.mjs → video/sfx.wav (71 s, 44.1 kHz, stereo)
// Soft whooshes on the scene cuts, a warm bell on the fraud figure, a gentle chime when Companion
// rings the button, small taps on the buttons, a thud on the lesson stamp, and a soft bell under the catchphrase.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SR = 44100, DUR = 71, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);
const TWO_PI = Math.PI * 2;

// deterministic noise so every render is identical
let seed = 9001;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

function add(start, len, fn, amp, pan = 0) {
  const s0 = Math.floor(start * SR), n = Math.floor(len * SR);
  for (let i = 0; i < n; i++) {
    const k = s0 + i; if (k < 0 || k >= N) continue;
    const v = fn(i / SR, i) * amp;
    L[k] += v * (0.5 - pan * 0.5); R[k] += v * (0.5 + pan * 0.5);
  }
}

// bell: two inharmonic partials with a long soft decay
const bell = (f) => (t) => (Math.sin(TWO_PI * f * t) * 0.7 + Math.sin(TWO_PI * f * 2.76 * t) * 0.25 + Math.sin(TWO_PI * f * 5.4 * t) * 0.06)
  * Math.exp(-t * 2.6) * Math.min(1, t / 0.005);
function chime(start, f, amp, pan) { add(start, 3.2, bell(f), amp, pan); }

// whoosh: band-limited noise sweeping up in pitch, fading in and out
let lp = 0;
function whoosh(start, amp, pan) {
  add(start, 1.2, (t) => {
    const env = Math.sin(Math.PI * Math.min(1, t / 1.2)) ** 2;
    lp += (rnd() - lp) * (0.02 + 0.5 * (t / 1.2));       // rising cutoff
    return lp * env * 0.9;
  }, amp, pan);
}

// tap: short soft click
function tap(start, amp, pan) {
  add(start, 0.06, (t) => (rnd() * 0.6 + Math.sin(TWO_PI * 1800 * t) * 0.4) * Math.exp(-t * 90), amp, pan);
}

// thud: low sine that drops in pitch, for the stamp
function thud(start, amp) {
  add(start, 0.5, (t) => Math.sin(TWO_PI * (110 * Math.exp(-t * 6)) * t) * Math.exp(-t * 9), amp, 0);
}

// ---- scene cuts: whooshes ----
[7.6, 16.2, 24.4, 30.2, 56.2, 62.8].forEach((t, i) => whoosh(t - 0.4, 0.09, i % 2 ? 0.3 : -0.3));

// ---- the fraud figure lands ----
chime(17.8, 659.3, 0.16, 0);

// ---- Show Me: Companion rings the button ----
chime(32.5, 987.8, 0.10, 0.4);

// ---- taps on the buttons ----
tap(34.0, 0.18, -0.2);   // "I've done it"
tap(51.2, 0.14, 0.2);    // the family note appears
tap(53.6, 0.14, 0);      // "Yes, share it"

// ---- skill bars fill ----
chime(45.6, 783.99, 0.07, -0.3);

// ---- lesson stamp ----
thud(59.8, 0.22);

// ---- catchphrase: a soft bell under the close ----
chime(64.4, 523.25, 0.12, 0);
chime(65.0, 659.3, 0.08, 0.2);

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
console.log("wrote", out);
