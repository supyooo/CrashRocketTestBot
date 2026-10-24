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
# The generator bends the nose a few degrees off the hull, so each picture is straightened (straighten.py) from its
# landmarks, picked on the picture: the centres of the nozzle's rear face and of the band's rear and front faces.
# A picture that is already straight (an edit of the straightened one) needs none.
RIDE_FIX = {'hype': ((511.5, 1016.5), (1331.5, 560), (1396, 528.5))}
# the axis of the straightened riding pictures: the centre of the nozzle's rear face and the nose tip
RIDE_TAIL, RIDE_TIP = (511.5, 1016.5), (1857, 281)
RIDE_CHEST = (880, 400)                          # where the bear leaves the rocket from at the bail-out
# the rocket alone for after the bail-out: its landmarks and axis, picked on its picture
EMPTY_FIX = None
EMPTY_TAIL, EMPTY_TIP = None, None


def cut_ride(path, fix):
    sp = Image.open(path).convert('RGB')
    if fix:
        sp, bend = straighten(sp, *fix)
        sp = sp.convert('RGB')
        print(os.path.basename(path), 'nose bent by %.2f degrees, straightened' % bend, file=sys.stderr)
    c = holes(sp, remove_white(sp))
    a = np.asarray(c).copy(); hgt = a.shape[0]; n = 40          # the picture's cut bottom edge melts away
    a[hgt - n:, :, 3] = (a[hgt - n:, :, 3] * np.linspace(1, 0, n)[:, None]).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def build_ride(kit):
    """The bear riding the rocket, one picture per face (edits of one picture: same rocket, same framing), and the
    rocket alone for the bail-out laid along the same axis."""
    faces = [f for f in ['calm', 'hype', 'scared'] if os.path.exists(os.path.join(SRC, 'ride-' + f + '.webp'))]
    if not faces:
        return
    ride = {f: cut_ride(os.path.join(SRC, 'ride-' + f + '.webp'), RIDE_FIX.get(f)) for f in faces}
    tail, tip = np.array(RIDE_TAIL, float), np.array(RIDE_TIP, float); ang = float(np.arctan2(tip[1] - tail[1], tip[0] - tail[0]))
    print('ride axis', tail.round(1), tip.round(1), round(np.degrees(ang), 2), file=sys.stderr)
    for f, im in ride.items():
        scale(im, RIDE_K).save(os.path.join(OUT, 'ride-' + f + '.webp'), 'WEBP', quality=86, method=6)
    W0, H0 = ride[faces[0]].size
    kit['ride'] = {'w': round(W0 * RIDE_K), 'h': round(H0 * RIDE_K), 'tail': (tail * RIDE_K).round(1).tolist(), 'tip': (tip * RIDE_K).round(1).tolist(),
                   'angle': round(ang, 4), 'chest': [round(c * RIDE_K) for c in RIDE_CHEST], 'faces': faces}
    ep = os.path.join(SRC, 'ride-empty.webp')
    if os.path.exists(ep):
        assert EMPTY_TAIL and EMPTY_TIP, 'pick the axis of ride-empty.webp first'
        e = cut_ride(ep, EMPTY_FIX)
        et, ep2 = np.array(EMPTY_TAIL, float), np.array(EMPTY_TIP, float); ea = float(np.arctan2(ep2[1] - et[1], ep2[0] - et[0]))
        k = np.linalg.norm(tip - tail) / np.linalg.norm(ep2 - et); rot = ang - ea
        c, s_ = np.cos(rot) * k, np.sin(rot) * k
        # output = M @ input + t: the empty rocket scaled and turned onto the riding rocket's axis, tips together
        M = np.array([[c, -s_], [s_, c]]); t = tip - M @ ep2
        Mi = np.linalg.inv(M); ti = -Mi @ t
        e = e.transform((W0, H0), Image.AFFINE, (Mi[0, 0], Mi[0, 1], ti[0], Mi[1, 0], Mi[1, 1], ti[1]), resample=Image.BICUBIC)
        print('empty rocket: scale', round(k, 3), 'turn', round(np.degrees(rot), 2), file=sys.stderr)
        scale(e, RIDE_K).save(os.path.join(OUT, 'ride-empty.webp'), 'WEBP', quality=86, method=6)


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
