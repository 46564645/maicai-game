#!/usr/bin/env python3
"""measure-rim.py — R5 island-fill metric (DISCUSSION_R5 R1口径).

Usage: python3 shots/measure-rim.py <noui_png> <desktop|phone>

R1 metric: fill = island projected bbox (rim outer contour, FIT_BOUNDS
incl. shallow-water rim) ÷ free-band area. Target 0.60–0.70, both viewports.
Free bands (R4-measured): desktop 868x539 (bot cols inner edges x
topbar-bottom -> stack-top), phone 612x282 (canvas minus top avatar row,
fabs zone and 262px right rail).

Method: flood-fill water (blue-dominant pixels) from the image borders;
the largest connected non-water component is the island (grass + road +
sand rim + foam ring + buildings). Boats and clouds are separate, smaller
components and are excluded. Also prints the core bbox (grass/tan test,
same as analyze-ui.py) for cross-check, and the solver prediction is
reported separately in ART_R5.md (shots/solver-actual.mjs).
"""
import sys
from collections import deque

from PIL import Image

FREE_BAND = {
    'desktop': (868, 539),
    'phone': (612, 282),
}
VIEWPORT = {
    'desktop': (1280, 800),
    'phone': (874, 402),
}


def is_water(r, g, b):
    return b > r + 25 and b > g + 15 and b > 100


def is_core(r, g, b):
    green = g > r + 15 and g > b + 10 and g > 90
    tan = r > 140 and r - b > 45 and g - b > 22 and r >= g >= b
    return green or tan


def main():
    png, vp = sys.argv[1], sys.argv[2]
    step = 2
    im = Image.open(png).convert('RGB')
    w, h = im.size
    px = im.load()
    gw, gh = (w + step - 1) // step, (h + step - 1) // step
    water = bytearray(gw * gh)
    core = bytearray(gw * gh)
    for gy in range(gh):
        for gx in range(gw):
            r, g, b = px[min(gx * step, w - 1), min(gy * step, h - 1)]
            water[gy * gw + gx] = 1 if is_water(r, g, b) else 0
            core[gy * gw + gx] = 1 if is_core(r, g, b) else 0
    # flood water from borders
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
    # largest connected non-water component NOT touching the border =
    # island (grass + road + sand rim + foam ring + buildings). The sky /
    # UI background is also non-water but touches the border, so it is
    # excluded; boats and clouds are separate, smaller components.
    # (If the sea fills the frame, the border-touching component is water
    # and the same rule still isolates the island.)
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
        touches_border = False
        while q:
            i = q.popleft()
            n += 1
            gx, gy = i % gw, i // gw
            if gx == 0 or gy == 0 or gx == gw - 1 or gy == gh - 1:
                touches_border = True
            minx, maxx = min(minx, gx), max(maxx, gx)
            miny, maxy = min(miny, gy), max(maxy, gy)
            for nx, ny in ((gx - 1, gy), (gx + 1, gy), (gx, gy - 1), (gx, gy + 1)):
                if 0 <= nx < gw and 0 <= ny < gh:
                    j = ny * gw + nx
                    if land[j] and not comp[j]:
                        comp[j] = 1
                        q.append(j)
        if touches_border:
            continue
        if best is None or n > best[0]:
            best = (n, minx, miny, maxx, maxy)
    if not best:
        print('no island component found')
        return 1
    n, minx, miny, maxx, maxy = best
    rim = {
        'x': minx * step, 'y': miny * step,
        'w': (maxx - minx + 1) * step, 'h': (maxy - miny + 1) * step,
    }
    # core bbox (grass/tan)
    cminx, cminy, cmaxx, cmaxy = gw, gh, -1, -1
    for gy in range(gh):
        for gx in range(gw):
            if core[gy * gw + gx]:
                cminx, cmaxx = min(cminx, gx), max(cmaxx, gx)
                cminy, cmaxy = min(cminy, gy), max(cmaxy, gy)
    core_bb = {
        'x': cminx * step, 'y': cminy * step,
        'w': (cmaxx - cminx + 1) * step, 'h': (cmaxy - cminy + 1) * step,
    } if cmaxx >= 0 else None
    bw, bh = FREE_BAND[vp]
    vw, vh = VIEWPORT[vp]
    band = bw * bh
    print(f'rim bbox  {rim["w"]}x{rim["h"]}@({rim["x"]},{rim["y"]}) '
          f'area={rim["w"] * rim["h"] // 1000}k  '
          f'rim/free-band={rim["w"] * rim["h"] / band:.3f}  '
          f'rim/viewport={rim["w"] * rim["h"] / (vw * vh):.3f}  '
          f'(pixels {n * step * step // 1000}k)')
    if core_bb:
        print(f'core bbox {core_bb["w"]}x{core_bb["h"]}@({core_bb["x"]},{core_bb["y"]}) '
              f'area={core_bb["w"] * core_bb["h"] // 1000}k  '
              f'core/free-band={core_bb["w"] * core_bb["h"] / band:.3f}  '
              f'core/viewport={core_bb["w"] * core_bb["h"] / (vw * vh):.3f}')
    print(f'free band {bw}x{bh}={band // 1000}k  viewport {vw}x{vh}={vw * vh // 1000}k')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
