#!/usr/bin/env python3
"""Assemble PNG frames into a looping GIF: frames2gif.py <framesdir> <out.gif> <fps> <hold_seconds> [scale] [colors]"""
import sys, glob
from PIL import Image

frames_dir, out, fps, hold = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
scale = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
colors = int(sys.argv[6]) if len(sys.argv) > 6 else 128
paths = sorted(glob.glob(frames_dir + "/f*.png"))
imgs = [Image.open(p).convert("RGB") for p in paths]
if scale != 1.0:
    size = (round(imgs[0].width * scale), round(imgs[0].height * scale))
    imgs = [im.resize(size, Image.LANCZOS) for im in imgs]
# quantize every frame against a palette built from the last (fully-revealed) frame
palette = imgs[-1].quantize(colors=colors, method=Image.MEDIANCUT)
# snap near-white palette entries to pure white so the GIF blends into a white email background
pal = palette.getpalette()
for i in range(0, len(pal), 3):
    if all(c >= 246 for c in pal[i:i + 3]):
        pal[i:i + 3] = [255, 255, 255]
palette.putpalette(pal)
q = [im.quantize(palette=palette, dither=Image.FLOYDSTEINBERG) for im in imgs]
per = int(round(1000 / fps))
durations = [per] * (len(q) - 1) + [int(hold * 1000)]
q[0].save(out, save_all=True, append_images=q[1:], duration=durations, loop=0, optimize=True)
print("wrote", out, len(q), "frames")
