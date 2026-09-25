"""Splash-screen icon for @BotFather: 512x512 SVG with a single <path>.

BotFather only accepts one path, so the green-candle rocket from app/art.js is
redrawn as a flat silhouette (body, nose, fins, nozzle, flame, three exhaust puffs)
and baked into one path. Run from the project root:  python brand/icon_svg.py
"""
import io
import math
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", "loading-icon.svg")


def rrect(x, y, w, h, r, n=6):
    pts = []
    for cx, cy, a0 in [(x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)]:
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def quad(p0, p1, p2, n=10):
    out = []
    for i in range(n + 1):
        t = i / n
        out.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]))
    return out


def circle(cx, cy, r, n=20):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


# Same local units as drawCandle() in app/art.js: nose points to +x.
SHAPES = [
    rrect(-50, -12, 92, 24, 6),                                        # body
    quad((41, -12), (58, -6), (66, 0)) + quad((66, 0), (58, 6), (41, 12))[1:],  # nose
    [(-46, -12), (-63, -28), (-30, -12)],                              # top fin
    [(-46, 12), (-63, 28), (-30, 12)],                                 # bottom fin
    [(-58, -8), (-49, -8), (-49, 8), (-58, 8)],                        # nozzle
    [(66, -1), (79, -1), (79, 1), (66, 1)],                            # wick
    quad((-61, -8), (-96, -5), (-104, 0)) + quad((-104, 0), (-96, 5), (-61, 8))[1:],  # flame
    circle(-116, 0, 5.5), circle(-131, 0, 4), circle(-143, 0, 2.8),    # exhaust puffs
]


def main():
    xs = [p[0] for s in SHAPES for p in s]
    mid = (min(xs) + max(xs)) / 2
    a, k = math.radians(-45), 2.55
    ca, sa = math.cos(a), math.sin(a)

    def tr(p):
        x, y = p[0] - mid, p[1]
        return 256 + k * (x * ca - y * sa), 256 + k * (x * sa + y * ca)

    d = "".join("M" + "L".join("%.1f %.1f" % tr(p) for p in s) + "Z" for s in SHAPES)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
           '<path fill="#2BFF88" d="%s"/></svg>' % d)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(svg)
    print(OUT)


if __name__ == "__main__":
    main()
