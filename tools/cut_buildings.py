"""Cuts the buildings out of the owner's reference pictures.

Usage: python3 tools/cut_buildings.py <reference-dir> <out-dir> [preview-dir]

The reference directory holds castle.webp, tavern.jpg, farm.jpg and wizard.webp (the pictures
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


def tavern(im):
    # Traced on a 1.3x enlargement of the picture cropped at (80, 60).
    traced = [
        (55, 650), (50, 478), (150, 425), (295, 370), (250, 340), (255, 310), (400, 215),
        (400, 100), (398, 65), (455, 48), (498, 68), (495, 100), (492, 185),
        (540, 162), (545, 95), (540, 62), (595, 38), (648, 58), (645, 95), (643, 122),
        (700, 100), (915, 30), (932, 45), (930, 75), (945, 100), (1065, 265), (1068, 290), (1032, 322),
        (1032, 405), (1042, 432), (1135, 520), (1130, 548), (1118, 562), (1118, 700), (1095, 706),
        (1088, 692), (1040, 706), (990, 732), (970, 746), (900, 792), (850, 802), (760, 872),
        (745, 882), (720, 886), (700, 880), (690, 866), (640, 872), (600, 862), (590, 872),
        (555, 882), (522, 862), (500, 852), (460, 852), (335, 792), (335, 772), (345, 762),
        (300, 766), (275, 742), (270, 722), (95, 642),
    ]
    outline = [(80 + x / 1.3, 60 + y / 1.3) for x, y in traced]
    foot = (80 + 590 / 1.3, 60 + 690 / 1.3)
    return polygon_mask(im.size, [outline]), foot, 1063 / 1.3, 1


def farm(im):
    # The plot stands on white; drop the white and the people, animals and cart outside the plot.
    mask = flood_mask(im, [(40, 40), (560, 40), (40, 360), (560, 360)], 40)
    left, bottom, right = (30, 240), (350, 352), (578, 236)
    mp = mask.load()
    for x in range(im.width):
        if x <= bottom[0]:
            edge = left[1] + (x - left[0]) * (bottom[1] - left[1]) / (bottom[0] - left[0])
        else:
            edge = bottom[1] + (x - bottom[0]) * (right[1] - bottom[1]) / (right[0] - bottom[0])
        for y in range(im.height):
            if y > edge + 4 or x < 28 or x > 573 or y < 6:
                mp[x, y] = 0
    # Pockets of white enclosed by the trees.
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if min(px[x, y]) > 243:
                mp[x, y] = 0
    return mask, (304, 245), right[0] - left[0], 1


def wizard(im):
    mask = flood_mask(im, [(5, 5), (im.width - 5, 5), (5, im.height - 5), (im.width - 5, im.height - 5)], 16)
    return mask, (610, 940), 960, 1


BUILDINGS = {'castle': ('castle.webp', castle), 'tavern': ('tavern.jpg', tavern), 'farm': ('farm.jpg', farm), 'wizard': ('wizard.webp', wizard)}

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
