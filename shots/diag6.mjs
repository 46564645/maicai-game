// diag6.mjs — 预热后稳态帧耗 + invalidate 频率 + 点击延迟实测
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.goto('http://localhost:4173/?seed=1&fast=1&board=3d');
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'visible' });
console.log('entered, warming 40s...');
await page.waitForTimeout(40000);

// 稳态：10 个 rAF 间隔
const gaps = await page.evaluate(
  () =>
    new Promise((res) => {
      const out = [];
      let prev = 0;
      let n = 0;
      const loop = (t) => {
        if (prev) out.push(Math.round(t - prev));
        prev = t;
        if (++n < 10) requestAnimationFrame(loop);
        else res(out);
      };
      requestAnimationFrame(loop);
    }),
);
console.log('rAF gaps ms:', JSON.stringify(gaps));

// 普通 playwright 点击要多久
const t0 = Date.now();
try {
  await page.locator('[data-testid="action-primary"]').first().click({ timeout: 30000 });
  console.log('pw click took', Date.now() - t0, 'ms');
} catch (e) {
  console.log('pw click failed after', Date.now() - t0, 'ms:', String(e).split('\n')[0]);
}
await browser.close();
