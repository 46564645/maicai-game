#!/usr/bin/env python3
"""Fish 卡模板改前/改后对比图合成（交付自证，非验收门）。
布局：标签条 BEFORE → 改前整帧 → 标签条 AFTER → 改后整帧 →
标签条 FISH CARD ZOOM → 改前/改后 Fish 卡裁切并排（等高 300）。
用法：python3 shots/compose_fish.py <desktop|phone>
裁切框按当轮帧实测调整（参数在下方字典）。
"""
import sys
from PIL import Image, ImageDraw

KIND = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
FILES = {
    'desktop': ('shots/r10e_r2fix_fish_before_desktop.png', 'shots/r10e_r2fix_market_desktop.png',
                (300, 215, 470, 395), (300, 215, 470, 395)),
    'phone': ('shots/r10e_r2fix_fish_before_phone.png', 'shots/r10e_r2fix_market_phone.png',
              (0, 80, 130, 230), (0, 80, 130, 230)),
}
before_path, after_path, crop_b, crop_a = FILES[KIND]
before = Image.open(before_path).convert('RGB')
after = Image.open(after_path).convert('RGB')
W = max(before.width, after.width)

def label(text):
    bar = Image.new('RGB', (W, 40), (24, 32, 54))
    d = ImageDraw.Draw(bar)
    d.text((16, 12), text, fill=(255, 255, 255))
    return bar

def zoom(img, box):
    c = img.crop(box)
    scale = 300 / c.height
    return c.resize((round(c.width * scale), 300))

zb, za = zoom(before, crop_b), zoom(after, crop_a)
zoom_row = Image.new('RGB', (max(W, zb.width + za.width + 12), 300), (255, 255, 255))
zoom_row.paste(zb, (0, 0))
zoom_row.paste(za, (zb.width + 12, 0))
if zoom_row.width != W:
    canvas = Image.new('RGB', (W, 300), (255, 255, 255))
    canvas.paste(zoom_row, (0, 0))
    zoom_row = canvas

parts = [label('BEFORE - old template (round crop)'), before,
         label('AFTER - new template (full art + white board)'), after,
         label('FISH CARD ZOOM - before | after'), zoom_row]
H = sum(p.height for p in parts)
out = Image.new('RGB', (W, H), (255, 255, 255))
y = 0
for p in parts:
    out.paste(p, (0, y))
    y += p.height
out.save(f'shots/r10e_r2fix_fish_before_after_{KIND}.png')
print('saved', f'shots/r10e_r2fix_fish_before_after_{KIND}.png', out.size)
