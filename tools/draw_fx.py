# /// script
# requires-python = ">=3.9"
# dependencies = ["pillow", "numpy"]
# ///
"""Build the effect sprites: slashes, hit sparks, shockwaves, pillars of light, dust.

Every effect ends up as frames of a five-step level map (0 clear, 1 rim, 2 body,
3 light, 4 core) that is coloured through one ramp per army, so Sun and Moon share
the same drawings. Two sources feed it:

- the organic effects are drawn by an image model as 8-frame sheets on black
  (art/raw/fx_*.png, prompts in tools/art-jobs.json), then redrawn here on the game's
  own pixel grid at each size the game needs;
- the geometric ones (glints, the king's hairline cut, sparks, rubble, petals, focus
  lines) are drawn here from distance fields cut with hard thresholds.

Writes assets/fx.png and assets/fx.js. `--preview [tint] [names...]` also writes
out/fx-preview.png, a contact sheet at game scale.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "raw"
OUT = ROOT / "assets"

# rim, body, light, core
RAMPS = {
    "sun": ["#a01c2a", "#f2432f", "#ffd23e", "#fff8e0"],
    "moon": ["#1f2f9c", "#3f6dff", "#48e8d8", "#f0fffc"],
    "white": ["#6c6486", "#a8a8d8", "#e4ecff", "#ffffff"],
    "dust": ["#6e5c50", "#a89680", "#d8c8ac", "#f4ead6"],
    "sunstone": ["#5e4c3c", "#9c8468", "#d6c4a2", "#f6ecd6"],
    "moonstone": ["#22264e", "#383c70", "#5c63a1", "#8b93c9"],
    "rock": ["#3a2e2a", "#5a4a40", "#8a7a6a", "#c8b8a0"],
}
ARMY = ["sun", "moon"]
LIGHT = ["sun", "moon", "white"]
STONE = ["dust", "sunstone", "moonstone"]
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) + 0.5) / 16 - 0.5


# ---------------------------------------------------------------- image-model sheets


def classify(a, kind):
    """RGB pixels of a sheet to levels. Light effects go by hue, dust by brightness."""
    a = a.astype(int)
    if kind == "dust":
        return np.digitize(a.mean(-1), DUST_STEPS).astype(np.uint8)
    g, b = a[..., 1], a[..., 2]
    return np.where(a.max(-1) < 60, 0, np.where(b > 150, 4, np.where(g > 140, 3, 2))).astype(np.uint8)


DUST_STEPS = [40, 100, 150, 205]


def master(name, kind="light"):
    """Cut a 4x2 sheet into eight full-resolution level maps."""
    im = Image.open(RAW / f"fx_{name}.png").convert("RGB")
    W, H = im.size
    cw, ch = W // 4, H // 2
    a = np.asarray(im)
    return [classify(a[(i // 4) * ch:(i // 4 + 1) * ch, (i % 4) * cw:(i % 4 + 1) * cw], kind) for i in range(8)]


def regrid(cells, measure, target, origin, sy=1.0, cover=0.4):
    """Redraw a sheet's fat fake pixels on the game's pixel grid at a chosen size.

    The model draws on its own coarse grid, which never lines up with ours, so each
    level is blurred slightly to round its staircase off, then every game pixel takes
    the level that covers most of it. `sy` squashes or stretches the height.
    """
    ys, xs = np.nonzero(np.maximum.reduce(cells))
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    scale = target / ((x1 - x0) if measure == "w" else (y1 - y0))
    if origin == "box":
        ox, oy = (x0 + x1) / 2, (y0 + y1) / 2
    elif origin[0] == "floor":
        ox, oy = (x0 + x1) / 2, y1 - origin[1]
    else:
        yy, xx = np.nonzero(cells[origin[1]] == 4)
        ox, oy = (xx.mean() if origin[0] == "core" else (x0 + x1) / 2), yy.mean()
    w, h = max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale * sy))
    blur = 2.0 if scale > 0.2 else 0.0
    out = []
    for c in cells:
        crop = c[y0:y1, x0:x1]
        share = []
        for level in range(1, 5):
            m = Image.fromarray(((crop == level) * 255).astype(np.uint8))
            if blur:
                m = m.filter(ImageFilter.GaussianBlur(blur))
            share.append(np.asarray(m.resize((w, h), Image.BOX), dtype=np.float32) / 255)
        share = np.stack(share)
        out.append(np.where(share.sum(0) >= cover, share.argmax(0) + 1, 0).astype(np.uint8))
    return out, ((ox - x0) * scale, (oy - y0) * scale * sy)


# ---------------------------------------------------------------- drawn here


def grid(w, h, ox, oy):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x + 0.5 - ox, y + 0.5 - oy


_lat = {}


def vnoise(u, v, seed=0, period=64):
    """Smooth value noise in 0..1 that wraps every `period` cells."""
    key = (seed, period)
    if key not in _lat:
        _lat[key] = np.random.default_rng(1000 + seed).random((period, period)).astype(np.float32)
    lat = _lat[key]
    u, v = np.broadcast_arrays(np.asarray(u, dtype=np.float32), np.asarray(v, dtype=np.float32))
    u0, v0 = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = u - u0, v - v0
    fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
    a, b = lat[v0 % period, u0 % period], lat[v0 % period, (u0 + 1) % period]
    c, d = lat[(v0 + 1) % period, u0 % period], lat[(v0 + 1) % period, (u0 + 1) % period]
    return (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv


def quant(inten, dither=0.0):
    """Intensity 0..1 to level 0..4. Dither turns the fading bands into a checker pattern."""
    h, w = inten.shape
    b = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]
    v = inten + b * dither * 0.5
    return np.where((inten > 0) & (v > 0), np.clip(np.ceil(v * 4), 1, 4), 0).astype(np.uint8)


def adiff(a, b):
    return np.abs((a - b + np.pi) % (2 * np.pi) - np.pi)


def glint(R):
    """A four-point twinkle, the flash off a blade."""
    S = 2 * R + 3
    c = S // 2
    X, Y = grid(S, S, c + 0.5, c + 0.5)
    U, V = (X + Y) * 0.7071, (X - Y) * 0.7071
    out = []
    for sc, dg, di in [(0.16, 0, 0), (1.0, 0, 0), (1.0, 0.42, 0), (0.72, 0.3, 0), (0.4, 0, 0.6)]:
        a = 1 - (np.sqrt(np.abs(X)) + np.sqrt(np.abs(Y))) / math.sqrt(R * sc + 0.6)
        inten = np.where(a > 0, 0.4 + a * 1.6, 0)
        if dg:
            b = 1 - (np.sqrt(np.abs(U)) + np.sqrt(np.abs(V))) / math.sqrt(R * dg + 0.6)
            inten = np.maximum(inten, np.where(b > 0, 0.3 + b * 1.4, 0))
        out.append(quant(np.clip(inten, 0, 1), di))
    return out, (c + 0.5, c + 0.5)


def shock(R, seed, flat=0.38, n=8):
    """The wide shockwaves: a thin ring racing over the floor, kicking up spikes as it goes.

    The model's ring is a fat band, which is right for a stomp but floods the screen
    when scaled up, so the two largest sizes are drawn here instead.
    """
    rng = np.random.default_rng(seed)
    kick = int(R * 0.2)
    w, h = 2 * R + 12, int(2 * R * flat) + 12 + kick
    oy = kick + (h - kick) / 2
    X, Y = grid(w, h, w / 2, oy)
    th = np.arctan2(Y / flat, X)
    rho = np.hypot(X, Y / flat) * (1 + 0.05 * (vnoise(th * 5 + seed, 0.3, seed) - 0.5))
    spikes = [(rng.random() * 6.283, 0.35 + 0.65 * rng.random(), 1.5 + rng.random() * 2) for _ in range(R // 8)]
    out = []
    for i in range(n):
        k = (i + 1) / n
        rr = R * (1 - (1 - k) ** 2.4)
        tk = max(1.6, R * 0.1 * (1 - k) ** 1.1) * (0.8 + 0.4 * (0.5 + 0.5 * np.sin(th)))
        s = rr - rho
        er = max(0.0, (k - 0.45) / 0.55)
        gap = vnoise(th * R / 9.0 + seed * 2, k * 1.5, seed + 2)
        inten = np.where((s > 0) & (s < tk), np.clip(1.0 - 0.8 * s / tk - er * 1.5 * gap, 0, 1), 0)
        for a, hgt, wd in spikes:
            bx, by = rr * math.cos(a), rr * math.sin(a) * flat
            ht = kick * hgt * math.sin(math.pi * min(1.0, k * 1.3))
            if ht > 2:
                t = (by - Y) / ht
                ok = (t > 0) & (t < 1) & (np.abs(X - bx) < wd * (1 - t))
                inten = np.maximum(inten, np.where(ok, 0.95 - 0.5 * t, 0))
        out.append(quant(inten, 0.8 * er))
    return out, (w / 2, oy)


def cut():
    """The king's finishing cut: one long hairline that flares, holds, then breaks."""
    w, h = 548, 232
    X, Y = grid(w, h, w / 2, h / 2)
    p0, p1 = np.array([-260.0, -110.0]), np.array([260.0, 90.0])
    d = p1 - p0
    ln = float(np.hypot(*d))
    s = ((X - p0[0]) * d[0] + (Y - p0[1]) * d[1]) / ln ** 2
    dist = np.abs((X - p0[0]) * d[1] - (Y - p0[1]) * d[0]) / ln
    dash = vnoise(s * 46, 0.5, 4)
    out = []
    for s1, wd, er, di in [(0.36, 1.0, 0, 0), (1, 1.2, 0, 0), (1, 3.6, 0, 0), (1, 2.6, 0, 0), (1, 1.7, 0.15, 0), (1, 1.1, 0.42, 0.3), (1, 0.9, 0.7, 0.6), (1, 0.8, 0.92, 0.9)]:
        wv = wd * np.sin(np.pi * np.clip(s / s1, 0, 1)) ** 0.45
        ok = (s > 0) & (s < s1) & (dist < wv)
        inten = 1.05 - 0.8 * (dist / np.maximum(wv, 1e-3)) ** 2 - er * 1.6 * dash
        out.append(quant(np.where(ok, np.clip(inten, 0, 1), 0), di))
    return out, (w / 2, h / 2)


