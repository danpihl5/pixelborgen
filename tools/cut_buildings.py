"""Cuts the buildings out of the owner's reference pictures.

Usage: python3 tools/cut_buildings.py <reference-dir> <out-dir> [preview-dir]

The reference directory holds castle.webp, wizard.webp and smithy.webp (the pictures
are not kept in the repository). For each one this writes <name>.png, stored at twice the
size it is shown in the game, and <name>.json with the foot point (the spot that stands on
the centre of the building's footprint) and the width in pixels that spans the footprint.
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFilter

REF, OUT = sys.argv[1], sys.argv[2]
PREVIEW = sys.argv[3] if len(sys.argv) > 3 else None
TILE_W = 64
KEY = (255, 0, 255)


def polygon_mask(size, polys, erode=True):
    mask = Image.new('L', size, 0)
    d = ImageDraw.Draw(mask)
    for p in polys:
        d.polygon(p, fill=255)
    return mask.filter(ImageFilter.MinFilter(3)) if erode else mask


def flood_mask(im, seeds, thresh):
    """Opaque everywhere except the background reachable from the seed points."""
    work = im.copy()
    for s in seeds:
        ImageDraw.floodfill(work, s, KEY, thresh=thresh)
    px = work.load()
    mask = Image.new('L', im.size, 255)
    mp = mask.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y] == KEY:
                mp[x, y] = 0
    return mask


def castle(im):
    # The castle stands on a dark background; its grass base is the 2 x 2 footprint.
    mask = flood_mask(im, [(5, 5), (im.width - 5, 5), (5, im.height - 5), (im.width - 5, im.height - 5)], 22)
    return mask, (470, 1285), 920, 2


def wizard(im):
    mask = flood_mask(im, [(5, 5), (im.width - 5, 5), (5, im.height - 5), (im.width - 5, im.height - 5)], 16)
    return mask, (610, 940), 960, 1


def smithy(im):
    mask = flood_mask(im, [(5, 5), (im.width - 5, 5), (5, im.height - 5), (im.width - 5, im.height - 5)], 16)
    return mask, (636, 880), 1170, 1


BUILDINGS = {'castle': ('castle.webp', castle), 'wizard': ('wizard.webp', wizard), 'smithy': ('smithy.webp', smithy)}

for name, (file, fn) in BUILDINGS.items():
    im = Image.open(f'{REF}/{file}').convert('RGB')
    mask, foot, base_width, tiles = fn(im)
    cut = im.convert('RGBA')
    cut.putalpha(mask)
    box = mask.getbbox()
    cut = cut.crop(box)
    k = 2 * tiles * TILE_W / base_width  # stored at twice the shown size
    small = cut.resize((round(cut.width * k), round(cut.height * k)), Image.LANCZOS)
    small.putalpha(small.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    small.save(f'{OUT}/{name}.png', optimize=True)
    meta = {'fx': round((foot[0] - box[0]) * k, 1), 'fy': round((foot[1] - box[1]) * k, 1), 'baseWidth': round(base_width * k, 1), 'tiles': tiles}
    with open(f'{OUT}/{name}.json', 'w') as f:
        json.dump(meta, f)
        f.write('\n')
    print(name, small.size, meta)
    if PREVIEW:
        bg = Image.new('RGBA', small.size, (108, 191, 60, 255))
        bg.alpha_composite(small)
        d = ImageDraw.Draw(bg)
        fx, fy, hw = meta['fx'], meta['fy'], meta['baseWidth'] / 2
        d.polygon([(fx - hw, fy), (fx, fy - hw / 2), (fx + hw, fy), (fx, fy + hw / 2)], outline=(255, 0, 255))
        bg.save(f'{PREVIEW}/cut-{name}.png')
