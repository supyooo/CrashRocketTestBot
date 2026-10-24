"""Straighten a generated rocket whose nose cone is bent off the body's line (image generators draw long diagonal things
with a bend). The cone is sheared back across the body's line, by an amount growing linearly from its base: a linear
map keeps its edges straight (a turn growing along the cone would curve it), the base stays attached to the band and
the band and the body stay as they are.

    python art-kits/tools/straighten.py <in> <out> nozzle_x nozzle_y band_rear_x band_rear_y band_front_x band_front_y [--preview]

nozzle: the centre of the nozzle's rear face; band_rear / band_front: the centres of the dark band's rear and front
faces. The body's line runs from the nozzle through the band's rear; the cone starts at the band's front.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw


def cone_bend(A, O, u, n):
    """The cone's centre line against the body's line, in degrees (positive: the nose turns towards -n, up)."""
    def edge(s, sign):
        p = O + u * s; d = 0
        while d < 400:
            x, y = p + n * d * sign
            if x < 0 or y < 0 or x >= A.shape[1] or y >= A.shape[0] or not A[int(y), int(x)]: break
            d += .5
        return d
    # the length of the cone: march along the body's line until the mask ends (an upper bound is fine)
    s_end = 0
    while True:
        x, y = O + u * (s_end + 2)
        if x >= A.shape[1] or y < 0 or not A[int(y), int(x)] and s_end > 40: break
        s_end += 2
        if s_end > 2000: break
    ss = np.arange(8, max(16, s_end * .85), 4)
    mids = [(edge(s, 1) - edge(s, -1)) / 2 for s in ss]
    k = np.polyfit(ss, mids, 1)[0]
    return float(np.degrees(np.arctan(k))), ss, mids


def mask(img):
    """The rocket's pixels: opaque ones, or on a white sheet everything but the white connected to the border (a white
    threshold alone would cut the near-white glints of a chrome nose out of the rocket)."""
    if img.mode == 'RGBA':
        return np.asarray(img)[..., 3] > 128
    white = np.asarray(img.convert('RGB')).min(axis=2) >= 235
    b = Image.fromarray(np.where(white, 255, 0).astype(np.uint8), 'L').copy()
    H, W = white.shape
    for x, y in [(x, y) for x in range(0, W, 7) for y in (0, H - 1)] + [(x, y) for y in range(0, H, 7) for x in (0, W - 1)]:
        if b.getpixel((x, y)) == 255:
            ImageDraw.floodfill(b, (x, y), 128)
    return np.asarray(b) != 128


def straighten(img, nozzle, band_rear, band_front, theta=None):
    a = np.asarray(img.convert('RGBA')).astype(np.float32)
    A = mask(img)
    N, P, O = map(lambda p: np.array(p, float), (nozzle, band_rear, band_front))
    u = (P - N) / np.linalg.norm(P - N); n = np.array([-u[1], u[0]])
    bend, _, _ = cone_bend(A, O, u, n)
    k = np.tan(np.radians(bend if theta is None else theta))   # the cone's centre line drifts k px across per px along
    H, W = A.shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    rx, ry = xx - O[0], yy - O[1]
    S = rx * u[0] + ry * u[1]
    D = rx * n[0] + ry * n[1]
    # a pixel at (S, D) in front of the band shows the source at (S, D + k*S): the cone's centre line (at k*S) lands on D=0
    sD = D + k * np.maximum(S, 0)
    sx = O[0] + u[0] * S + n[0] * sD
    sy = O[1] + u[1] * S + n[1] * sD
    front = S > 0
    out = a.copy()
    # bilinear sample of the source at (sx, sy) for the pixels in front of the band
    x0 = np.clip(np.floor(sx).astype(int), 0, W - 2); y0 = np.clip(np.floor(sy).astype(int), 0, H - 2)
    fx = np.clip(sx - x0, 0, 1)[..., None]; fy = np.clip(sy - y0, 0, 1)[..., None]
    smp = (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x0 + 1] * fx * (1 - fy) + a[y0 + 1, x0] * (1 - fx) * fy + a[y0 + 1, x0 + 1] * fx * fy)
    inside = (sx >= 0) & (sy >= 0) & (sx < W - 1) & (sy < H - 1)
    if img.mode != 'RGBA':
        smp = np.where(inside[..., None], smp, 255)
    out[front] = smp[front]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA' if img.mode == 'RGBA' else 'RGBA'), bend


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    v = list(map(float, sys.argv[3:9]))
    im = Image.open(src)
    if im.mode != 'RGBA':
        im = im.convert('RGB')
    out, bend = straighten(im, v[0:2], v[2:4], v[4:6])
    print('cone bent by %.2f degrees, turned back' % bend)
    if im.mode == 'RGB':
        out = out.convert('RGB')
    out.save(dst)
    if '--preview' in sys.argv:
        for name, pic in (('before', im.convert('RGB')), ('after', out.convert('RGB'))):
            d = ImageDraw.Draw(pic)
            N, P = np.array(v[0:2]), np.array(v[2:4]); u = (P - N) / np.linalg.norm(P - N)
            d.line([tuple(N - u * 60), tuple(N + u * 1400)], fill=(255, 0, 0), width=2)
            pic.save(dst.rsplit('.', 1)[0] + '-' + name + '.jpg', quality=88)
        bend2, _, _ = cone_bend(mask(out.convert('RGB') if im.mode == 'RGB' else out), np.array(v[4:6]), u, np.array([-u[1], u[0]]))
        print('after: cone off the body line by %.2f degrees' % bend2)
