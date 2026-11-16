#!/usr/bin/env python3
"""measure-exposure.py — T2 exposure metric (CHANGELOG_VISUAL T2口径).

Usage: python3 shots/measure-exposure.py <board_png> [noui_png]
  board_png: 1280x800 board screenshot WITH UI (the acceptance shot).
  noui_png:  optional *_noui.png reference; island core bbox is segmented
             from it (panels hidden, so cream/tan UI cannot false-positive).
             Defaults to <board_png> with '_noui' inserted before '.png'.

Metric: island bottom band = LOWER HALF of the island core bbox
(grass green / road tan segmentation, same test as analyze-ui.py).
% near-white: pixels with R>=245, G>=242, B>=232.
% blown:      pixels with R>=250, G>=248, B>=240.
Acceptance (A6): near-white ≈4% (3–5%), blown ≈1.9% (≤2.5%).
"""
import json
import sys
from PIL import Image

SHOTS = '/home/hatch/workspace/maicai-work/shots'


def island_bbox(png):
    im = Image.open(png).convert('RGB')
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            green = g > r + 15 and g > b + 10 and g > 90
            tan = r > 140 and r - b > 45 and g - b > 22 and r >= g >= b
            if green or tan:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < 0:
        return None
    return {'x': minx, 'y': miny, 'w': maxx - minx, 'h': maxy - miny}


def main():
    board = sys.argv[1]
    noui = sys.argv[2] if len(sys.argv) > 2 else board.replace('.png', '_noui.png')
    bb = island_bbox(noui)
    if not bb:
        print('no island found in', noui)
        return 1
    # lower half of the island core bbox
    y0 = bb['y'] + bb['h'] // 2
    y1 = bb['y'] + bb['h']
    x0, x1 = bb['x'], bb['x'] + bb['w']
    im = Image.open(board).convert('RGB')
    px = im.load()
    total = near = blown = 0
    for y in range(y0, y1, 2):
        for x in range(x0, x1, 2):
            r, g, b = px[x, y]
            total += 1
            if r >= 245 and g >= 242 and b >= 232:
                near += 1
            if r >= 250 and g >= 248 and b >= 240:
                blown += 1
    print(f'island core bbox {bb["w"]}x{bb["h"]}@({bb["x"]},{bb["y"]}) '
          f'band y{y0}-{y1} x{x0}-{x1} n={total}')
    print(f'near-white (>=245,242,232): {100.0 * near / total:.2f}%  '
          f'blown (>=250,248,240): {100.0 * blown / total:.2f}%')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
