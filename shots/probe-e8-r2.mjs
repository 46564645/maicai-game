/** Probe E8-R2: 岛占比新口径实测（ww 定稿，本轮标「待定」不判过）。
 * Usage: BASE=http://localhost:4175 node shots/probe-e8-r2.mjs
 * 前置：npm run build 后 vite preview 在 4175。
 *
 * 新口径：分子 = 岛的真实像素面积（截图剪影，非包围盒），分母 =
 *   整个画面。剪影取自「canvas-only」截图：把 canvas 及其祖先之外
 *   的 DOM 全部 visibility:hidden（布局尺寸不变 → 相机不重解），
 *   截图里只剩 WebGL 画面，非海像素即岛（含岛上物件，与旧轨 2 的
 *   分类器/采样步长一致）。面板遮挡不扣分子——底线 1（站点不挡）
 *   由求解器站点占位框 ⊆ 自由矩形单独保证，本探针一并复核。
 * 旧口径照报：轨 1 solveFit fill（rim 包围盒 ÷ 自由矩形，离线跑
 *   shots/fit-r8-check.ts 或同口径脚本读 r8_rects_e8r2.json）；
 *   轨 2 自由矩形内剪影占比（旧探针同方法，在普通截图上数）。
 * 视口：1280×800（主）、874×402（副，手机横屏 + --safe-* 注入
 *   t20/r62/b20/l62，与 safearea spec / after-shots 同口径）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4175';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';

/* 与 CameraRig.measureFreeRect 同口径（逐行对应） */
const FREE_RECT_FN = (compact) => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  };
  if (compact) {
    const rail = rect('.phone-rail');
    if (!rail) return null;
    const bots = rect('.phone-bots');
    const quick = rect('.phone-quick');
    const left = bots ? Math.max(0, bots.left - 8) : 0;
    const top = bots ? bots.bottom : 0;
    const bottom = quick ? quick.top : window.innerHeight;
    return { x: left, y: top, w: rail.left - left, h: bottom - top };
  }
  const left = rect('.game-left');
  const right = rect('.game-right');
  const topbar = rect('.game-topbar');
  if (!left || !right || !topbar) return null;
  const overlay = rect('.board3d-overlay');
  const bottomBar = rect('.game-bottom');
  const bottom = overlay ? overlay.top : bottomBar ? bottomBar.top : window.innerHeight;
  return {
    x: left.right,
    y: topbar.bottom,
    w: right.left - left.right,
    h: bottom - topbar.bottom,
  };
};

const PANEL_RECTS_FN = () => {
  const sels = ['.game-topbar', '.game-left', '.game-right', '.game-bottom', '.board3d-overlay', '.phone-rail', '.phone-bots', '.phone-quick'];
  const out = {};
  for (const s of sels) {
    const el = document.querySelector(s);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out[s] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }
  return out;
};

/* 只保留 canvas 及其祖先可见，其余 DOM 全部 hidden（布局不变） */
const HIDE_CHROME_FN = () => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return false;
  let el = canvas;
  while (el) {
    el.classList.add('e8-keep');
    el = el.parentElement;
  }
  const style = document.createElement('style');
  style.id = 'e8-hide';
  style.textContent = 'body *:not(.e8-keep){visibility:hidden !important;} .e8-keep{visibility:visible !important;}';
  document.head.appendChild(style);
  return true;
};

/* 剪影计数：整屏非海像素（岛）+ 自由矩形内非海像素 + 整屏非海包围盒。
   分类器与旧轨 2 完全一致（海色：b>r+25 且 g>r+15 且 b>=g-10），步长 2。 */
const MASK_FN = async ({ b64, free, vw, vh }) => {
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = `data:image/png;base64,${b64}`;
  });
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const sx = img.naturalWidth / vw;
  const sy = img.naturalHeight / vh;
  const data = cx.getImageData(0, 0, cv.width, cv.height).data;
  const W = cv.width;
  const isSea = (r, g, b) => b > r + 25 && g > r + 15 && b >= g - 10;
  const step = 2;
  let land = 0;
  let total = 0;
  let landFree = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const fx0 = free ? Math.floor(free.x * sx) : -1;
  const fy0 = free ? Math.floor(free.y * sy) : -1;
  const fx1 = free ? Math.ceil((free.x + free.w) * sx) : -1;
  const fy1 = free ? Math.ceil((free.y + free.h) * sy) : -1;
  for (let y = 0; y < cv.height; y += step) {
    for (let x = 0; x < cv.width; x += step) {
      const i = (y * W + x) * 4;
      total++;
      if (!isSea(data[i], data[i + 1], data[i + 2])) {
        land++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (free && x >= fx0 && x <= fx1 && y >= fy0 && y <= fy1) landFree++;
      }
    }
  }
  const px = step * step;
  return {
    landShareView: (land * px) / (vw * vh * sx * sy),
    landShareFree: free ? (landFree * px) / (free.w * free.h * sx * sy) : null,
    landBboxView: maxX >= minX
      ? { x: Math.round(minX / sx), y: Math.round(minY / sy), w: Math.round((maxX - minX + step) / sx), h: Math.round((maxY - minY + step) / sy) }
      : null,
    samples: total,
  };
};

