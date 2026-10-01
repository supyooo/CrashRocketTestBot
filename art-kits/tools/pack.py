"""Turn cut kit parts into the files the game loads (app/art/<id>/), at half size (the rider is ~70 px tall on a
phone, the sheets are made far bigger).

    python art-kits/tools/pack.py musk

Mapping of the cut files (from cut.py) to the game's names is per character below; the torso is cut at the waist
(the sitting legs come from the leg parts).
"""
import sys, os
from PIL import Image

KITS = {
    'musk': {
        'head-calm': ('heads-1.png', None), 'head-hype': ('heads-2.png', None), 'head-scared': ('heads-3.png', None), 'head-win': ('heads-4.png', None),
        'torso': ('body-4.png', (0, 0, 580, 470)),      # t-shirt only, cut at the waist
        'arm-upper': ('body-1.png', None), 'arm-open': ('body-2.png', None), 'arm-fist': ('body-3.png', None),
        'leg-upper': ('body-5.png', None), 'leg-lower': ('body-6.png', None), 'item': ('item-1.png', None),
    },
}
SCALE = .5

if __name__ == '__main__':
    cid = sys.argv[1]
    src = os.path.join('art-kits', cid, 'parts')
    out = os.path.join('app', 'art', cid)
    os.makedirs(out, exist_ok=True)
    for name, (f, crop) in KITS[cid].items():
        im = Image.open(os.path.join(src, f)).convert('RGBA')
        if crop: im = im.crop(crop)
        s = SCALE * (.5 if name == 'item' else 1)          # props are drawn smaller than the body
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        path = os.path.join(out, name + '.webp')            # webp with alpha: a fraction of the png size
        im.save(path, 'WEBP', quality=88, method=6)
        print(name, im.size, os.path.getsize(path))