def rows(*lines):
    return np.array([[int(c) if c != "." else 0 for c in ln] for ln in lines], dtype=np.uint8)


def sparks():
    """Flying sparks in three headings; the game mirrors them for the other five."""
    out = {}
    for name in ("h", "d", "v"):
        fr = []
        for tail in ([2, 2, 2, 3, 3, 4, 4], [2, 3, 3, 4, 4], [2, 3, 4], [3]):
            n = len(tail)
            a = np.zeros((n, n) if name == "d" else ((1, n) if name == "h" else (n, 1)), dtype=np.uint8)
            for j, lv in enumerate(tail):
                if name == "h":
                    a[0, j] = lv
                elif name == "v":
                    a[j, 0] = lv
                else:
                    a[j, j] = lv
            fr.append((a, (n - 0.5 if name != "v" else 0.5, n - 0.5 if name != "h" else 0.5)))
        out[name] = fr
    return out


def twinkle():
    out = []
    for arm in (0, 1, 3, 2, 1):
        a = np.zeros((7, 7), dtype=np.uint8)
        for j in range(1, arm + 1):
            lv = 3 if j < arm else 2
            a[3, 3 + j] = a[3, 3 - j] = a[3 + j, 3] = a[3 - j, 3] = lv
        a[3, 3] = 4
        out.append(a)
    return out, (3.5, 3.5)


