import { chromium } from '@playwright/test';
const GL_ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.text().startsWith('PD:')) console.log(m.text()); });
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1');
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(2500);
// wait drawTask panel
const t0 = Date.now();
while (Date.now() - t0 < 60_000) {
  if ((await page.locator('[data-testid="panel-drawTask"]').count()) > 0) break;
  const hasPopup = (await page.locator('.popup').count()) > 0;
  if (!hasPopup) {
    const e = page.locator('.board-enter, [data-testid="action-primary"]').first();
    if ((await e.count()) > 0) await e.dispatchEvent('click').catch(() => {});
  }
  await page.waitForTimeout(300);
}
await page.locator('.deck').waitFor({ timeout: 15_000 });
await page.locator('.deck-top').click();
for (let i = 0; i < 20; i++) {
  const st = await page.evaluate(() => {
    const popup = document.querySelector('.popup');
    const deck = document.querySelector('.deck-top');
    const ok = popup?.querySelector('[data-testid="action-primary"]');
    return {
      deck: !!deck,
      flipping: !!document.querySelector('.deck--flipping'),
      okText: ok?.textContent?.slice(0, 30),
      popupHtml: popup?.textContent?.slice(0, 60),
    };
  });
  console.log(i * 200 + 'ms', JSON.stringify(st));
  await page.waitForTimeout(200);
}
await browser.close();
