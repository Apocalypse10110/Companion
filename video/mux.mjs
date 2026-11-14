// Adds the score to the silent film: video/companion-launch.mp4 (silent) + video/score.wav → video/companion-launch.mp4 (with sound).
// Loudness is normalised to -16 LUFS, the film fades in over 1.5 s and out over the last 3 s, and the video stream is copied, not re-encoded.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renameSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const film = join(here, "companion-launch.mp4");
const score = join(here, "score.wav");
const tmp = join(here, "companion-launch-sound.tmp.mp4");

const run = (args) => {
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg failed");
};
run([
  "-i", film, "-i", score,
  "-map", "0:v:0", "-map", "1:a:0",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2",
  "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=1.5,afade=t=out:st=57:d=3",
  "-shortest", "-movflags", "+faststart", tmp,
]);
renameSync(tmp, film);
console.log("wrote", film, "(with sound)");
