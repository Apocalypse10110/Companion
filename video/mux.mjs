// Adds the score, the narration and the sound effects to the silent film.
//   video/companion-launch.mp4 (silent) + video/score.wav + video/voice/narration.wav + video/sfx.wav
//   → video/companion-launch.mp4 (with sound)
// Mix: the score is softened (low-pass, quieter) and sits under the voice; the sound effects are light;
// a gentle compressor evens the level so the voice stays calm; the result is normalised to -15 LUFS;
// the film fades in over 1.5 s and out over the last 3 s. The video stream is copied, not re-encoded.
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const film = join(here, "companion-launch.mp4");
const score = join(here, "score.wav");
const narration = join(here, "voice", "narration.wav");
const sfx = join(here, "sfx.wav");
const tmp = join(here, "companion-launch-sound.tmp.mp4");

const args = ["-loglevel", "error", "-y", "-i", film, "-i", score];
const hasVoice = existsSync(narration);
const hasSfx = existsSync(sfx);
if (hasVoice) args.push("-i", narration);
if (hasSfx) args.push("-i", sfx);

// input indexes: 0 = film, 1 = score, then narration (if any), then sfx (if any)
const voiceIdx = hasVoice ? 2 : -1;
const sfxIdx = hasSfx ? (hasVoice ? 3 : 2) : -1;

const parts = [
  "[1:a]lowpass=f=4200,highpass=f=60,volume=0.38[sc]",
];
const inputs = ["[sc]"];
if (hasVoice) {
  parts.push(`[${voiceIdx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=1.0[nv]`);
  inputs.push("[nv]");
}
if (hasSfx) {
  parts.push(`[${sfxIdx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=1.8[fx]`);
  inputs.push("[fx]");
}
parts.push(`${inputs.join("")}amix=inputs=${inputs.length}:normalize=0:dropout_transition=0[m]`);
parts.push(
  "[m]acompressor=threshold=-20dB:ratio=2.5:attack=25:release=300:makeup=2," +
  "loudnorm=I=-15:TP=-1.5:LRA=9," +
  "afade=t=in:d=1.5,afade=t=out:st=68:d=3[out]"
);

args.push("-filter_complex", parts.join(";"), "-map", "0:v:0", "-map", "[out]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
  "-shortest", "-movflags", "+faststart", tmp);

const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
if (r.status !== 0) throw new Error("ffmpeg failed");
renameSync(tmp, film);
console.log("wrote", film, [hasVoice && "narration", hasSfx && "sound effects"].filter(Boolean).join(" + "));
