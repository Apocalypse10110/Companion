"""Narration + timeline for the launch film. Offline (Piper), no API key.

  PIPER_PYTHON=/path/to/venv/bin/python PIPER_MODEL=/path/to/en_GB-alba-medium.onnx python3 video/voice.py

1. Renders every beat in video/script.json to a WAV with Piper (cached in video/voice/, keyed by text).
2. Measures each WAV, then builds the timeline from those real lengths: a beat lasts as long as its voice
   plus a short tail, so the picture, the captions and the voice are always on cue.
3. Writes:
     video/timeline.json   the beats, with start, duration, speech start and speech length (used by the other steps)
     video/timeline.js     the same as window.TIMELINE, loaded by video/launch.html
     video/voice/narration.wav  the voice track, mixed at the beat starts
"""
import hashlib, json, os, subprocess, sys, wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "voice"
OUT.mkdir(exist_ok=True)
PY = os.environ.get("PIPER_PYTHON", sys.executable)
MODEL = os.environ.get("PIPER_MODEL")
SPEED = os.environ.get("PIPER_LENGTH_SCALE", "1.12")  # >1 is slower and calmer
if not MODEL or not Path(MODEL).exists():
    sys.exit("Set PIPER_MODEL to a Piper .onnx voice file.")

LEAD = 0.25     # silence before a voice line starts, inside its beat
TAIL = 0.45     # breathing room after a voice line
MIN_BEAT = 2.4  # no beat is shorter than this, so captions can be read

beats = json.loads((HERE / "script.json").read_text())

def seconds(path):
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()

# 1. voice each beat
for beat in beats:
    digest = hashlib.sha1((MODEL + SPEED + beat["narration"]).encode()).hexdigest()[:10]
    wav = OUT / f"{beat['id']}-{digest}.wav"
    if not wav.exists():
        subprocess.run([PY, "-m", "piper", "--model", MODEL, "--length-scale", SPEED,
                        "--sentence-silence", "0.3", "--output_file", str(wav)],
                       input=beat["narration"].encode(), check=True, stdout=subprocess.DEVNULL)
    beat["_wav"] = str(wav)
    beat["_speech"] = seconds(wav)

# 2. build the timeline from the real lengths
t = 0.0
timeline = []
for beat in beats:
    hold = beat.get("hold", 0.0)
    dur = max(MIN_BEAT, LEAD + beat["_speech"] + TAIL + hold)
    timeline.append({
        "id": beat["id"], "kind": beat["kind"], "cue": beat["cue"],
        "caption": beat["caption"], "narration": beat["narration"],
        "start": round(t, 3), "dur": round(dur, 3),
        "speechStart": round(t + LEAD, 3), "speechDur": round(beat["_speech"], 3),
        "wav": beat["_wav"],
    })
    t += dur
total = round(t, 3)

# 3. write timeline files
public = [{k: v for k, v in b.items() if k != "wav"} for b in timeline]
(HERE / "timeline.json").write_text(json.dumps({"total": total, "beats": public}, indent=2))
(HERE / "timeline.js").write_text("window.TIMELINE = " + json.dumps({"total": total, "beats": public}) + ";\n")

# 4. mix the voice track at the beat starts
args = ["ffmpeg", "-loglevel", "error", "-y"]
for b in timeline:
    args += ["-i", b["wav"]]
chains, labels = [], []
for i, b in enumerate(timeline):
    ms = int(b["speechStart"] * 1000)
    chains.append(f"[{i}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
    labels.append(f"[a{i}]")
chains.append("".join(labels) + f"amix=inputs={len(timeline)}:normalize=0:dropout_transition=0,"
              "volume=1.4,alimiter=limit=0.9[narr]")
args += ["-filter_complex", ";".join(chains), "-map", "[narr]", "-t", str(total), str(OUT / "narration.wav")]
subprocess.run(args, check=True)

for b in timeline:
    print(f"{b['start']:6.2f}s  {b['dur']:5.2f}s  {b['id']:8s} {b['narration'][:60]}")
print(f"total {total:.2f}s  ->  timeline.json, timeline.js, voice/narration.wav")
