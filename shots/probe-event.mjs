import { chromium } from '@playwright/test';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(3000);
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(700);
}
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-lap-1"]').dispatchEvent('click');
await page.locator('[data-testid="demo-station-5"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
// waitPanel 式轮询：无弹窗时点「进入这一站」
const t0 = Date.now();
while (Date.now() - t0 < 60_000) {
  if ((await page.locator('[data-testid="panel-event"]').count()) > 0) break;
  if ((await page.locator('.popup').count()) === 0) {
    await page.locator('.board-enter, [data-testid="action-primary"]').first().dispatchEvent('click').catch(() => {});
  }
  await page.waitForTimeout(300);
}
await page.waitForTimeout(1500);
await page.locator('.deck-top').click().catch(() => {});
await page.locator('.event-story').waitFor({ timeout: 8_000 }).catch(() => null);
await page.waitForTimeout(800);
const m = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[data-primary="true"]')].filter((e) => e.getClientRects().length > 0);
  return els.map((e) => {
    const r = e.getBoundingClientRect();
    return { testid: e.getAttribute('data-testid'), text: (e.textContent || '').trim().slice(0, 40), cw: e.clientWidth, ch: e.clientHeight, sw: e.scrollWidth, sh: e.scrollHeight, w: Math.round(r.width), h: Math.round(r.height) };
  });
});
console.log(JSON.stringify(m, null, 1));
await browser.close();