def chunk(w, h, seed):
    """A piece of rubble, turning over in four frames."""
    X, Y = grid(w, h, w / 2, h / 2)
    lump = np.hypot(X / (w / 2), Y / (h / 2)) + 0.5 * (vnoise(X / 1.6 + seed, Y / 1.6, seed + 20) - 0.5)
    mask = lump < 0.98
    out = []
    for q in range(4):
        m = np.rot90(mask, q)
        hh, ww = m.shape
        x, y = grid(ww, hh, ww / 2, hh / 2)
        lit = (-0.55 * x / (ww / 2) - 0.83 * y / (hh / 2))
        lv = np.where(lit > 0.45, 4, np.where(lit > -0.05, 3, np.where(lit > -0.6, 2, 1)))
        out.append((np.where(m, lv, 0).astype(np.uint8), (ww / 2, hh / 2)))
    return out


PETAL = [rows(".34..", "3443.", ".2332", "...2."), rows("..3.", ".343", "243.", "22.."), rows(".....", "23443", "....."), rows("3...", "343.", ".342", "..22")]


def hint(n=6):
    """The marker on a square a piece may move to: a bead of light with a ring breathing round it."""
    w, h = 43, 25
    X, Y = grid(w, h, w / 2, h / 2)
    rho = np.hypot(X, Y / 0.5)
    out = []
    for i in range(n):
        rr = 12.0 + 3.2 * (1 - math.cos(2 * math.pi * i / n))
        inten = np.where(np.abs(rho - rr) < 1.3, 0.5, 0.0)
        inten = np.where(np.abs(rho - rr - 1.6) < 0.7, 0.25, inten)
        for rad, v in ((9.4, 0.25), (8.0, 0.75), (5.8, 1.0)):
            inten = np.where(rho < rad, v, inten)
        out.append(quant(inten))
    return out, (w / 2, h / 2)


