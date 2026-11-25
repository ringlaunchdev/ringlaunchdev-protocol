"""Derive site logo + favicon from brand/ assets.
Source: brand/LOGO RING PNG...png  (IHDR colortype 6 RGBA, 2000x2000, 3,697,130 fully
transparent px whose RGB is pure black) -> resize in PREMULTIPLIED space (PIL 'RGBa')
so the black under alpha=0 never bleeds into edges.
Palette provenance (sampled, not invented):
  navy  #0d2b6b  mode colour of brand/LOGO RING PNG.png (3,734,498 px)
  white #fcfcfc  mode opaque colour of the rope in both logo PNGs
"""
import re, sys, warnings
warnings.filterwarnings("ignore")
from PIL import Image
SRC = "brand/LOGO RING PNG...png"
im = Image.open(SRC).convert("RGBA")
bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
x0, y0, x1, y1 = bbox
side = max(x1 - x0, y1 - y0)
pad = round(side * 0.04)
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
half = side // 2 + pad
crop = im.crop((cx - half, cy - half, cx + half, cy + half))
def premul_resize(img, n):
    return img.convert("RGBa").resize((n, n), Image.LANCZOS).convert("RGBA")
for n in (1024, 256, 96):
    premul_resize(crop, n).save(f"src/assets/ring-{n}.png", optimize=True)
# favicon: 32x32 pixel grid straight from the premultiplied-resized alpha
tok = open("src/tokens.css", encoding="utf8").read()
navy = re.search(r"--navy:\s*(#[0-9a-fA-F]{6})", tok).group(1)
white = re.search(r"--white:\s*(#[0-9a-fA-F]{6})", tok).group(1)
g = premul_resize(crop, 32)
px = g.load()
rects = []
for y in range(32):
    x = 0
    while x < 32:
        a = px[x, y][3]
        if a < 16:
            x += 1; continue
        s = x
        while x < 32 and abs(px[x, y][3] - a) < 8:
            x += 1
        op = round(a / 255, 2)
        rects.append(f'<rect x="{s}" y="{y}" width="{x - s}" height="1"' + ("" if op >= 1 else f' fill-opacity="{op}"') + "/>")
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">'
       f'<rect width="32" height="32" rx="7" fill="{navy}"/><g fill="{white}">' + "".join(rects) + "</g></svg>")
open("src/assets/favicon.svg", "w", encoding="utf8").write(svg)
print("bbox", bbox, "crop", crop.size, "favicon rects", len(rects))
