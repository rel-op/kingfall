# /// script
# requires-python = ">=3.9"
# dependencies = ["pillow", "numpy"]
# ///
"""App icons for the installed game: the Sun king's portrait on a lit red field, in the sizes phones ask for."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "icons"
FACE = Image.open(ROOT / "assets" / "portraits" / "sun_king.png").convert("RGBA")


def field(n):
    """A deep red field, lighter behind the king's head, with rays like the in-game portrait."""
    y, x = np.mgrid[0:n, 0:n].astype(float)
    cx, cy = n / 2, n * 0.92
    d = np.hypot(x - n / 2, y - n * 0.42) / n
    ray = (np.floor((np.arctan2(cy - y, x - cx) / np.pi) * 14) % 2) * 0.09
    k = np.clip(1 - d * 1.25, 0, 1) + ray
    top, low = np.array([214, 58, 44.0]), np.array([38, 10, 30.0])
    rgb = low + (top - low) * np.clip(k, 0, 1)[..., None]
    return Image.fromarray(np.dstack([rgb, np.full((n, n), 255.0)]).astype(np.uint8), "RGBA")


def icon(n, fill, frame):
    """fill: how much of the height the portrait takes. Maskable icons keep it inside the middle 80%."""
    im = field(n)
    # head, crown and sword: the part that still reads at the size of a thumbnail
    crop = FACE.crop((14, 26, 224, 236))
    h = int(n * fill)
    face = crop.resize((h, h), Image.NEAREST)
    im.alpha_composite(face, ((n - h) // 2, (n - h) // 2))
    if frame:
        a = np.asarray(im).copy()
        t = max(2, n // 40)
        gold, ink = (255, 210, 62, 255), (26, 10, 22, 255)
        for i, col in ((0, ink), (t // 2, gold), (t + t // 2, ink)):
            for sl in (np.s_[i:i + t // 2 + 1, :], np.s_[n - i - t // 2 - 1:n - i, :], np.s_[:, i:i + t // 2 + 1], np.s_[:, n - i - t // 2 - 1:n - i]):
                a[sl] = col
        im = Image.fromarray(a, "RGBA")
    return im


OUT.mkdir(parents=True, exist_ok=True)
big = icon(512, 0.94, True)
big.save(OUT / "icon-512.png")
big.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
icon(512, 0.7, False).save(OUT / "icon-maskable-512.png")
big.resize((180, 180), Image.LANCZOS).convert("RGB").save(OUT / "apple-touch-icon.png")
print("icons written to", OUT)