def focus(seed):
    """Manga focus lines closing on a finishing blow. The game mirrors it to animate."""
    w, h = 1440, 810
    X, Y = grid(w, h, w / 2, h / 2)
    th, rell = np.arctan2(Y, X), np.hypot(X, Y * 1.45)
    rng = np.random.default_rng(seed)
    lv = np.zeros((h, w), dtype=np.uint8)
    for _ in range(54):
        a, half, r0 = rng.random() * 6.283, 0.005 + rng.random() * 0.02, 150 + rng.random() * 170
        tone = rng.choice([4, 4, 3, 3, 2])
        ok = (rell > r0) & (adiff(th, a) < half * np.clip(1 - r0 / np.maximum(rell, 1), 0, 1) ** 0.6)
        lv = np.where(ok, np.maximum(lv, tone), lv)
    return [lv], (w / 2, h / 2)


# ---------------------------------------------------------------- pack and write


def rgb(hexs):
    return [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in hexs]


def colour(lv, ramp):
    out = np.zeros(lv.shape + (4,), dtype=np.uint8)
    for i, c in enumerate(rgb(RAMPS[ramp])):
        out[lv == i + 1] = c + (255,)
    return out


def build():
    """name -> (frames, tints); each frame is (level map, (ox, oy))."""
    fx = {}

    def add(name, frames, origin, tints):
        fx[name] = ([(f, origin) for f in frames], tints)

    def sized(sheet, sizes, measure, origin, tints, kind="light"):
        cells = master(sheet, kind)
        for name, target, *sy in sizes:
            add(name, *regrid(cells, measure, target, origin, *sy), tints)

    sized("slash", [("slash_s", 96), ("slash_m", 132), ("slash_l", 184)], "h", "box", LIGHT)
    sized("slash2", [("rapier_s", 104), ("rapier_m", 150)], "w", "box", LIGHT)
    sized("hit", [("hit_s", 48), ("hit_m", 76), ("hit_l", 110)], "w", ("core", 2), ARMY)
    sized("burst", [("burst_m", 200), ("burst_l", 264)], "w", ("core", 2), ARMY)
    # the model draws the ring flatter than the board lies, so it is stretched to match
    sized("shock", [("shock_s", 92, 1.7), ("shock_m", 166, 1.7)], "w", ("core", 3), LIGHT + STONE)
    fx["shock_m"] = (fx["shock_m"][0][1:], LIGHT + STONE)  # at this size the opening flash reads as a puddle
    for nm, R, sd in (("shock_l", 124, 3), ("shock_xl", 182, 4)):
        add(nm, *shock(R, sd), LIGHT + STONE)
    sized("thrust", [("thrust_s", 100, 1.0), ("thrust_m", 200, 0.62), ("thrust_l", 350, 0.46)], "w", ("axis", 1), LIGHT)
    sized("charge", [("charge", 60)], "w", ("core", 5), ARMY)
    # its origin is the middle of the flare on the ground; the game repeats the column upward
    sized("pillar", [("pillar_s", 128), ("pillar_l", 268)], "h", ("floor", 16), ARMY)
    sized("puff", [("puff_a", 22), ("puff_b", 28), ("puff_c", 38)], "w", "box", STONE, "dust")
    sized("land", [("dust_s", 92), ("dust_l", 176)], "w", ("floor", 0), STONE, "dust")

    for nm, R in (("glint_s", 13), ("glint_m", 21), ("glint_l", 33)):
        add(nm, *glint(R), LIGHT)
    add("cut", *cut(), ARMY)
    for nm, fr in sparks().items():
        fx["spark_" + nm] = (fr, LIGHT)
    add("twinkle", *twinkle(), LIGHT)
    for i, (w, h) in enumerate([(3, 3), (4, 3), (5, 4), (7, 5)]):
        fx["chunk%d" % i] = (chunk(w, h, i), ["rock", "sunstone", "moonstone"])
    fx["petal"] = ([(p, (p.shape[1] / 2, p.shape[0] / 2)) for p in PETAL], LIGHT)
    add("hint", *hint(), ARMY)
    add("focus", *focus(3), ARMY)
    return fx


