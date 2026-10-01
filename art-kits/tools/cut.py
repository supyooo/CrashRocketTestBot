"""Cut a character kit sheet from the image generator into separate transparent PNGs.

    python art-kits/tools/cut.py art-kits/musk/src/heads.webp art-kits/musk/parts heads

1. The white background is removed by flood fill from the image border (only white that is connected to the
   outside goes, so white teeth and eyes inside the outline stay). Anti-aliased edge pixels are un-mixed from white,
   so no light fringe is left around the dark outline.
2. Separate parts are found as connected islands (on a reduced mask, so small gaps inside a part do not split it).
3. Each part is saved as <prefix>-<n>.png, numbered left to right, top to bottom (rows of parts), with its box.
"""
import sys, os, json
from collections import deque
from PIL import Image, ImageDraw

def remove_white(img, thresh=40):
    rgba = img.convert('RGBA')
    w0, h0 = rgba.size
    if all(rgba.getpixel(p)[3] < 10 for p in [(0, 0), (w0 - 1, 0), (0, h0 - 1), (w0 - 1, h0 - 1)]):
        return rgba                                   # already transparent (ChatGPT usually does this)
    rgb = img.convert('RGB')
    w, h = rgb.size
    marker = (255, 0, 255)
    seeds = [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)] + [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    for s in seeds:
        r, g, b = rgb.getpixel(s)
        if r > 225 and g > 225 and b > 225:
            ImageDraw.floodfill(rgb, s, marker, thresh=thresh)
    src = img.convert('RGBA').load()
    m = rgb.load()
    out = Image.new('RGBA', (w, h))
    o = out.load()
    bg = [[m[x, y] == marker for x in range(w)] for y in range(h)]
    for y in range(h):
        row = bg[y]
        for x in range(w):
            if row[x]:
                o[x, y] = (0, 0, 0, 0)
                continue
            r, g, b, a = src[x, y]
            # edge pixels next to the background: un-mix from white
            near = (x > 0 and row[x - 1]) or (x < w - 1 and row[x + 1]) or (y > 0 and bg[y - 1][x]) or (y < h - 1 and bg[y + 1][x])
            if near or (x > 1 and row[x - 2]) or (x < w - 2 and row[x + 2]):
                al = 1 - min(r, g, b) / 255
                al = max(al, 0.0)
                if al < 0.98:
                    if al < 0.06:
                        o[x, y] = (0, 0, 0, 0)
                        continue
                    r = int(max(0, min(255, (r - (1 - al) * 255) / al)))
                    g = int(max(0, min(255, (g - (1 - al) * 255) / al)))
                    b = int(max(0, min(255, (b - (1 - al) * 255) / al)))
                    o[x, y] = (r, g, b, int(al * 255))
                    continue
            o[x, y] = (r, g, b, 255)
    return out

def islands(img, step=4, min_cells=40):
    w, h = img.size
    a = img.getchannel('A').load()
    gw, gh = (w + step - 1) // step, (h + step - 1) // step
    grid = [[False] * gw for _ in range(gh)]
    for gy in range(gh):
        for gx in range(gw):
            x0, y0 = gx * step, gy * step
            hit = False
            for yy in range(y0, min(h, y0 + step), 2):
                for xx in range(x0, min(w, x0 + step), 2):
                    if a[xx, yy] > 40:
                        hit = True; break
                if hit: break
            grid[gy][gx] = hit
    seen = [[False] * gw for _ in range(gh)]
    boxes = []
    for gy in range(gh):
        for gx in range(gw):
            if not grid[gy][gx] or seen[gy][gx]:
                continue
            q = deque([(gx, gy)]); seen[gy][gx] = True
            x0 = x1 = gx; y0 = y1 = gy; n = 0
            while q:
                cx, cy = q.popleft(); n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < gw and 0 <= ny < gh and grid[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True; q.append((nx, ny))
            if n >= min_cells:
                boxes.append([x0 * step, y0 * step, min(w, (x1 + 1) * step), min(h, (y1 + 1) * step)])
    # reading order: rows (by vertical centre, with tolerance), then left to right
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows, cur = [], []
    for b in boxes:
        if cur and (b[1] + b[3]) / 2 - (cur[0][1] + cur[0][3]) / 2 > (cur[0][3] - cur[0][1]) * .5:
            rows.append(cur); cur = []
        cur.append(b)
    if cur: rows.append(cur)
    return [b for r in rows for b in sorted(r, key=lambda b: b[0])]

if __name__ == '__main__':
    src, outdir, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(outdir, exist_ok=True)
    img = remove_white(Image.open(src))
    boxes = islands(img)
    info = []
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        part = img.crop((x0, y0, x1, y1))
        bb = part.getbbox()
        if bb:
            part = part.crop(bb); x0, y0 = x0 + bb[0], y0 + bb[1]
        name = f'{prefix}-{i + 1}.png'
        part.save(os.path.join(outdir, name))
        info.append({'file': name, 'x': x0, 'y': y0, 'w': part.width, 'h': part.height})
    print(json.dumps(info))
