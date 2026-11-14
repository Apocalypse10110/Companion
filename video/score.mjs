// Original calm score for the launch film. Synthesised here, so there are no samples or licensing questions.
//   node video/score.mjs  → video/score.wav (60 s, 44.1 kHz, stereo, 16-bit)
// Soft pad chords (D – Bm – G – A) with gentle piano-like plucks, a swell at the start,
// a lift under the catchphrase (about 52 s), and a fade over the last 3 s.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SR = 44100, DUR = 60, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);

const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
const TWO_PI = Math.PI * 2;

// chords as MIDI notes, one chord every 7.5 s
const CHORDS = [
  [50, 57, 66, 74], // D
  [47, 54, 62, 69], // Bm
  [43, 50, 59, 67], // G
  [45, 52, 61, 69], // A
];
const CHORD_LEN = 7.5;

// ---- soft pad: detuned triangles with slow attack and release ----
function pad(t0, midi, dur, amp, pan) {
  const start = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  const f = hz(midi);
  for (let i = 0; i < len; i++) {
    const n = start + i; if (n >= N) break;
    const t = i / SR;
    const att = Math.min(1, t / 1.8), rel = Math.min(1, (dur - t) / 2.2);
    const env = att * att * rel * rel;
    const s = 0.5 * tri(f * 0.997 * t * TWO_PI) + 0.5 * tri(f * 1.003 * t * TWO_PI);
    const v = s * env * amp;
    L[n] += v * (0.5 - pan * 0.5); R[n] += v * (0.5 + pan * 0.5);
  }
}
const tri = p => (2 / Math.PI) * Math.asin(Math.sin(p));

// ---- piano-like pluck: sine + harmonics with exponential decay ----
function pluck(t0, midi, amp, pan) {
  const start = Math.floor(t0 * SR), len = Math.floor(3.2 * SR);
  const f = hz(midi);
  for (let i = 0; i < len; i++) {
    const n = start + i; if (n >= N) break;
    const t = i / SR;
    const env = Math.exp(-t * 1.6) * Math.min(1, t / 0.008);
    const s = Math.sin(TWO_PI * f * t) + 0.35 * Math.sin(TWO_PI * 2 * f * t) * Math.exp(-t * 3)
            + 0.12 * Math.sin(TWO_PI * 3 * f * t) * Math.exp(-t * 5);
    const v = s * env * amp;
    L[n] += v * (0.5 - pan * 0.5); R[n] += v * (0.5 + pan * 0.5);
  }
}

// ---- compose ----
CHORDS.forEach((notes, c) => {
  const t0 = c * CHORD_LEN;
  notes.forEach((m, j) => pad(t0 + j * 0.06, m, CHORD_LEN + 0.6, 0.075, j % 2 ? 0.3 : -0.3));
});

// gentle melody: chord tones an octave up, one note about every 1.25 s, slightly more in the lift
const MELODY = [74, 69, 66, 71, 74, 78, 74, 69, 67, 71, 74, 71, 69, 66, 62, 66, 69, 74, 71, 67, 66, 69, 74, 78, 74, 71, 69, 66, 69, 74];
let tm = 1.5, k = 0;
while (tm < DUR - 4) {
  const density = tm > 44 && tm < 56 ? 0.95 : 1.25; // a little busier under the montage and catchphrase
  pluck(tm, MELODY[k % MELODY.length], 0.22 + (tm > 50 ? 0.05 : 0), k % 2 ? 0.25 : -0.25);
  tm += density; k++;
}

// the lift: a soft high shimmer under the catchphrase (starts at 52 s)
[86, 90].forEach((m, j) => pad(52, m, 8, 0.03, j ? 0.4 : -0.4));

// ---- simple stereo room: a few decaying delayed copies ----
function echo(buf, taps) {
  const out = new Float32Array(buf);
  for (const [d, g] of taps) {
    const ds = Math.floor(d * SR);
    for (let i = ds; i < N; i++) out[i] += buf[i - ds] * g;
  }
  return out;
}
const TAPS = [[0.031, 0.22], [0.047, 0.18], [0.083, 0.12], [0.121, 0.08]];
const WL = echo(L, TAPS), WR = echo(R, TAPS.map(([d, g]) => [d + 0.007, g]));
for (let i = 0; i < N; i++) { L[i] = WL[i]; R[i] = WR[i]; }

// ---- envelope: swell in over 2.5 s, fade out over the last 3 s ----
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = Math.min(1, t / 2.5) * Math.min(1, (DUR - t) / 3);
  L[i] *= g; R[i] *= g;
}

// ---- write 16-bit stereo WAV ----
const dataBytes = N * 2 * 2;
const buf = Buffer.alloc(44 + dataBytes);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(dataBytes, 40);
let peak = 0;
for (let i = 0; i < N; i++) {
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const scale = peak > 0.89 ? 0.89 / peak : 1; // headroom so it never clips
for (let i = 0; i < N; i++) {
  const l = Math.max(-1, Math.min(1, L[i] * scale)), r = Math.max(-1, Math.min(1, R[i] * scale));
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
const out = join(here, "score.wav");
writeFileSync(out, buf);
console.log("wrote", out, "peak before scale", peak.toFixed(3));