def pack(fx, width=2048):
    """Trim every frame, shelf-pack tallest first, return (image, atlas)."""
    items = []
    for name, (frames, tints) in fx.items():
        for tint in tints:
            for i, (lv, (ox, oy)) in enumerate(frames):
                ys, xs = np.nonzero(lv)
                if not len(xs):
                    items.append((name, tint, i, None, 0, 0))
                    continue
                x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
                items.append((name, tint, i, colour(lv[y0:y1, x0:x1], tint), ox - x0, oy - y0))
    atlas = {n: {t: [None] * len(fr) for t in ts} for n, (fr, ts) in fx.items()}
    frames_top = {n: fr[0][1][1] for n, (fr, ts) in fx.items()}
    order = sorted(range(len(items)), key=lambda j: -(items[j][3].shape[0] if items[j][3] is not None else 0))
    x = y = shelf = 0
    place = []
    for j in order:
        name, tint, i, im, ox, oy = items[j]
        if im is None:
            atlas[name][tint][i] = [0, 0, 0, 0, 0, 0]
            continue
        h, w = im.shape[:2]
        if x + w > width:
            x, y, shelf = 0, y + shelf + 1, 0
        place.append((x, y, im))
        atlas[name][tint][i] = [x, y, w, h, round(float(ox), 1), round(float(oy), 1)]
        if name.startswith("pillar") and oy >= frames_top[name]:
            atlas[name][tint][i].append(1)  # this frame reaches the top of its cell
        x, shelf = x + w + 1, max(shelf, h)
    sheet = np.zeros((y + shelf, width, 4), dtype=np.uint8)
    for x, y, im in place:
        sheet[y:y + im.shape[0], x:x + im.shape[1]] = im
    return Image.fromarray(sheet), atlas


def preview(fx, names, tint_of, path, scale=2):
    """Contact sheet at game scale (2x) over dark, mid and snow backgrounds."""
    strips = []
    for name in names:
        frames, tints = fx[name]
        tint = tint_of if tint_of in tints else tints[0]
        h = max(f.shape[0] for f, _ in frames)
        w = sum(f.shape[1] for f, _ in frames) + 4 * len(frames)
        if w > 1500:
            continue
        for bg in ((26, 18, 34), (120, 132, 150), (232, 238, 246)):
            strip = np.zeros((h + 4, 1500, 3), dtype=np.uint8)
            strip[:] = bg
            x = 2
            for f, _ in frames:
                c = colour(f, tint)
                m = c[..., 3] > 0
                strip[2:2 + f.shape[0], x:x + f.shape[1]][m] = c[..., :3][m]
                x += f.shape[1] + 4
            strips.append(strip)
    im = Image.fromarray(np.vstack(strips))
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def main():
    fx = build()
    if "--preview" in sys.argv:
        args = [a for a in sys.argv[1:] if not a.startswith("--")]
        tint = args[0] if args else "sun"
        names = args[1:] or [n for n in fx if n != "focus"]
        preview(fx, names, tint, ROOT / "out" / "fx-preview.png")
    sheet, atlas = pack(fx)
    sheet.save(OUT / "fx.png", optimize=True)
    (OUT / "fx.js").write_text("window.BC_FX = " + json.dumps(atlas, separators=(",", ":")) + ";\n")
    print("fx.png", sheet.size, "effects", len(fx), "frames", sum(len(v) for a in atlas.values() for v in a.values()))


if __name__ == "__main__":
    main()
