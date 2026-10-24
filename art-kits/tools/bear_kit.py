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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from straighten import straighten

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


def scale(im, k):
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def fade_bottom(im, frac=.16):
    """The neck of a head fades out at the bottom, so it melts into the body's neck instead of covering the collar."""
    a = np.asarray(im).copy()
    h = a.shape[0]; n = max(1, int(h * frac))
    ramp = np.linspace(1, 0, n) ** 1.4
    a[h - n:, :, 3] = (a[h - n:, :, 3] * ramp[:, None]).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


# ---------------- the bear riding the rocket ----------------
RIDE_K = .32                                     # the riding pictures are made 2000 px wide; the game files are 640
# The other faces are edits of the reference picture: the generator keeps the framing within a few pixels, so each
# edit is matched onto the reference on rocket parts no pose covers (the nozzle, the band's bottom, the tip).
RIDE_REF = 'hype'
RIDE_PATCHES = [(430, 880, 640, 1100), (1350, 620, 1520, 750), (1700, 200, 1850, 330)]
# The generator bends the nose a few degrees off the hull, so the pictures are straightened (straighten.py) from
# landmarks picked on the reference: the centres of the nozzle's rear face and of the band's rear and front faces.
RIDE_FIX = ((511.5, 1016.5), (1331.5, 560), (1396, 528.5))
# the axis of the straightened riding pictures: the centre of the nozzle's rear face and the nose tip
RIDE_TAIL, RIDE_TIP = (511.5, 1016.5), (1857, 281)
RIDE_CHEST = (880, 400)                          # where the bear leaves the rocket from at the bail-out
# The rocket alone for after the bail-out, a picture of its own framing. Its hull is in full view, so the straightening
# takes two points of the hull's mid-line (the nozzle is drawn a little off it) and the band's front; the axis is then
# the nozzle's centre and the tip of the straightened picture, as on the riding ones. Then it is reshaped onto the
# riding rocket (fit_empty).
EMPTY_FIX = ((851.0, 683.6), (1254.7, 424.0), (1355.7, 359.1))
EMPTY_TAIL, EMPTY_TIP = (436, 926), (1795.5, 79.7)


def register(img, ref, patches, r=10):
    """An edit laid exactly over the reference picture: each patch's shift found by comparing pixels (to a fraction of
    a pixel), then the turn, scale and shift that fit them all."""
    a = np.asarray(ref.convert('RGB')).astype(np.float32); b = np.asarray(img.convert('RGB')).astype(np.float32)
    src, dst = [], []
    for x0, y0, x1, y1 in patches:
        P = a[y0:y1, x0:x1]
        E = np.full((2 * r + 1, 2 * r + 1), np.inf)
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if y0 + dy >= 0 and x0 + dx >= 0 and y1 + dy <= b.shape[0] and x1 + dx <= b.shape[1]:
                    E[dy + r, dx + r] = np.abs(b[y0 + dy:y1 + dy, x0 + dx:x1 + dx] - P).mean()
        iy, ix = np.unravel_index(np.argmin(E), E.shape)

        def sub(e0, e1, e2):                      # the parabola's low point through three neighbours
            d = e0 - 2 * e1 + e2
            return .5 * (e0 - e2) / d if np.isfinite(d) and d > 0 else 0
        fx = sub(E[iy, ix - 1], E[iy, ix], E[iy, ix + 1]) if 0 < ix < 2 * r else 0
        fy = sub(E[iy - 1, ix], E[iy, ix], E[iy + 1, ix]) if 0 < iy < 2 * r else 0
        c = np.array([(x0 + x1) / 2, (y0 + y1) / 2])
        dst.append(c); src.append(c + (ix - r + fx, iy - r + fy))
    # least squares for [x', y'] = [[p, -q], [q, p]] [x, y] + t, from the edit's points to the reference's
    rows, rhs = [], []
    for (x, y), (X, Y) in zip(src, dst):
        rows += [[x, -y, 1, 0], [y, x, 0, 1]]; rhs += [X, Y]
    p, q, tx, ty = np.linalg.lstsq(np.array(rows), np.array(rhs), rcond=None)[0]
    M = np.array([[p, -q], [q, p]]); t = np.array([tx, ty])
    Mi = np.linalg.inv(M); ti = -Mi @ t
    print('  matched: scale %.4f, turn %.3f deg, shift %s' % (np.hypot(p, q), np.degrees(np.arctan2(q, p)), t.round(1)), file=sys.stderr)
    return img.convert('RGB').transform(img.size, Image.AFFINE, (Mi[0, 0], Mi[0, 1], ti[0], Mi[1, 0], Mi[1, 1], ti[1]),
                                        resample=Image.BICUBIC, fillcolor=(255, 255, 255))


