# /// script
# requires-python = ">=3.9"
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""Turn the raw green-screen art in art/raw into game assets.

Sheets become real pixel sprites: keyed, split into frames, scaled to one size per
piece, snapped to a shared palette, re-inked, then packed into one atlas per piece.
The Moon army is the Sun army recoloured, the classic fighting-game palette swap.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "raw"
OUT = ROOT / "assets"
PIECES = ["pawn", "rook", "knight", "bishop", "queen", "king"]
# Height in game pixels of each piece's ready stance (weapon included).
TARGET = {"pawn": 96, "rook": 112, "knight": 124, "bishop": 112, "queen": 106, "king": 112}
# Which frame of a sheet is the ready stance used to set its scale, and a correction factor.
KINDS = {
    "idlehit": {"ref": 0, "k": 1.0, "names": [("idle", 0, 4), ("hit", 4, 8)]},
    "attack": {"ref": 0, "k": 1.0, "names": [("attack", 0, 8)]},
    "morph": {"ref": 7, "k": 1.0, "names": [("morph", 0, 8)]},
    "move": {"ref": "median", "k": 0.93, "names": [("move", 0, 8)]},
}
OVERRIDES = json.loads((ROOT / "tools" / "art-overrides.json").read_text()) if (ROOT / "tools" / "art-overrides.json").exists() else {}
INK = np.array([34, 16, 28], dtype=np.float32)


def key_green(im):
    """Return float RGBA (0..1) with the green screen removed and its spill cleaned off."""
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gex = g - np.maximum(r, b)
    alpha = np.clip(1.0 - (gex - 24.0) / 70.0, 0.0, 1.0)
    alpha[(g > 110) & (gex > 95)] = 0.0
    out = a.copy()
    part = (alpha > 0.02) & (alpha < 1.0)
    # Un-mix the green from soft edges and motion smears.
    for c, bgc in enumerate((0.0, 255.0, 0.0)):
        ch = out[..., c]
        ch[part] = np.clip((ch[part] - (1 - alpha[part]) * bgc) / alpha[part], 0, 255)
    spill = out[..., 1] > np.maximum(out[..., 0], out[..., 2])
    out[..., 1][spill & (alpha < 1)] = np.maximum(out[..., 0], out[..., 2])[spill & (alpha < 1)]
    return np.dstack([out / 255.0, alpha])


def split_frames(rgba, expect):
    """Find each drawn frame. Small loose bits (smears, chips) join the nearest figure."""
    mask = rgba[..., 3] > 0.15
    fat = ndimage.binary_dilation(mask, iterations=3)
    lab, n = ndimage.label(fat)
    if n == 0:
        return []
    idx = np.arange(1, n + 1)
    areas = ndimage.sum(mask, lab, idx)
    cms = ndimage.center_of_mass(mask, lab, idx)
    big = [i for i in range(n) if areas[i] >= 0.15 * areas.max()]
    owner = {}
    for i in range(n):
        if i in big:
            owner[i + 1] = i + 1
            continue
        if areas[i] < 12:
            continue
        d = [np.hypot(cms[i][0] - cms[j][0], cms[i][1] - cms[j][1]) for j in big]
        j = int(np.argmin(d))
        if d[j] < 0.2 * rgba.shape[1]:
            owner[i + 1] = big[j] + 1
    remap = np.zeros(n + 1, dtype=np.int32)
    for k, v in owner.items():
        remap[k] = v
    lab = remap[lab]
    frames = []
    for j in big:
        m = (lab == j + 1) & mask
        ys, xs = np.where(m)
        solid = (lab == j + 1) & (rgba[..., 3] > 0.6)
        sy, sx = np.where(solid)
        frames.append({"m": m, "box": (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), "cx": cms[j][1], "cy": cms[j][0],
                       "sbox": (sx.min(), sy.min(), sx.max() + 1, sy.max() + 1)})
    ys = sorted(f["cy"] for f in frames)
    mid = (ys[0] + ys[-1]) / 2
    rows = [[f for f in frames if f["cy"] <= mid], [f for f in frames if f["cy"] > mid]]
    if abs(ys[0] - ys[-1]) < 0.2 * rgba.shape[0]:
        rows = [frames]
    ordered = []
    for ri, row in enumerate(rows):
        row.sort(key=lambda f: f["cx"])
        base = max(f["sbox"][3] for f in row)
        for f in row:
            f["base"] = base
            f["row"] = ri
        ordered += row
    if len(ordered) != expect:
        print(f"   !! found {len(ordered)} frames, expected {expect}")
    return ordered


