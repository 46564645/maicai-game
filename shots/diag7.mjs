// diag7.mjs — fast 降档后：点击进入、stepOnce 走 20 步计时
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
await page.goto('http://localhost:4173/?seed=1&fast=1&board=3d');
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'visible' });
console.log('entered game');

for (let i = 0; i < 20; i++) {
  const t0 = Date.now();
  const primary = page.locator('[data-testid="action-primary"]:not([disabled])').first();
  let kind = 'wait';
  try {
    if ((await primary.count()) > 0) {
      await primary.click({ timeout: 8000 });
      kind = 'primary';
    } else {
      const k = await page.evaluateHandle(() =>
        [...document.querySelectorAll('[data-key]:not([disabled])')]
          .filter((el) => el.getClientRects().length > 0)
          .reduce((a, b) => (Number(b.dataset.key) > Number(a.dataset.key) ? b : a), null),
      );
      const el = k.asElement();
      if (el) {
        await el.click({ timeout: 8000 });
        kind = 'keyed';
      } else {
        await page.waitForTimeout(200);
      }
    }
  } catch (e) {
    console.log(`step ${i}: ${kind} FAIL ${Date.now() - t0}ms ${String(e).split('\n')[0]}`);
    break;
  }
  const st = await page.evaluate(
    () => document.querySelector('[data-testid^="panel-"]')?.getAttribute('data-testid') ?? '-',
  );
  console.log(`step ${i}: ${kind} ${Date.now() - t0}ms panel=${st}`);
}
await browser.close();
console.log('done');
