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
# the right arm with its shoulder up to the collar fur, shoulder to fist (picture px of the 407x600 sitting bear)
ARM = [(292, 252), (306, 246), (326, 252), (346, 266), (366, 290), (378, 318), (381, 345), (374, 368), (361, 380),
       (359, 400), (350, 418), (330, 425), (302, 423), (286, 413), (281, 395), (286, 376), (298, 362), (291, 345),
       (289, 320), (290, 290), (288, 268)]
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(ARM, fill=255); m = m.filter(ImageFilter.GaussianBlur(1.1))
a = np.asarray(src).astype(np.float32)
a[..., 3] *= np.asarray(m).astype(np.float32) / 255
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
# no collar fur on the shoulder: the right collar's edge came along with the cut
c = np.asarray(crop).copy(); ci = c.astype(np.int32)
fur = (ci[..., 0] > 150) & (ci[..., 1] > 120) & (ci[..., 2] > 80) & (np.abs(ci[..., 0] - ci[..., 1]) < 70)
fur = np.asarray(Image.fromarray((fur * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
c[..., 3] = np.where(fur, 0, c[..., 3]); crop = Image.fromarray(c, 'RGBA')
at = [box[0] + dx, box[1]]
crop.save('app/art/bear/rig/arm-low.webp', quality=90, method=6)
json.dump({'at': at, 'size': crop.size}, open(S + '/armlow.json', 'w'))
# the body's own left shoulder is painted raised (it carries the raised arm): wherever it pokes above the mirrored
# shoulder, it goes; the collar fur stays. When the arm is raised, the raised arm's layer (behind the body) shows the
# painted shoulder there again.
body = np.asarray(Image.open(S + '/L_body.png')).copy()
al = np.zeros((H, W), np.float32); ca = np.asarray(crop.getchannel('A')).astype(np.float32) / 255
al[at[1]:at[1] + ca.shape[0], at[0]:at[0] + ca.shape[1]] = ca
top = np.full(W, H, np.int32)
for x in range(W):
    ys = np.where(al[:, x] > .5)[0]
    if len(ys): top[x] = ys[0]
yy, xx = np.mgrid[0:H, 0:W]
bb = body.astype(np.int32); r, g, b = bb[..., 0], bb[..., 1], bb[..., 2]
cream = (r > 150) & (g > 120) & (b > 80) & (np.abs(r - g) < 70)
gone = (xx < 172) & (yy > 200) & (yy < top[xx] + 3) & (top[xx] < H) & ~cream
gone |= (xx < 100) & (yy > 200) & (yy < 300)          # left of the mirrored shoulder: nothing of the body
body[..., 3] = np.where(gone, 0, body[..., 3])
Image.fromarray(body, 'RGBA').save(S + '/L_body_low.png')
Image.fromarray(body, 'RGBA').save('app/art/bear/rig/body.webp', quality=90, method=6)
print('arm-low', crop.size, 'at', at)