const rects = {};
const rows = [];
const browser = await chromium.launch({ args: GL_ARGS });
for (const [name, compact, ctxOpts, vw, vh] of [
  ['desktop', false, { viewport: { width: 1280, height: 800 } }, 1280, 800],
  ['phone', true, { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }, 874, 402],
]) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('maicai-lang', 'en');
    } catch { /* ignore */ }
  });
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1`);
  if (compact) await page.addStyleTag({ content: SAFE_CSS });
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);

  const cdp = await page.context().newCDPSession(page);
  const shot = async () => (await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false })).data;

  // 先藏 chrome 再等相机落位：落位判据用 canvas-only 剪影包围盒
  //（普通截图里 DOM 会污染非海计数）。visibility 隐藏不改布局，
  // 相机不会因此重解；测完移除样式即恢复普通画面。
  const hidden = await page.evaluate(HIDE_CHROME_FN);
  let prevBox = null;
  let stable = 0;
  let free = null;
  for (let i = 0; i < 10 && stable < 2; i++) {
    await page.waitForTimeout(1500);
    free = await page.evaluate(FREE_RECT_FN, compact);
    const m = await page.evaluate(MASK_FN, { b64: await shot(), free, vw, vh }).catch(() => null);
    const box = m?.landBboxView;
    if (box && prevBox && Math.abs(box.x - prevBox.x) < 3 && Math.abs(box.y - prevBox.y) < 3 && Math.abs(box.w - prevBox.w) < 3 && Math.abs(box.h - prevBox.h) < 3) stable++;
    else stable = 0;
    if (box) prevBox = box;
  }
  console.log(`${name}: settled stable=${stable} hidden=${hidden} freeRect=${JSON.stringify(free)}`);
  if (free) rects[name === 'desktop' ? 'desktop-1280x800' : 'phone-874x402'] = { free: { x: Math.round(free.x), y: Math.round(free.y), w: Math.round(free.w), h: Math.round(free.h) } };

  // canvas-only 截图（新口径分子：岛真实像素）
  const canvasB64 = await shot();
  fs.writeFileSync(path.join(OUT, `r10e_r2_e8_${name}_canvasonly.png`), Buffer.from(canvasB64, 'base64'));
  const canvasMask = await page.evaluate(MASK_FN, { b64: canvasB64, free, vw, vh }).catch((e) => String(e));

  // 恢复普通画面：面板矩形 + 普通截图（交付 + 目视逐站核对）
  await page.evaluate(() => document.getElementById('e8-hide')?.remove());
  await page.waitForTimeout(500);
  const panels = await page.evaluate(PANEL_RECTS_FN);
  console.log(`${name}: panels=${JSON.stringify(panels)}`);
  const normalB64 = await shot();
  fs.writeFileSync(path.join(OUT, `r10e_r2_e8_${name}.png`), Buffer.from(normalB64, 'base64'));
  const normalMask = await page.evaluate(MASK_FN, { b64: normalB64, free, vw, vh }).catch((e) => String(e));
  console.log(`${name}: normal=${JSON.stringify(normalMask)} canvasOnly=${JSON.stringify(canvasMask)}`);
  rows.push({ name, free, panels, normalMask, canvasMask });
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(OUT, 'r8_rects_e8r2.json'), JSON.stringify(rects, null, 2));
fs.writeFileSync(path.join(OUT, 'r2_e8_result.json'), JSON.stringify(rows, null, 2));
console.log('\n===== E8-R2 新口径（canvas-only 剪影 ÷ 整屏） =====');
for (const r of rows) {
  const c = r.canvasMask;
  const n = r.normalMask;
  if (c && typeof c === 'object') {
    console.log(`${r.name}: 剪影/整屏=${c.landShareView.toFixed(3)} 剪影包围盒=${JSON.stringify(c.landBboxView)} 剪影/自由矩形=${c.landShareFree?.toFixed(3)}（普通截图自由矩形内剪影=${n && typeof n === 'object' ? n.landShareFree?.toFixed(3) : 'n/a'}）`);
  }
}
console.log('轨1（旧口径 solveFit）：npx vite-node shots/fit-r8-check.ts shots/r8_rects_e8r2.json');
