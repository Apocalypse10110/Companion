// Adds the score and the narration to the silent film.
//   video/companion-launch.mp4 (silent) + video/score.wav + video/voice/narration.wav → video/companion-launch.mp4 (with sound)
// The score sits about 6 dB under the narration; the mix is normalised to -16 LUFS; the film fades in over 1.5 s and
// out over the last 3 s. The video stream is copied, not re-encoded.
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const film = join(here, "companion-launch.mp4");
const score = join(here, "score.wav");
const narration = join(here, "voice", "narration.wav");
const tmp = join(here, "companion-launch-sound.tmp.mp4");

const args = ["-loglevel", "error", "-y", "-i", film, "-i", score];
const hasVoice = existsSync(narration);
if (hasVoice) args.push("-i", narration);
const mix = hasVoice
  ? "[1:a]volume=0.45[sc];[2:a]aformat=sample_rates=44100:channel_layouts=stereo[nv];" +
    "[sc][nv]amix=inputs=2:normalize=0:dropout_transition=0[m];"
  : "[1:a]anull[m];";
const filter = mix + "[m]loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=1.5,afade=t=out:st=68:d=3[out]";
args.push("-filter_complex", filter, "-map", "0:v:0", "-map", "[out]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2",
  "-shortest", "-movflags", "+faststart", tmp);

const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
if (r.status !== 0) throw new Error("ffmpeg failed");
renameSync(tmp, film);
console.log("wrote", film, hasVoice ? "(score + narration)" : "(score only)");
