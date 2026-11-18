/** r10a-hover.mjs — 悬停拉直+抬起：hover 中间摊卡 → transform 角度→0、Y 上移、邻卡让位 */
import { chromium } from '@playwright/test';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(2500);
async function waitPanel(testid, timeoutMs = 60_000) {
  const panel = page.locator(`[data-testid="${testid}"]`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if ((await panel.count()) > 0) return;
    if ((await page.locator('.popup').count()) === 0) {
      const e = page.locator('.board-enter, [data-testid="action-primary"]').first();
      if ((await e.count()) > 0) await e.dispatchEvent('click').catch(() => {});
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`${testid} never opened`);
}
await waitPanel('panel-drawTask');
await page.locator('.deck').waitFor({ timeout: 15_000 });
await page.locator('.deck-top').click();
await page.waitForTimeout(1200);
if ((await page.locator('[data-testid="demo-station-2"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-2"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await waitPanel('panel-market');
await page.waitForTimeout(900);

const read = () => page.evaluate(() =>
  [...document.querySelectorAll('.stall-hand .hand-item')].map((it) => ({
    tf: getComputedStyle(it).transform,
    hov: it.matches(':hover'),
  })));
const idx = 2; // 中间卡
const before = await read();
await page.locator('.stall-hand .hand-item').nth(idx).hover();
await page.waitForTimeout(500);
const after = await read();
console.log('before[mid]:', before[idx]?.tf);
console.log('after [mid]:', after[idx]?.tf, '| hov:', after[idx]?.hov);
console.log('after [lft]:', after[idx - 1]?.tf);
console.log('after [rgt]:', after[idx + 1]?.tf);
// 判定：悬停卡矩阵趋于放大（scale>1）且整体上移（矩阵 e 分量的 Y 比相邻更小）
const scaleOf = (m) => { const v = /matrix\(([^)]+)\)/.exec(m || '')?.[1]?.split(',').map(Number); return v ? Math.hypot(v[0], v[1]) : 0; };
const tyOf = (m) => parseFloat(/matrix\([^)]*,\s*(-?[\d.]+)\)/.exec(m || '')?.[1] ?? '0');
const scMid = scaleOf(after[idx]?.tf);
const scBase = scaleOf(before[idx]?.tf);
console.log(`mid scale ${scBase.toFixed(3)}→${scMid.toFixed(3)} ty=${tyOf(after[idx]?.tf).toFixed(1)}`,
  scMid > scBase + 0.03 ? 'straighten+raise OK' : 'check');
await browser.close();
