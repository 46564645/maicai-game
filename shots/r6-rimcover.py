#!/usr/bin/env python3
"""r6-rimcover.py — panel cover of the island RIM bbox (flood-fill, same
segmentation as measure-rim.py) for one tag/screen, using panel rects from
ui_rects_all.json. Usage:
  python3 shots/r6-rimcover.py <tag> <board_desktop|board_phone>
Prints rim bbox, fill (rim/free-band), and panel cover % of the rim bbox.
"""
import json
import sys
from collections import deque

from PIL import Image

SHOTS = '/home/hatch/workspace/maicai-work/shots'
FREE_BAND = {'desktop': (868, 539), 'phone': (612, 282)}


def is_water(r, g, b):
    return b > r + 25 and b > g + 15 and b > 100


def rim_bbox(png):
    step = 2
    im = Image.open(png).convert('RGB')
    w, h = im.size
    px = im.load()
    gw, gh = (w + step - 1) // step, (h + step - 1) // step
    water = bytearray(gw * gh)
    for gy in range(gh):
        for gx in range(gw):
            r, g, b = px[min(gx * step, w - 1), min(gy * step, h - 1)]
            water[gy * gw + gx] = 1 if is_water(r, g, b) else 0
    seen = bytearray(gw * gh)
    q = deque()
    for gx in range(gw):
        for gy in (0, gh - 1):
            i = gy * gw + gx
            if water[i] and not seen[i]:
                seen[i] = 1
                q.append(i)
    for gy in range(gh):
        for gx in (0, gw - 1):
            i = gy * gw + gx
            if water[i] and not seen[i]:
                seen[i] = 1
                q.append(i)
    while q:
        i = q.popleft()
        gx, gy = i % gw, i // gw
        for nx, ny in ((gx - 1, gy), (gx + 1, gy), (gx, gy - 1), (gx, gy + 1)):
            if 0 <= nx < gw and 0 <= ny < gh:
                j = ny * gw + nx
                if water[j] and not seen[j]:
                    seen[j] = 1
                    q.append(j)
    land = bytearray(gw * gh)
    for i in range(gw * gh):
        land[i] = 0 if (water[i] and seen[i]) else 1
    comp = bytearray(gw * gh)
    best = None
    for start in range(gw * gh):
        if not land[start] or comp[start]:
            continue
        q = deque([start])
        comp[start] = 1
        minx = maxx = start % gw
        miny = maxy = start // gw
        n = 0
        touches = False
        while q:
            i = q.popleft()
            n += 1
            gx, gy = i % gw, i // gw
            if gx == 0 or gy == 0 or gx == gw - 1 or gy == gh - 1:
                touches = True
            minx, maxx = min(minx, gx), max(maxx, gx)
            miny, maxy = min(miny, gy), max(maxy, gy)
            for nx, ny in ((gx - 1, gy), (gx + 1, gy), (gx, gy - 1), (gx, gy + 1)):
                if 0 <= nx < gw and 0 <= ny < gh:
                    j = ny * gw + nx
                    if land[j] and not comp[j]:
                        comp[j] = 1
                        q.append(j)
        if touches:
            continue
        if best is None or n > best[0]:
            best = (n, minx, miny, maxx, maxy)
    if not best:
        return None
    _, minx, miny, maxx, maxy = best
    return {
        'x': minx * step, 'y': miny * step,
        'w': (maxx - minx + 1) * step, 'h': (maxy - miny + 1) * step,
    }


def covered(rects, region, step=2):
    total = hit = 0
    y = region['y'] + step / 2
    while y < region['y'] + region['h']:
        x = region['x'] + step / 2
        while x < region['x'] + region['w']:
            total += 1
            for r in rects:
                if r['x'] <= x < r['x'] + r['w'] and r['y'] <= y < r['y'] + r['h']:
                    hit += 1
                    break
            x += step
        y += step
    return round(100.0 * hit / total, 2) if total else 0.0


def main():
    tag, screen = sys.argv[1], sys.argv[2]
    vp = 'phone' if screen.endswith('phone') else 'desktop'
    with open(f'{SHOTS}/ui_rects_all.json') as f:
        all_rects = json.load(f)
    data = all_rects[tag][screen]
    rim = rim_bbox(f'{SHOTS}/ui_{screen}_{tag}_noui.png')
    bw, bh = FREE_BAND[vp]
    fill = rim['w'] * rim['h'] / (bw * bh)
    cov = covered(data.get('panels', []), rim)
    print(f'{tag} {screen}: rim {rim["w"]}x{rim["h"]}@({rim["x"]},{rim["y"]}) '
          f'fill={fill:.3f} rim-cover={cov}%')


if __name__ == '__main__':
    main()
