# /// script
# requires-python = ">=3.9"
# dependencies = ["numpy"]
# ///
"""Mix the trailer soundtrack: the title music as a bed, plus each sound effect at the moment the game played it."""
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 44100


def decode(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)


def main():
    spec = json.loads(Path(sys.argv[1]).read_text())
    n = int(spec["duration"] * SR)
    mix = np.zeros((n, 2), dtype=np.float32)
    music = decode(ROOT / "assets" / "music" / "title.mp3")
    m = min(n, len(music))
    mix[:m] += music[:m] * 0.62
    cache = {}
    for e in spec["events"]:
        if e["name"] not in cache:
            p = ROOT / "out" / "sfx" / (e["name"] + ".mp3")
            cache[e["name"]] = decode(p) if p.exists() else None
        s = cache[e["name"]]
        if s is None:
            continue
        i = int(e["t"] * SR)
        j = min(n, i + len(s))
        if j > i:
            mix[i:j] += s[: j - i] * 0.8 * e.get("vol", 1)
    fade = int(SR * 1.6)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix[: int(SR * 0.4)] *= np.linspace(0, 1, int(SR * 0.4))[:, None]
    peak = np.abs(mix).max()
    mix = np.tanh(mix * (1.4 if peak < 1 else 1.4 / peak * 0.98)) * 0.92
    with wave.open(sys.argv[2], "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    main()