def cut(rgba, f, scale):
    """Crop one frame, shrink it to game size and work out where its feet are."""
    x0, y0, x1, y1 = f["box"]
    y1 = max(y1, f["base"])
    crop = rgba[y0:y1, x0:x1].copy()
    crop[..., 3] *= f["m"][y0:y1, x0:x1]
    w = max(1, int(round((x1 - x0) * scale)))
    h = max(1, int(round((y1 - y0) * scale)))
    pm = crop.copy()
    pm[..., :3] *= pm[..., 3:4]
    small = np.asarray(Image.fromarray((pm * 255).astype(np.uint8), "RGBA").resize((w, h), Image.BOX), dtype=np.float32) / 255.0
    al = small[..., 3]
    rgb = np.where(al[..., None] > 0.01, small[..., :3] / np.maximum(al[..., None], 0.01), 0)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    smear = (al > 0.18) & (al < 0.7) & (lum > 0.6) & (sat < 0.25)
    a2 = np.where(al >= 0.5, 1.0, 0.0)
    a2[smear] = 0.5
    # Feet: centre of the lowest band of solid pixels, measured against the row's shared baseline.
    solid = a2 >= 1.0
    ys, xs = np.where(solid)
    if len(ys) == 0:
        return None
    band = ys >= ys.max() - max(2, int(0.07 * h))
    ax = float(xs[band].mean())
    mass = float(xs.mean())
    return {"rgb": np.clip(rgb, 0, 1), "a": a2, "ax": ax, "mass": mass, "ay": float(h)}


def ink(fr):
    """Close any gaps in the dark outline so every silhouette reads cleanly."""
    a, rgb = fr["a"], fr["rgb"]
    solid = a >= 1.0
    pad = np.pad(solid, 1)
    lum = np.pad(rgb.mean(axis=2), 1, constant_values=0)
    edge = np.zeros_like(solid)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        nb = pad[1 + dy:pad.shape[0] - 1 + dy, 1 + dx:pad.shape[1] - 1 + dx]
        nl = lum[1 + dy:lum.shape[0] - 1 + dy, 1 + dx:lum.shape[1] - 1 + dx]
        edge |= nb & (nl > 0.32)
    edge &= ~solid & (a < 0.4)
    rgb[edge] = INK / 255.0
    a[edge] = 1.0


def hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(axis=-1), rgb.min(axis=-1)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rm = nz & (mx == r)
    gm = nz & (mx == g) & ~rm
    bm = nz & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    return h * 60, np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0), mx


def unhsv(h, s, v):
    h = (h % 360) / 60
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros(h.shape + (3,), dtype=np.float32)
    for k, (a, b, c) in enumerate(((v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q))):
        m = i == k
        out[m] = np.stack([a[m], b[m], c[m]], axis=-1)
    return out


def moonify(rgb, keep_skin=True, stone=False):
    """Sun colours to Moon colours: red to royal blue, gold to cyan, ivory and steel to night slate."""
    h, s, v = hsv(rgb)
    skin = (h > 10) & (h < 29) & (s > 0.27) & (s < 0.56) & (v > 0.72)
    if not keep_skin:
        skin = np.zeros_like(skin)
    # Statue marble runs warm; treat all of its light tones as stone so the whole piece turns to night slate.
    marble = (s < 0.66) & (v > 0.62) & (h > 15) & (h < 70) if stone else np.zeros_like(skin)
    red = ((h >= 338) | (h < 24)) & (s >= 0.42) & ~skin & ~marble
    gold = (h >= 24) & (h < 66) & (s >= 0.42) & ~skin & ~marble
    pale = ((s < 0.42) & ~skin) | marble
    h2, s2, v2 = h.copy(), s.copy(), v.copy()
    h2[red] = 226
    s2[red] = np.clip(s[red] * 0.95, 0, 1)
    v2[red] = np.clip(v[red] * 1.04 + 0.03, 0, 1)
    h2[gold] = 178
    s2[gold] = np.clip(s[gold] * 0.72, 0, 1)
    v2[gold] = np.clip(v[gold] * 1.06, 0, 1)
    h2[pale] = 238
    s2[pale] = np.clip(0.2 + s[pale] * 0.55, 0, 0.6)
    v2[pale] = np.clip(v[pale] * 0.66 + 0.03, 0, 1)
    return unhsv(h2, s2, v2)


