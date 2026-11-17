#!/usr/bin/env python3
"""r8-analyze.py — R8 per-viewport analysis.

Usage: python3 shots/r8-analyze.py <tag>

Reads shots/r8_rects_<tag>.json + shots/r8_<name>_<tag>_noui.png and
prints, per viewport: flood-fill rim bbox (visible land incl. sand rim,
measure-rim.py method) and core bbox (grass/tan, analyze-ui.py tests),
both as ratios of the harness-measured free rect; panel cover of the
core bbox and of the rim bbox (grid union, analyze-ui.py method);
button touch-target audit; overflow signals recorded by the harness.
The pinned fill metric (solver FIT_BOUNDS rim / free rect) is computed
separately by shots/fit-r8-check.ts from the same rects — flood-fill
reads lower on desktop by design (shallow-water rim counts as water),
exactly as in ART_R5.md §3.
"""
import json
import sys
from collections import deque

from PIL import Image

SHOTS = '/home/hatch/workspace/maicai-work/shots'


def is_water(r, g, b):
    return b > r + 25 and b > g + 15 and b > 100


def is_core(r, g, b):
    green = g > r + 15 and g > b + 10 and g > 90
    tan = r > 140 and r - b > 45 and g - b > 22 and r >= g >= b
    return green or tan


def segment(png):
    """Return (rim_bbox, core_bbox) in px from a noui screenshot."""
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
    rim = None
    if best:
        _, minx, miny, maxx, maxy = best
        rim = {'x': minx * step, 'y': miny * step,
               'w': (maxx - minx + 1) * step, 'h': (maxy - miny + 1) * step}
    # Core bbox from the LARGEST connected core component only: boats,
    # buoys and the orange primary button share the tan palette and
    # would otherwise stretch the bbox across the screen (seen at
    # 915x412 / 740x360 in the first pass).
    comp = bytearray(gw * gh)
    best = None
    for start in range(gw * gh):
        if not core[start] or comp[start]:
            continue
        q = deque([start])
        comp[start] = 1
        minx = maxx = start % gw
        miny = maxy = start // gw
        n = 0
        while q:
            i = q.popleft()
            n += 1
            gx, gy = i % gw, i // gw
            minx, maxx = min(minx, gx), max(maxx, gx)
            miny, maxy = min(miny, gy), max(maxy, gy)
            for nx, ny in ((gx - 1, gy), (gx + 1, gy), (gx, gy - 1), (gx, gy + 1)):
                if 0 <= nx < gw and 0 <= ny < gh:
                    j = ny * gw + nx
                    if core[j] and not comp[j]:
                        comp[j] = 1
                        q.append(j)
        if best is None or n > best[0]:
            best = (n, minx, miny, maxx, maxy)
    core_bb = None
    if best:
        _, minx, miny, maxx, maxy = best
        core_bb = {'x': minx * step, 'y': miny * step,
                   'w': (maxx - minx + 1) * step, 'h': (maxy - miny + 1) * step}
    return rim, core_bb


def covered(rects, region, step=4):
    if not region or region['w'] <= 0 or region['h'] <= 0:
        return 0.0
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
    return round(100.0 * hit / total, 1) if total else 0.0


def main():
    tag = sys.argv[1]
    with open(f'{SHOTS}/r8_rects_{tag}.json') as f:
        all_rects = json.load(f)
    fit = {}
    try:
        with open(f'{SHOTS}/r8_fit_{tag}.json') as f:
            fit = json.load(f)
    except FileNotFoundError:
        pass
    hdr = (f"{'viewport':<22}{'free':>10}{'pinned':>8}{'flood':>7}{'core':>7}"
           f"{'coreCov%':>9}{'sRimCov%':>9}{'minBtn':>8}{'ovfX':>6}  notes")
    print(hdr)
    for name, data in all_rects.items():
        free = data.get('free') or {}
        fa = (free.get('w', 0) * free.get('h', 0)) or 1
        rim, core = segment(f'{SHOTS}/r8_{name}_{tag}_noui.png')
        flood = rim['w'] * rim['h'] / fa if rim else float('nan')
        coref = core['w'] * core['h'] / fa if core else float('nan')
        panels = data.get('panels', [])
        ccov = covered(panels, core) if core else float('nan')
        # Solver-rim cover: panels vs the FIT_BOUNDS rim rect from the
        # real solver (fit-r8-check) — the region R6's 0.81% used.
        srim = (fit.get(name) or {}).get('rim')
        rcov = covered(panels, srim) if srim else float('nan')
        pinned = (fit.get(name) or {}).get('fill', float('nan'))
        btns = data.get('buttons', [])
        minbtn = min((min(b['w'], b['h']) for b in btns), default=0)
        notes = []
        if data.get('canvas', {}).get('w', 0) == 0:
            notes.append('NO-CANVAS(2D?)')
        if 'phoneBotsRight' in data and data['phoneBotsRight'] is not None:
            if data['phoneBotsRight'] > data.get('railLeft', 10 ** 9):
                notes.append('bots-row>rail!')
        ov = data.get('overlayStyle')
        # Desktop prompt bar must stay a single row; on phones the
        # .board3d-overlay is the reset-pill wrapper (column is right).
        if ov and name.startswith('desktop') and ov.get('flexDirection') != 'row':
            notes.append(f"overlay={ov}")
        print(f"{name:<22}{free.get('w', 0):>4}x{free.get('h', 0):<5}"
              f"{pinned:>8.3f}{flood:>7.3f}{coref:>7.3f}{ccov:>9}{rcov:>9}"
              f"{minbtn:>8}{data.get('docOverflowX', '?'):>6}  {' '.join(notes)}")
        if rim:
            print(f"{'':<22}rim {rim['w']}x{rim['h']}@({rim['x']},{rim['y']})"
                  f" core {core['w']}x{core['h']}@({core['x']},{core['y']})" if core else '')


if __name__ == '__main__':
    main()
