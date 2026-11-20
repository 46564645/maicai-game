/** Probe E8: 岛占比复测（R1 定稿 E8）。
 * Usage: BASE=http://localhost:4173 node shots/probe-e8.mjs
 * 前置：npm run build 后 vite preview 在 4173。
 *
 * 双轨：
 *  轨 1（求解值）：在活页面里按 CameraRig.measureFreeRect 的同一套
 *    选择器实测自由矩形，写 shots/r8_rects_e8.json；之后离线跑
 *    `npx vite-node shots/fit-r8-check.ts shots/r8_rects_e8.json`
 *    用真实 solveFit 对实测矩形求 fill（rim 投影包围盒面积 ÷ 自由
 *    矩形面积，R5/R8 钉住口径，目标带 0.60–0.70）。
 *  轨 2（截图像素粗测）：无弹窗的总览态截图，在页面内 canvas 解码，
 *    在自由矩形内按「海色」分类（蓝/teal 主导：b>r+25 且 g>r+15 且
 *    b>=g-10）得非海掩膜，算岛屿剪影的包围盒与像素面积，各除以
 *    自由矩形面积与视口面积。剪影不含 rim 外推（树高/浅滩），只作
 *    量级复核，不替代轨 1 口径。
 * 两个视口：1280×800（主值）、874×402（副值，手机横屏 ctx）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

/* 与 CameraRig.measureFreeRect 同口径（选择器与算法逐行对应） */
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
  return { x: left.right, y: topbar.bottom, w: right.left - left.right, h: bottom - topbar.bottom };
};

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
  const x0 = Math.max(0, Math.floor(free.x * sx));
  const y0 = Math.max(0, Math.floor(free.y * sy));
  const x1 = Math.min(cv.width - 1, Math.ceil((free.x + free.w) * sx));
  const y1 = Math.min(cv.height - 1, Math.ceil((free.y + free.h) * sy));
  const data = cx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1).data;
  const W = x1 - x0 + 1;
  const isSea = (r, g, b) => b > r + 25 && g > r + 15 && b >= g - 10;
  let land = 0;
  let total = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 0; y <= y1 - y0; y += 2) {
    for (let x = 0; x <= x1 - x0; x += 2) {
      const i = (y * W + x) * 4;
      total++;
      if (!isSea(data[i], data[i + 1], data[i + 2])) {
        land++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const step = 2;
  const landPx = land * step * step;
  const freePx = free.w * free.h * sx * sy;
  const viewPx = vw * vh * sx * sy;
  const bboxPx = maxX >= minX ? (maxX - minX + step) * (maxY - minY + step) : 0;
  return {
    landShareFree: landPx / freePx,
    landShareView: landPx / viewPx,
    bboxShareFree: bboxPx / freePx,
    bboxShareView: bboxPx / viewPx,
  };
};

const rects = {};
const pixelRows = [];
const browser = await chromium.launch({ args: GL_ARGS });
for (const [name, compact, ctxOpts, vw, vh] of [
  ['desktop-1280x800', false, { viewport: { width: 1280, height: 800 } }, 1280, 800],
  ['phone-874x402', true, { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }, 874, 402],
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
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(4500); // 等相机落位（fit 求解后缓动收敛）
  const free = await page.evaluate(FREE_RECT_FN, compact);
  console.log(`${name}: freeRect=${JSON.stringify(free)}`);
  if (free) rects[name] = { free: { x: Math.round(free.x), y: Math.round(free.y), w: Math.round(free.w), h: Math.round(free.h) } };

  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  fs.writeFileSync(path.join(OUT, `r10e_e8_board_${name}.png`), Buffer.from(res.data, 'base64'));
  if (free) {
    const px = await page.evaluate(MASK_FN, { b64: res.data, free, vw, vh }).catch((e) => String(e));
    console.log(`${name}: pixels=${JSON.stringify(px)}`);
    if (px && typeof px === 'object') pixelRows.push({ name, free, ...px });
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(OUT, 'r8_rects_e8.json'), JSON.stringify(rects, null, 2));
console.log('\n===== E8 轨2 截图像素粗测 =====');
for (const r of pixelRows) {
  console.log(
    `${r.name}: 剪影面积/自由矩形=${r.landShareFree.toFixed(3)} 剪影包围盒/自由矩形=${r.bboxShareFree.toFixed(3)} 剪影面积/视口=${r.landShareView.toFixed(3)} 包围盒/视口=${r.bboxShareView.toFixed(3)}`,
  );
}
console.log('轨1：接着跑 npx vite-node shots/fit-r8-check.ts shots/r8_rects_e8.json 读 solveFit fill');
