// R6 N8 诊断：弹窗在场时遮罩覆盖——沿屏幕四边采样 elementFromPoint，
// 找未被 backdrop/float 覆盖的漏光点；并报各 backdrop 的矩形
// 用法: node shots/diag-r6-n8.mjs <w> <h> <phone|desktop> <station>
import { chromium } from '@playwright/test';

const W = Number(process.argv[2]);
const H = Number(process.argv[3]);
const PHONE = process.argv[4] === 'phone';
const STATION = Number(process.argv[5] ?? 2);
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: PHONE, isMobile: PHONE });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); localStorage.setItem('maicai-icons-seen', '1'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30_000 });
if (PHONE && W === 874) {
  await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(() => {});
}
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(1500);
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
}
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator(`[data-testid="demo-station-${STATION}"]`).dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.waitForTimeout(2500);
const out = await page.evaluate(({ W, H }) => {
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const layers = {};
  for (const sel of ['.popup-backdrop', '.phone-market-float', '.phone-rail', '.popup']) {
    const el = document.querySelector(sel);
    if (el) layers[sel] = { ...R(el), bg: getComputedStyle(el).backgroundColor, z: getComputedStyle(el).zIndex };
  }
  /* 采样网格：找命中到「棋盘/站点」类元素（未被遮罩盖住）的点 */
  const leaks = [];
  for (let x = 4; x < W; x += 16) {
    for (let y = 4; y < H; y += 16) {
      const el = document.elementFromPoint(x, y);
      if (!el) continue;
      const cls = el.className?.toString() ?? '';
      if (/board|station|tile|island|scene/i.test(cls) || el.tagName === 'CANVAS') {
        leaks.push({ x, y, hit: `${el.tagName}.${cls.slice(0, 30)}` });
      }
    }
  }
  return { layers, leakCount: leaks.length, leaks: leaks.slice(0, 8) };
}, { W, H });
console.log(`N8 ${W}x${H} station=${STATION}`, JSON.stringify(out, null, 1));
await browser.close();