def cut_ride(sp, fix, name, pockets=True):
    """Straightened and cut out. `pockets`: enclosed white between the paws and the body goes too (the rocket alone has
    none, and its white glints would go with it)."""
    sp = sp.convert('RGB')
    if fix:
        sp, bend = straighten(sp, *fix)
        sp = sp.convert('RGB')
        print(name, 'nose bent by %.2f degrees, straightened' % bend, file=sys.stderr)
    return holes(sp, remove_white(sp)) if pockets else remove_white(sp)


def melt_bottom(im, n=40):
    """The riding picture's bottom edge cuts the fin and the nozzle: it melts away instead of ending in a straight line."""
    a = np.asarray(im).copy(); hgt = a.shape[0]
    a[hgt - n:, :, 3] = (a[hgt - n:, :, 3] * np.linspace(1, 0, n)[:, None]).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def hull_profile(alpha, tail, tip, n=400):
    """The hull's lower edge: its distance below the axis at n points from the nozzle (0) to the tip (1)."""
    T, P = np.array(tail, float), np.array(tip, float); L = np.linalg.norm(P - T); u = (P - T) / L; nv = np.array([-u[1], u[0]])
    s = np.linspace(0, 1, n); d = np.arange(0, 500, .5)
    xs = T[0] + u[0] * s[:, None] * L + nv[0] * d[None, :]; ys = T[1] + u[1] * s[:, None] * L + nv[1] * d[None, :]
    ok = (xs >= 0) & (ys >= 0) & (xs < alpha.shape[1] - 1) & (ys < alpha.shape[0] - 1)
    inside = ok & (alpha[np.clip(np.round(ys).astype(int), 0, alpha.shape[0] - 1), np.clip(np.round(xs).astype(int), 0, alpha.shape[1] - 1)] > 128)
    out = ~inside
    return s, d[np.where(out.any(1), out.argmax(1), len(d) - 1)]


def band_marks(s, r):
    """The hull's half width along the body, and where the band bulges out of it: its start, its widest point, its end."""
    body = np.median(r[(s > .4) & (s < .58)])
    i0 = np.where((s > .5) & (s < .8) & (r > body * 1.04))[0][0]
    i1 = i0
    while i1 + 1 < len(s) and r[i1 + 1] > body * 1.04:
        i1 += 1
    return body, (s[i0], s[i0 + np.argmax(r[i0:i1 + 1])], s[i1])


def sample(a, sx, sy):
    """Bilinear samples of an RGBA array (premultiplied, so the edges do not darken), transparent outside."""
    H, W = a.shape[:2]
    pm = a.astype(np.float32); pm[..., :3] *= pm[..., 3:] / 255
    x0 = np.floor(sx).astype(int); y0 = np.floor(sy).astype(int); fx = (sx - x0)[..., None]; fy = (sy - y0)[..., None]
    inside = (x0 >= 0) & (y0 >= 0) & (x0 < W - 1) & (y0 < H - 1)
    x0 = np.clip(x0, 0, W - 2); y0 = np.clip(y0, 0, H - 2)
    v = (pm[y0, x0] * (1 - fx) * (1 - fy) + pm[y0, x0 + 1] * fx * (1 - fy) + pm[y0 + 1, x0] * (1 - fx) * fy + pm[y0 + 1, x0 + 1] * fx * fy)
    v[~inside] = 0
    return v                                      # premultiplied


