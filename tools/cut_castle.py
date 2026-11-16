"""Cuts the castle and its moat out of the owner's reference picture.

Usage: python3 tools/cut_castle.py <reference.jpg> <out.png> [preview.png]

Keeps everything inside the moat's outer edge (a 2:1 diamond) plus the castle's silhouette
above it, and removes the sky, clouds and the land outside the moat. Writes a half-size PNG
and, next to it, a JSON file with the foot point (centre of the diamond) and the diamond's
width in output pixels.
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
PREVIEW = sys.argv[3] if len(sys.argv) > 3 else None

# Outer edge of the moat in picture coordinates: left, back, right and front corners.
CX, CY, HALF_W = 400, 347, 243
DIAMOND = [(CX - HALF_W, CY), (CX, CY - HALF_W / 2), (CX + HALF_W, CY), (CX, CY + HALF_W / 2)]

# The castle's outline where it rises above the diamond, traced clockwise.
CASTLE = [
    (267, 335), (267, 240), (262, 233), (263, 226), (273, 225), (292, 193), (309, 221),
    (312, 166), (330, 141), (348, 165), (356, 166), (357, 114), (366, 112), (398, 55),
    # flag pole and banner
    (398, 5), (403, 5), (406, 11), (447, 11), (465, 17), (490, 14), (490, 20), (463, 30),
    (488, 37), (488, 41), (462, 38), (447, 48), (406, 46), (403, 55),
    (436, 112), (446, 111), (446, 135), (462, 131), (504, 152), (504, 170), (497, 176),
    (498, 222), (505, 225), (526, 194), (547, 226), (556, 226), (556, 246), (550, 251), (550, 340),
]

im = Image.open(SRC).convert('RGB')
mask = Image.new('L', im.size, 0)
d = ImageDraw.Draw(mask)
d.polygon(CASTLE, fill=255)
# Shave one pixel off the traced outline to drop the last sliver of sky.
mask = mask.filter(ImageFilter.MinFilter(3))
ImageDraw.Draw(mask).polygon(DIAMOND, fill=255)

cut = im.convert('RGBA')
cut.putalpha(mask)
box = mask.getbbox()
cut = cut.crop(box)
half = cut.resize((cut.width // 2, cut.height // 2), Image.LANCZOS)
# Hard alpha edge so the sprite has no soft halo.
half.putalpha(half.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
half.save(OUT, optimize=True)
meta = {'fx': (CX - box[0]) / 2, 'fy': (CY - box[1]) / 2, 'diamondWidth': HALF_W}
with open(OUT.rsplit('.', 1)[0] + '.json', 'w') as f:
    json.dump(meta, f)
    f.write('\n')
print('size', half.size, meta)

if PREVIEW:
    bg = Image.new('RGBA', (cut.width * 2, cut.height * 2), (108, 191, 60, 255))
    big = cut.resize(bg.size, Image.NEAREST)
    bg.alpha_composite(big)
    bg.save(PREVIEW)
