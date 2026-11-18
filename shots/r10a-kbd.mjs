/** r10a-kbd.mjs — 键盘全程一次购买：ArrowRight 焦点选卡 → 数字键 1 买 */
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
const coinsLabel = async () =>
  page.evaluate(() => document.querySelector('.coin-counter + .cc-live, .cc-live')?.textContent ??
    document.querySelector('.coins')?.getAttribute('aria-label'));
const before = await coinsLabel();
// 纯键盘：→ 焦点落到摊卡（focus=选中）→ 按 1 = 篮子区买下
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(250);
const focused = await page.evaluate(() => ({
  testid: document.activeElement?.getAttribute('data-testid'),
  cls: document.activeElement?.className?.slice(0, 40),
}));
console.log('focused:', JSON.stringify(focused));
await page.keyboard.press('1');
await page.waitForTimeout(800);
const after = await coinsLabel();
console.log(`keyboard-only buy: ${before} → ${after}`, before !== after ? 'OK' : 'FAIL');
await browser.close();
