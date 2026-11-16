#!/usr/bin/env python3
"""analyze-ui.py — occlusion metrics for the UI A/B loop.

Reads shots/ui_rects_all.json (panel rects per tag/screen, from measure-ui.mjs)
and the *_noui.png board references (DOM panels hidden) to segment the island.

Metrics per screen+tag:
  canvas_cover_%   share of the 3D canvas area covered by any DOM panel
                   (grid-sampled union of panel rects ∩ canvas rect)
  island_w/h       island bounding box (px, from colour segmentation)
  island_cover_%   share of the island bbox area covered by any DOM panel
Island CORE pixel test (grass green / road tan — the play field; the pale
sand rim is excluded by design, it carries no gameplay). UI must be hidden
(the *_noui shots) because cream/tan UI panels false-positive the tan test.
  green: G > R+15 and G > B+10 and G > 90
  tan:   R > 140 and R-B > 45 and G-B > 22 and R >= G >= B
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


def covered(rects, region, step=4):
    """Share of `region` covered by the union of `rects` (grid sampling)."""
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
    with open(f'{SHOTS}/ui_rects_all.json') as f:
        all_rects = json.load(f)
    tags = sys.argv[1:] or list(all_rects.keys())
    islands = {}
    for vp in ('desktop', 'phone'):
        for tag in tags:
            if f'board_{vp}' in all_rects.get(tag, {}):
                bb = island_bbox(f'{SHOTS}/ui_board_{vp}_{tag}_noui.png')
                if bb:
                    islands[(vp, tag)] = bb
    print(f"{'screen':<18}{'tag':<8}{'canvas%':>8}{'island WxH':>14}{'island%':>9}{'primary H':>10}")
    for tag in tags:
        for screen, data in all_rects.get(tag, {}).items():
            vp = 'phone' if screen.endswith('phone') else 'desktop'
            panels = data.get('panels', [])
            ccov = covered(panels, data.get('canvas'))
            isl = islands.get((vp, tag))
            icov = covered(panels, isl) if isl else None
            istr = f"{isl['w']}x{isl['h']}" if isl else '-'
            ph = data.get('primary', {}).get('h', '-')
            print(f"{screen:<18}{tag:<8}{ccov:>8}{istr:>14}"
                  f"{(f'{icov}' if icov is not None else '-'):>9}{str(ph):>10}")


if __name__ == '__main__':
    main()