def ivory(rgb):
    """Pull every Sun statue's marble to the same pale ivory, whatever tint its sheet was drawn in."""
    h, s, v = hsv(rgb)
    marble = (s < 0.66) & (v > 0.5) & (h > 15) & (h < 70)
    s2 = s.copy()
    s2[marble] = s[marble] * 0.5
    h2 = h.copy()
    h2[marble] = 38
    return unhsv(h2, s2, v)


def snap_palette(frames, colours=56):
    """One shared palette per piece keeps every frame's colours identical."""
    px = np.concatenate([f["rgb"][f["a"] >= 1.0] for f in frames])
    if len(px) > 400000:
        px = px[:: len(px) // 400000 + 1]
    strip = Image.fromarray((px.reshape(1, -1, 3) * 255).astype(np.uint8), "RGB")
    pal = strip.quantize(colors=colours, method=Image.MEDIANCUT, dither=Image.NONE)
    for f in frames:
        im = Image.fromarray((f["rgb"] * 255).astype(np.uint8), "RGB").quantize(palette=pal, dither=Image.NONE).convert("RGB")
        keep = f["a"] == 0.5
        new = np.asarray(im, dtype=np.float32) / 255.0
        new[keep] = f["rgb"][keep]
        f["rgb"] = new


def pack(frames, pad=2, width=1024):
    x = y = rowh = 0
    for f in frames:
        h, w = f["a"].shape
        if x + w + pad > width:
            x, y, rowh = 0, y + rowh + pad, 0
        f["x"], f["y"] = x, y
        x += w + pad
        rowh = max(rowh, h)
    return width, y + rowh


def render(frames, size, moon, keep_skin=True):
    W, H = size
    img = np.zeros((H, W, 4), dtype=np.float32)
    for f in frames:
        h, w = f["a"].shape
        rgb = moonify(f["rgb"], keep_skin and not f.get("stone"), bool(f.get("stone"))) if moon else f["rgb"]
        if f.get("stone") and not moon:
            rgb = ivory(rgb)
        img[f["y"]:f["y"] + h, f["x"]:f["x"] + w, :3] = rgb
        img[f["y"]:f["y"] + h, f["x"]:f["x"] + w, 3] = f["a"]
    return Image.fromarray((img * 255).round().astype(np.uint8), "RGBA")


def do_piece(piece, atlas):
    frames, anims = [], {}
    for kind, spec in KINDS.items():
        src = RAW / f"{piece}_{kind}.png"
        if not src.exists():
            print(f"   (no {src.name})")
            continue
        ov = OVERRIDES.get(f"{piece}_{kind}", {})
        rgba = key_green(Image.open(src))
        found = split_frames(rgba, 8)
        if len(found) < 8:
            continue
        found = found[:8]
        heights = [f["sbox"][3] - f["sbox"][1] for f in found]
        ref = float(np.median(heights)) if spec["ref"] == "median" else heights[spec["ref"]]
        scale = TARGET[piece] * spec["k"] * ov.get("k", 1.0) / ref
        cuts = [cut(rgba, f, scale) for f in found]
        for name, a, b in spec["names"]:
            ids = []
            for i in range(a, b):
                c = cuts[i]
                c["anchor"] = c["mass"] if name == "move" else c["ax"]
                c["stone"] = name == "morph" and i < 3  # still a statue: no skin to protect when recolouring
                ids.append(len(frames))
                frames.append(c)
            anims[name] = ids
        print(f"   {src.name}: scale {scale:.3f}")
    if not frames:
        return
    for f in frames:
        ink(f)
    snap_palette(frames)
    size = pack(frames)
    (OUT / "sprites").mkdir(parents=True, exist_ok=True)
    render(frames, size, False).save(OUT / "sprites" / f"sun_{piece}.png")
    render(frames, size, True, piece not in ("rook", "knight")).save(OUT / "sprites" / f"moon_{piece}.png")
    atlas[piece] = {
        "frames": [[f["x"], f["y"], f["a"].shape[1], f["a"].shape[0], round(f["anchor"], 1), round(f["ay"], 1)] for f in frames],
        "anims": anims,
    }


def do_portrait(piece):
    src = RAW / f"{piece}_idle.png"
    if not src.exists():
        return
    rgba = key_green(Image.open(src))
    ys, xs = np.where(rgba[..., 3] > 0.5)
    crop = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h = 300
    w = int(round(crop.shape[1] * h / crop.shape[0]))
    pm = crop.copy()
    pm[..., :3] *= pm[..., 3:4]
    small = np.asarray(Image.fromarray((pm * 255).astype(np.uint8), "RGBA").resize((w, h), Image.BOX), dtype=np.float32) / 255.0
    al = (small[..., 3] >= 0.5).astype(np.float32)
    rgb = np.clip(np.where(small[..., 3:4] > 0.01, small[..., :3] / np.maximum(small[..., 3:4], 0.01), 0), 0, 1)
    (OUT / "portraits").mkdir(parents=True, exist_ok=True)
    for team, moon in (("sun", False), ("moon", True)):
        c = moonify(rgb, piece not in ("rook", "knight")) if moon else rgb
        Image.fromarray((np.dstack([c, al]) * 255).round().astype(np.uint8), "RGBA").save(OUT / "portraits" / f"{team}_{piece}.png")


def do_logo():
    src = RAW / "logo.png"
    if not src.exists():
        return
    rgba = key_green(Image.open(src))
    ys, xs = np.where(rgba[..., 3] > 0.5)
    crop = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    w = 620
    h = int(round(crop.shape[0] * w / crop.shape[1]))
    pm = crop.copy()
    pm[..., :3] *= pm[..., 3:4]
    small = np.asarray(Image.fromarray((pm * 255).astype(np.uint8), "RGBA").resize((w, h), Image.BOX), dtype=np.float32) / 255.0
    al = (small[..., 3] >= 0.5).astype(np.float32)
    rgb = np.clip(np.where(small[..., 3:4] > 0.01, small[..., :3] / np.maximum(small[..., 3:4], 0.01), 0), 0, 1)
    Image.fromarray((np.dstack([rgb, al]) * 255).round().astype(np.uint8), "RGBA").save(OUT / "logo.png")
    print("   logo", w, h)


# The pond corner of the sakura backdrop (x, y, w, h at 960x540), and a point on the head of each painted koi.
POND = (0, 392, 140, 96)
KOI_HEADS = [(76, 414), (70, 429), (112, 440)]
KOI_CELL = (100, 44)   # each koi is saved at twice size in a cell this big, head to the right, body through the middle


def lift_koi():
    """Cut the painted koi out of the sakura backdrop so the game can make them swim.

    Each becomes a sprite lying flat with its head to the right; the water where it was is
    repainted from the water beside it, row by row, which keeps the ripples running level.
    """
    path = OUT / "bg" / "sakura_board.png"
    full = np.asarray(Image.open(path).convert("RGB")).copy()
    x0, y0, w, h = POND
    p = full[y0:y0 + h, x0:x0 + w].astype(np.int32)
    r, g, b = p[..., 0], p[..., 1], p[..., 2]
    warm = (r > g + 18) & (r > b + 10) & (r > 120)                  # the red and orange of a koi
    pale = (p.min(-1) > 168) & (p.max(-1) - p.min(-1) < 60)         # its white
    lab, _ = ndimage.label(ndimage.binary_dilation(warm | pale))
    cw, ch = KOI_CELL
    sheet = Image.new("RGBA", (cw, ch * len(KOI_HEADS)))
    gone = np.zeros((h, w), bool)
    for n, (hx, hy) in enumerate(KOI_HEADS):
        body = lab == lab[hy - y0, hx - x0]
        assert body.sum() > 100 and lab[hy - y0, hx - x0] > 0, "koi not found where expected"
        ys, xs = np.nonzero(body)
        pts = np.stack([xs, ys], 1).astype(float)
        mid = pts.mean(0)
        axis = np.linalg.svd(pts - mid)[2][0]                       # the line the body lies along
        if np.dot(axis, np.array([hx - x0, hy - y0]) - mid) < 0:
            axis = -axis                                            # pointing at the head
        m = 3
        box = (max(xs.min() - m, 0), max(ys.min() - m, 0), min(xs.max() + m + 1, w), min(ys.max() + m + 1, h))
        rgb = p[box[1]:box[3], box[0]:box[2]].astype(np.uint8)
        alpha = body[box[1]:box[3], box[0]:box[2]]
        rgb[~alpha] = rgb[alpha].mean(0).astype(np.uint8)           # so turning it leaves no dark fringe
        big = lambda a, mode: Image.fromarray(a, mode).resize((a.shape[1] * 2, a.shape[0] * 2), Image.NEAREST)
        turn = float(np.degrees(np.arctan2(axis[1], axis[0])))
        colour = big(rgb, "RGB").rotate(turn, Image.BICUBIC, expand=True)
        mask = big((alpha * 255).astype(np.uint8), "L").rotate(turn, Image.BICUBIC, expand=True)
        spr = colour.convert("RGBA")
        spr.putalpha(mask)
        spr = spr.crop(mask.getbbox())
        assert spr.width <= cw and spr.height <= ch, f"koi {n} is {spr.size}, larger than its cell"
        sheet.paste(spr, ((cw - spr.width) // 2, n * ch + (ch - spr.height) // 2))
        gone |= ndimage.binary_dilation(body, iterations=2)
        print("   koi", n, spr.size, "heading", round(turn))
    # water only: not koi, not the pale stone and moss round the pond
    wet = ~gone & ~(warm | pale) & (g + b > r * 2 - 30) & (p.max(-1) < 200)
    for y in range(h):
        row = np.nonzero(gone[y])[0]
        if not len(row):
            continue
        for run in np.split(row, np.nonzero(np.diff(row) > 1)[0] + 1):
            a, z = run[0], run[-1]
            left = [x for x in range(a - 1, max(a - 30, -1), -1) if wet[y, x]]
            right = [x for x in range(z + 1, min(z + 30, w)) if wet[y, x]]
            for x in run:
                near_left = x - a <= z - x
                src = (left if (near_left and left) or not right else right)
                if src:
                    k = (x - a) if src is left else (z - x)
                    p[y, x] = p[y, src[k % len(src)]]
    full[y0:y0 + h, x0:x0 + w] = p.astype(np.uint8)
    Image.fromarray(full).save(path)
    sheet.save(OUT / "bg" / "sakura_koi.png")


def do_backgrounds():
    do_logo()
    (OUT / "bg").mkdir(parents=True, exist_ok=True)
    for src in sorted(RAW.glob("bg_*.png")):
        im = Image.open(src).convert("RGB")
        w, h = im.size
        tw = min(w, int(h * 16 / 9))
        th = min(h, int(w * 9 / 16))
        im = im.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th))
        im = im.resize((960, 540), Image.LANCZOS).quantize(colors=160, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
        im.save(OUT / "bg" / (src.stem[3:] + ".png"))
        print("   bg", src.stem)
    lift_koi()


def main():
    only = sys.argv[1:] or None
    atlas_path = OUT / "atlas.json"
    atlas = json.loads(atlas_path.read_text()) if atlas_path.exists() else {}
    for piece in PIECES:
        if only and piece not in only:
            continue
        print(piece)
        do_piece(piece, atlas)
        do_portrait(piece)
    if not only or "bg" in only:
        do_backgrounds()
    OUT.mkdir(exist_ok=True)
    atlas_path.write_text(json.dumps(atlas))
    (OUT / "atlas.js").write_text("window.BC_ATLAS = " + json.dumps(atlas) + ";\n")


if __name__ == "__main__":
    main()
