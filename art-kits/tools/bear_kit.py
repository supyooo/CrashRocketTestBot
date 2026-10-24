"""Build the bear and rocket kit (app/art/bear/) from the image generator's pictures in art-kits/bear/src/.

    python art-kits/tools/bear_kit.py            (needs Pillow and numpy)

1. The white background goes: white connected to the image border is flood-filled away, then the anti-aliased rim
   is un-mixed from white, so no light fringe is left around the fur.
2. The heads sheet is split into its four heads (islands, left to right: calm, hype, scared, win).
3. Each heads sheet head is fitted onto the head of the riding body (scale and offset found by comparing pixels),
   so the game can swap the face without moving it. The fit goes into kit.json with the other anchor points.
4. Everything is trimmed and saved as webp with alpha, at the sizes the game draws them (2x for sharp phones).
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = os.path.join('art-kits', 'bear', 'src')
OUT = os.path.join('app', 'art', 'bear')
BODY_H = 440          # px height of the bear pictures in the game files
ROCKET_W = 720        # px width of the rocket picture


def remove_white(img, thresh=232):
    """RGBA with the border-connected white removed and the rim un-mixed from white."""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    white = a.min(axis=2) > thresh
    bg = np.zeros((h, w), bool)
    bg[0, :] = white[0, :]; bg[-1, :] = white[-1, :]; bg[:, 0] = white[:, 0]; bg[:, -1] = white[:, -1]
    while True:                                   # grow the border seeds through white, 1 px per step, until stable
        g = bg.copy()
        g[1:, :] |= bg[:-1, :]; g[:-1, :] |= bg[1:, :]; g[:, 1:] |= bg[:, :-1]; g[:, :-1] |= bg[:, 1:]
        g &= white
        if (g == bg).all():
            break
        bg = g
    # the rim: pixels within 3 px of the background are a blend of the colour and white; estimate the cover from
    # how far the darkest channel is from white, relative to the solid colour just inside
    near = np.zeros_like(bg)
    k = bg.copy()
    for _ in range(3):
        k2 = k.copy(); k2[1:, :] |= k[:-1, :]; k2[:-1, :] |= k[1:, :]; k2[:, 1:] |= k[:, :-1]; k2[:, :-1] |= k[:, 1:]
        k = k2
    near = k & ~bg
    alpha = np.where(bg, 0.0, 1.0)
    mn = a.min(axis=2)
    cover = np.clip((255 - mn) / 255 * 1.6, 0, 1)            # light rim pixels mostly white -> low cover
    alpha = np.where(near, np.minimum(alpha, cover), alpha)
    rgb = a.copy()
    al = np.maximum(alpha, 1e-3)[..., None]
    unmixed = (a - (1 - al) * 255) / al                         # remove the white that was blended in
    rgb = np.where(near[..., None], np.clip(unmixed, 0, 255), rgb)
    alpha[alpha < .06] = 0
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim(im, pad=4):
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    x0, y0, x1, y1 = box
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))), (x0 - pad, y0 - pad)


def islands(im, min_px=4000):
    """Bounding boxes of the separate parts of a sheet, left to right."""
    a = np.asarray(im.getchannel('A')) > 20
    cols = a.any(axis=0)
    boxes, x = [], 0
    while x < len(cols):                         # the heads stand in a row with clear gaps: split by empty columns
        if cols[x]:
            x0 = x
            while x < len(cols) and cols[x]:
                x += 1
            sub = a[:, x0:x]
            if sub.sum() > min_px:
                ys = np.where(sub.any(axis=1))[0]
                boxes.append((x0, int(ys[0]), x, int(ys[-1]) + 1))
        x += 1
    return boxes


def fit_head(body, head, guess_box):
    """Scale and offset that lay `head` over the head in `body` (both RGBA), searched coarse to fine by the mean
    colour difference where the head is solid. guess_box: the rough head area in the body (x0, y0, x1, y1)."""
    B = np.asarray(body).astype(np.float32)
    best = None
    gx0, gy0, gx1, gy1 = guess_box
    target_w = gx1 - gx0
    for s in np.linspace(.8, 1.25, 19):
        hw, hh = max(8, round(head.width * s * target_w / head.width)), None
        sc = hw / head.width
        hs = head.resize((hw, max(8, round(head.height * sc))), Image.LANCZOS)
        Hh = np.asarray(hs).astype(np.float32)
        m = Hh[..., 3] > 230
        if m.sum() < 50:
            continue
        for dy in range(gy0 - 40, gy0 + 41, 6):
            for dx in range(gx0 - 40, gx0 + 41, 6):
                if dy < 0 or dx < 0 or dy + Hh.shape[0] > B.shape[0] or dx + Hh.shape[1] > B.shape[1]:
                    continue
                win = B[dy:dy + Hh.shape[0], dx:dx + Hh.shape[1]]
                d = np.abs(win[..., :3] - Hh[..., :3]).mean(axis=2)
                outside = (win[..., 3] < 128) & m
                score = d[m].mean() + 400 * outside.sum() / m.sum()
                if best is None or score < best[0]:
                    best = (score, sc, dx, dy)
    # refine around the best, 1 px steps
    score, sc, dx0, dy0 = best
    for s2 in np.linspace(sc * .97, sc * 1.03, 7):
        hs = head.resize((max(8, round(head.width * s2)), max(8, round(head.height * s2))), Image.LANCZOS)
        Hh = np.asarray(hs).astype(np.float32)
        m = Hh[..., 3] > 230
        for dy in range(dy0 - 6, dy0 + 7, 1):
            for dx in range(dx0 - 6, dx0 + 7, 1):
                if dy < 0 or dx < 0 or dy + Hh.shape[0] > B.shape[0] or dx + Hh.shape[1] > B.shape[1]:
                    continue
                win = B[dy:dy + Hh.shape[0], dx:dx + Hh.shape[1]]
                d = np.abs(win[..., :3] - Hh[..., :3]).mean(axis=2)
                outside = (win[..., 3] < 128) & m
                sc2 = d[m].mean() + 400 * outside.sum() / m.sum()
                if sc2 < best[0]:
                    best = (sc2, s2, dx, dy)
    return best


def holes(img, rgba, min_area=300, min_white=249):
    """Enclosed pockets of pure background white (between a paw and a sleeve): large and almost pure white.
    Small white spots (glints on the glasses, teeth) stay."""
    a = np.asarray(img.convert('RGB')).astype(np.int32)
    al = np.asarray(rgba.getchannel('A'))
    white = (a.min(axis=2) > 232) & (al > 0)
    h, w = white.shape
    seen = np.zeros_like(white)
    out = np.asarray(rgba).copy()
    for y0, x0 in zip(*np.where(white)):
        if seen[y0, x0]:
            continue
        stack, pts = [(y0, x0)], []
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop(); pts.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and white[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True; stack.append((yy, xx))
        if len(pts) >= min_area:
            ys, xs = np.array(pts).T
            if np.median(a[ys, xs].min(axis=1)) >= min_white:
                out[ys, xs, 3] = 0
    return Image.fromarray(out, 'RGBA')


def convex_hull(pts):
    pts = sorted(set(map(tuple, pts)))
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def restore_convex(src, cut, x0):
    """The chrome nose has pure white glints touching its edge, so they went with the background. The nose is convex:
    right of x0 everything inside the outline of what is left is rocket, put back from the source picture."""
    s = np.asarray(src.convert('RGB')); c = np.asarray(cut).copy()
    ys, xs = np.where(c[:, x0:, 3] > 128)
    hp = convex_hull(np.stack([xs + x0, ys], 1)[::7])
    S = 4; m = Image.new('L', (c.shape[1] * S, c.shape[0] * S)); ImageDraw.Draw(m).polygon([(x * S + S / 2, y * S + S / 2) for x, y in hp], fill=255)
    hm = np.asarray(m.resize((c.shape[1], c.shape[0]), Image.BOX)).astype(int); hm[:, :x0] = 0
    inner = np.asarray(Image.fromarray(((hm > 250) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9))) > 0
    fix = inner | ((hm > 0) & (c[..., 3] == 0))
    c[fix, :3] = s[fix]; c[..., 3] = np.maximum(c[..., 3], np.where(fix, hm, 0)).astype(np.uint8)
    return Image.fromarray(c, 'RGBA')


def rocket_axis(cut, tip, guess_tail):
    """The rocket's true axis in a riding picture: the middle between the upper and the lower edge of the free nose,
    fitted with a line and carried back. Returns the tail point (axis at the nozzle), the tip and the angle."""
    A = np.asarray(cut)[..., 3] > 128
    tip, n0 = np.array(tip, float), np.array(guess_tail, float)
    L = np.linalg.norm(tip - n0); u = (tip - n0) / L; n = np.array([-u[1], u[0]])
    def edge(P, s, sign):
        p = P + u * s; d = 0
        while d < 320:
            x, y = p + n * d * sign
            if x < 0 or y < 0 or x >= A.shape[1] or y >= A.shape[0] or not A[int(y), int(x)]: break
            d += 1
        return d
    ss = list(range(int(L * .64), int(L * .94), 10))
    k, c = np.polyfit(ss, [(edge(n0, s, 1) - edge(n0, s, -1)) / 2 for s in ss], 1)
    tail = n0 + n * c; tip2 = n0 + u * L + n * (k * L + c)
    return tail, tip2, float(np.arctan2(tip2[1] - tail[1], tip2[0] - tail[0]))


def scale(im, k):
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def fade_bottom(im, frac=.16):
    """The neck of a head fades out at the bottom, so it melts into the body's neck instead of covering the collar."""
    a = np.asarray(im).copy()
    h = a.shape[0]; n = max(1, int(h * frac))
    ramp = np.linspace(1, 0, n) ** 1.4
    a[h - n:, :, 3] = (a[h - n:, :, 3] * ramp[:, None]).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    src, cut = {}, {}
    for name in ['bear-cheer', 'bear-hang', 'bear-fall', 'bear-heads', 'rocket']:
        src[name] = Image.open(os.path.join(SRC, name + '.png'))
        cut[name] = holes(src[name], remove_white(src[name]))
        print('cut', name, file=sys.stderr)
    if '--preview' in sys.argv:                  # the cut pictures on a dark backdrop, to check the edges
        for name, im in cut.items():
            bgc = Image.new('RGBA', im.size, (40, 16, 80, 255)); bgc.alpha_composite(im); bgc.convert('RGB').save(os.path.join('refs', 'cut-' + name + '.jpg'), quality=88)
        sys.exit(0)

    names = ['calm', 'hype', 'scared', 'win']
    heads = [cut['bear-heads'].crop(b) for b in islands(cut['bear-heads'])]
    assert len(heads) == 4, 'expected 4 heads, found %d' % len(heads)
    # fit the heads on the riding body (at half size: fast and plenty precise), and the hype head on the other poses
    # to learn how big the bear is drawn in each picture
    H2 = lambda im: scale(im, .5)
    cheer2 = H2(cut['bear-cheer'])
    fits = {}
    for n, hd in zip(names, heads):
        sc, sc_s, dx, dy = fit_head(cheer2, H2(hd), (150, 95, 390, 330))
        fits[n] = {'s': float(sc_s), 'x': int(dx) * 2, 'y': int(dy) * 2, 'err': round(float(sc), 1)}
        print('fit', n, fits[n], file=sys.stderr)
    size = {'bear-cheer': fits['hype']['s']}
    for pose, box in [('bear-hang', (140, 100, 380, 330)), ('bear-fall', (60, 120, 300, 360))]:
        sc, sc_s, dx, dy = fit_head(H2(cut[pose]), H2(heads[1]), box)
        size[pose] = float(sc_s)
        print('size', pose, round(sc_s, 3), 'err', round(float(sc), 1), file=sys.stderr)

    # the bear: every pose scaled so its head is the same size; points in the source pictures, moved with the trim
    k0 = BODY_H / 1400
    kit = {'bear': {}, 'rocket': {}}
    pts = {'bear-cheer': {'seat': (545, 1062)}, 'bear-hang': {'handL': (187, 122), 'handR': (765, 122)}, 'bear-fall': {'mid': (500, 760)}}
    for fn in os.listdir(OUT):                     # start clean: old names would linger otherwise
        os.remove(os.path.join(OUT, fn))
    for pose in ['bear-cheer', 'bear-hang', 'bear-fall']:
        k = k0 * size['bear-cheer'] / size[pose]
        im, (ox, oy) = trim(cut[pose])
        im = scale(im, k)
        kit['bear'][pose[5:]] = {'w': im.width, 'h': im.height, **{p: [round((x - ox) * k), round((y - oy) * k)] for p, (x, y) in pts[pose].items()}}
        if pose == 'bear-cheer':
            cheer_im, cheer_off, cheer_k = im, (ox, oy), k
            continue
        im.save(os.path.join(OUT, pose[5:] + '.webp'), 'WEBP', quality=86, method=6)
    # the riding body with each face, painted together: the head goes over the original one (the hype face); where
    # the original laughing jaw would still show under a smaller face, the neck fur is painted over it first
    W, H = cheer_im.size
    def layer(img, x, y):
        L = Image.new('RGBA', (W, H)); L.alpha_composite(img, (x, y)); return np.asarray(L)
    place = {}
    for n, hd in zip(names, heads):
        f = fits[n]; k = cheer_k * f['s']
        place[n] = (fade_bottom(scale(hd, k), .12), round((f['x'] - cheer_off[0]) * cheer_k), round((f['y'] - cheer_off[1]) * cheer_k))
    old = layer(*place['hype'])[..., 3] > 120
    for n in names:
        h, x, y = place[n]
        if n == 'hype':
            comp = cheer_im
        else:
            body = np.asarray(cheer_im).copy()
            new = layer(h, x, y)[..., 3] > 160
            rows = np.arange(H)[:, None]
            peek = old & ~new & (rows >= y + h.height * .5) & (body[..., 3] > 0)
            ha = np.asarray(h)
            low = ha[int(ha.shape[0] * .65):]
            fur = np.median(low[low[..., 3] > 200][:, :3], axis=0)
            body[peek, :3] = fur
            grow = Image.fromarray((peek * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
            soft = Image.fromarray(body).filter(ImageFilter.GaussianBlur(2.5))
            comp = Image.composite(soft, Image.fromarray(body), grow)
            comp.alpha_composite(h, (x, y))
            print('face', n, 'jaw pixels painted', int(peek.sum()), file=sys.stderr)
        comp.save(os.path.join(OUT, 'cheer-' + n + '.webp'), 'WEBP', quality=86, method=6)
    kit['bear']['cheer']['faces'] = names
    # the rocket: nose to the right; the nozzle mouth, the axis and the seat on its back
    im, (ox, oy) = trim(cut['rocket'])
    k = ROCKET_W / im.width
    im = scale(im, k)
    im.save(os.path.join(OUT, 'rocket.webp'), 'WEBP', quality=86, method=6)
    rp = {'nozzle': (96, 445), 'tip': (1700, 432), 'seat': (1195, 290)}
    kit['rocket'] = {'w': im.width, 'h': im.height, **{p: [round((x - ox) * k), round((y - oy) * k)] for p, (x, y) in rp.items()}}
    # the bear riding the rocket, one picture per face (edits of one picture: same rocket, same framing)
    RIDE_K = .32
    faces = [f for f in ['calm', 'hype', 'scared'] if os.path.exists(os.path.join(SRC, 'ride-' + f + '.webp'))]
    if faces:
        ride = {}
        for f in faces:
            sp = Image.open(os.path.join(SRC, 'ride-' + f + '.webp'))
            c = restore_convex(sp, holes(sp, remove_white(sp)), 1262)
            a = np.asarray(c).copy(); hgt = a.shape[0]; n = 40          # the picture's cut bottom edge melts away
            a[hgt - n:, :, 3] = (a[hgt - n:, :, 3] * np.linspace(1, 0, n)[:, None]).astype(np.uint8)
            ride[f] = Image.fromarray(a, 'RGBA')
        tail, tip, ang = rocket_axis(ride[faces[0]], (1835, 232), (470, 1010))
        print('ride axis', tail.round(1), tip.round(1), round(np.degrees(ang), 2), file=sys.stderr)
        for f, im in ride.items():
            scale(im, RIDE_K).save(os.path.join(OUT, 'ride-' + f + '.webp'), 'WEBP', quality=86, method=6)
        W0, H0 = ride[faces[0]].size
        kit['ride'] = {'w': round(W0 * RIDE_K), 'h': round(H0 * RIDE_K), 'tail': (tail * RIDE_K).round(1).tolist(), 'tip': (tip * RIDE_K).round(1).tolist(),
                       'angle': round(ang, 4), 'chest': [round(860 * RIDE_K), round(440 * RIDE_K)], 'faces': faces}
        # the rocket alone for the bail-out: the generator's own (ride-empty) or, until then, the separate rocket
        # turned silver and laid along the same axis
        ep = os.path.join(SRC, 'ride-empty.webp')
        if os.path.exists(ep):
            sp = Image.open(ep); e = restore_convex(sp, holes(sp, remove_white(sp)), 1262)
        else:
            r = cut['rocket']; ra = np.asarray(r).astype(np.float32)
            g = ra[..., 1] > ra[..., 0] + 25                              # the green hull -> grey chrome
            lum = ra[..., :3].mean(axis=2, keepdims=True) * 1.15
            ra[..., :3] = np.where(g[..., None], np.clip(lum * np.array([1.0, 1.0, 1.06]), 0, 255), ra[..., :3])
            r = Image.fromarray(ra.astype(np.uint8), 'RGBA')
            rx, ry = np.array([96., 445.]), np.array([1700., 432.])      # its nozzle and tip in the source picture
            k2 = np.linalg.norm(tip - tail) / np.linalg.norm(ry - rx) * 1.04
            r = scale(r, k2); rx, ry = rx * k2, ry * k2
            rot = -np.degrees(ang - np.arctan2(ry[1] - rx[1], ry[0] - rx[0]))
            c0 = np.array(r.size) / 2
            r2 = r.rotate(rot, resample=Image.BICUBIC, expand=True)
            c1 = np.array(r2.size) / 2; th = np.radians(-rot)
            R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
            tip_r = R @ (ry - c0) + c1
            e = Image.new('RGBA', (W0, H0)); off = (tip - tip_r).round().astype(int)
            e.alpha_composite(r2.crop((max(0, -off[0]), max(0, -off[1]), r2.width, r2.height)), (max(0, off[0]), max(0, off[1])))
        scale(e, RIDE_K).save(os.path.join(OUT, 'ride-empty.webp'), 'WEBP', quality=86, method=6)
    with open(os.path.join(OUT, 'kit.json'), 'w') as fh:
        json.dump(kit, fh, indent=1)
    for fn in sorted(os.listdir(OUT)):
        print(fn, os.path.getsize(os.path.join(OUT, fn)), file=sys.stderr)
    print(json.dumps(kit))
