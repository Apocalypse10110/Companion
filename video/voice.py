"""Narration for the launch film, made offline with Piper (no API key, no network calls at render time).

  PIPER_PYTHON=/path/to/venv/bin/python PIPER_MODEL=/path/to/en_GB-alba-medium.onnx python3 video/voice.py

Reads video/narration.json, renders each line with Piper into video/voice/line-N.wav (cached, gitignored),
then mixes them at their start times into video/voice/narration.wav (44.1 kHz stereo).
"""
import hashlib, json, os, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "voice"
OUT.mkdir(exist_ok=True)
PY = os.environ.get("PIPER_PYTHON", sys.executable)
MODEL = os.environ.get("PIPER_MODEL")
if not MODEL or not Path(MODEL).exists():
    sys.exit("Set PIPER_MODEL to a Piper .onnx voice file (see docs in this file).")

lines = json.loads((HERE / "narration.json").read_text())
parts = []
for i, line in enumerate(lines):
    digest = hashlib.sha1((MODEL + line["text"]).encode()).hexdigest()[:10]
    wav = OUT / f"line-{i:02d}-{digest}.wav"
    if not wav.exists():
        subprocess.run([PY, "-m", "piper", "--model", MODEL, "--output_file", str(wav)],
                       input=line["text"].encode(), check=True, stdout=subprocess.DEVNULL)
    parts.append((wav, line["start"]))

# mix: each line delayed to its start time, then normalised to a steady speech level
args = ["ffmpeg", "-loglevel", "error", "-y"]
for wav, _ in parts:
    args += ["-i", str(wav)]
chains, labels = [], []
for i, (_, start) in enumerate(parts):
    ms = int(start * 1000)
    chains.append(f"[{i}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
    labels.append(f"[a{i}]")
chains.append("".join(labels) + f"amix=inputs={len(parts)}:normalize=0:dropout_transition=0,"
              "volume=1.6,alimiter=limit=0.9[narr]")
args += ["-filter_complex", ";".join(chains), "-map", "[narr]", "-t", "71", str(OUT / "narration.wav")]
subprocess.run(args, check=True)
print("wrote", OUT / "narration.wav", f"({len(parts)} lines)")