def fit_empty(ride, empty, r_axis, e_axis):
    """The rocket alone laid over the riding picture's rocket. The generator drew it as a picture of its own (a little
    fatter, the band a little narrower), so it is reshaped along the axis: lengthwise piecewise through the band's
    marks, across by the ratio of the hulls' widths. Then the swap at the bail-out keeps the outline and the bands."""
    R = np.asarray(ride); E = np.asarray(empty)
    (Tr, Pr), (Te, Pe) = [(np.array(a, float), np.array(b, float)) for a, b in (r_axis, e_axis)]
    Lr, Le = np.linalg.norm(Pr - Tr), np.linalg.norm(Pe - Te)
    ur, ue = (Pr - Tr) / Lr, (Pe - Te) / Le; nr, ne = np.array([-ur[1], ur[0]]), np.array([-ue[1], ue[0]])
    s, rr = hull_profile(R[..., 3], Tr, Pr); _, re = hull_profile(E[..., 3], Te, Pe)
    br, mr = band_marks(s, rr); be, me = band_marks(s, re)
    xs, ys = [0, *mr, 1], [0, *me, 1]

    def f(q):                                     # lengthwise: through the marks, straight on past the ends
        return np.where(q < 0, q * ys[1] / xs[1], np.where(q > 1, 1 + (q - 1) * (1 - ys[-2]) / (1 - xs[-2]), np.interp(q, xs, ys)))
    # across: the ratio of the widths, the body's in the back (the fins hide the hull's edge there), smoothed
    ratio = np.interp(f(s), s, re) / np.maximum(rr, 1)
    ratio = np.where(s < .4, be / br, ratio)
    ratio = np.where(s > .96, ratio[np.searchsorted(s, .96)], ratio)
    ratio = np.convolve(np.pad(ratio, 6, mode='edge'), np.ones(13) / 13, mode='valid')
    H, W = R.shape[:2]; yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    S = ((xx - Tr[0]) * ur[0] + (yy - Tr[1]) * ur[1]) / Lr; D = (xx - Tr[0]) * nr[0] + (yy - Tr[1]) * nr[1]
    S2 = f(S) * Le; D2 = D * np.interp(np.clip(S, 0, 1), s, ratio)
    out = sample(E, Te[0] + ue[0] * S2 + ne[0] * D2, Te[1] + ue[1] * S2 + ne[1] * D2)
    a = out[..., 3:]; out[..., :3] = np.where(a > 0, out[..., :3] * 255 / np.maximum(a, 1e-3), 0)
    print('empty rocket: band %s -> %s, widths %.0f -> %.0f' % (np.round(me, 3), np.round(mr, 3), be, br), file=sys.stderr)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def build_ride(kit):
    """The bear riding the rocket, one picture per face (edits of one picture: same rocket, same framing), and the
    rocket alone for the bail-out laid along the same axis."""
    faces = [f for f in ['calm', 'hype', 'scared'] if os.path.exists(os.path.join(SRC, 'ride-' + f + '.webp'))]
    if RIDE_REF not in faces:
        return
    ref = Image.open(os.path.join(SRC, 'ride-' + RIDE_REF + '.webp')).convert('RGB')
    ride = {}
    for f in faces:
        im = ref if f == RIDE_REF else Image.open(os.path.join(SRC, 'ride-' + f + '.webp'))
        if f != RIDE_REF:
            print('ride-' + f, file=sys.stderr)
            im = register(im, ref, RIDE_PATCHES)
        ride[f] = cut_ride(im, RIDE_FIX, 'ride-' + f)
    tail, tip = np.array(RIDE_TAIL, float), np.array(RIDE_TIP, float); ang = float(np.arctan2(tip[1] - tail[1], tip[0] - tail[0]))
    print('ride axis', tail.round(1), tip.round(1), round(np.degrees(ang), 2), file=sys.stderr)
    for f, im in ride.items():
        scale(melt_bottom(im), RIDE_K).save(os.path.join(OUT, 'ride-' + f + '.webp'), 'WEBP', quality=86, method=6)
    W0, H0 = ride[RIDE_REF].size
    kit['ride'] = {'w': round(W0 * RIDE_K), 'h': round(H0 * RIDE_K), 'tail': (tail * RIDE_K).round(1).tolist(), 'tip': (tip * RIDE_K).round(1).tolist(),
                   'angle': round(ang, 4), 'chest': [round(c * RIDE_K) for c in RIDE_CHEST], 'faces': faces}
    ep = os.path.join(SRC, 'ride-empty.webp')
    if os.path.exists(ep):
        e = fit_empty(ride[RIDE_REF], cut_ride(Image.open(ep), EMPTY_FIX, 'ride-empty', pockets=False), (RIDE_TAIL, RIDE_TIP), (EMPTY_TAIL, EMPTY_TIP))
        scale(melt_bottom(e), RIDE_K).save(os.path.join(OUT, 'ride-empty.webp'), 'WEBP', quality=86, method=6)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if '--ride-only' in sys.argv:                 # just the riding pictures (the heads fit takes minutes)
        with open(os.path.join(OUT, 'kit.json')) as fh:
            kit = json.load(fh)
        build_ride(kit)
        with open(os.path.join(OUT, 'kit.json'), 'w') as fh:
            json.dump(kit, fh, indent=1)
        print(json.dumps(kit.get('ride')))
        sys.exit(0)
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
    build_ride(kit)
    with open(os.path.join(OUT, 'kit.json'), 'w') as fh:
        json.dump(kit, fh, indent=1)
    for fn in sorted(os.listdir(OUT)):
        print(fn, os.path.getsize(os.path.join(OUT, fn)), file=sys.stderr)
    print(json.dumps(kit))
