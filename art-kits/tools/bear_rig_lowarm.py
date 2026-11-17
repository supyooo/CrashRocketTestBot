"""The bear's lowered left arm for the rig (app/art/bear/rig/arm-low.webp): his right arm, which the generator drew
bent with the fist on the knee, cut out, mirrored to the left side and relit (the rim light on the left is magenta,
on the right teal). Bending the raised arm down instead breaks it at every joint.

    python art-kits/tools/bear_rig_lowarm.py <scratch dir with cheer.png from the rig cut>
"""
import sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = sys.argv[1]
src = Image.open(S + '/cheer.png').convert('RGBA')
W, H = src.size
AXIS = 235            # mirror line: the right shoulder (330) lands on the left one (140)
# the right arm, shoulder to fist (picture px of the 407x600 sitting bear)
ARM = [(300, 270), (330, 262), (352, 278), (370, 298), (379, 320), (381, 345), (374, 368), (361, 380), (359, 400),
       (350, 418), (330, 425), (302, 423), (286, 413), (281, 395), (286, 376), (298, 362), (291, 345), (289, 320), (291, 292)]
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(ARM, fill=255); m = m.filter(ImageFilter.GaussianBlur(1.1))
a = np.asarray(src).astype(np.float32)
a[..., 3] *= np.asarray(m).astype(np.float32) / 255
# the top of the sleeve melts into the body's own shoulder instead of ending in a cut
yy = np.arange(H)[:, None].astype(np.float32)
a[..., 3] *= np.clip((yy - 262) / 26, 0, 1) ** 1.3
# relight: the teal rim turns magenta (red and green swap where the colour is a bright cyan)
r, g, b = a[..., 0].copy(), a[..., 1].copy(), a[..., 2].copy()
cyan = np.clip((g - r - 40) / 60, 0, 1) * np.clip((g + b - 230) / 120, 0, 1)
a[..., 0] = r * (1 - cyan) + np.minimum(255, g * 1.05) * cyan
a[..., 1] = g * (1 - cyan) + r * .7 * cyan
img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').transpose(Image.FLIP_LEFT_RIGHT)
# FLIP maps x to W-1-x; the arm should map x to 2*AXIS-x, so shift by 2*AXIS-(W-1)
dx = 2 * AXIS - (W - 1)
box = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
crop = img.crop(box)
at = [box[0] + dx, box[1]]
crop.save('app/art/bear/rig/arm-low.webp', quality=90, method=6)
json.dump({'at': at, 'size': crop.size}, open(S + '/armlow.json', 'w'))
print('arm-low', crop.size, 'at', at)
