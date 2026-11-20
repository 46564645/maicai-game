// diag3.mjs — 追踪 board3d/board2d/primary 在 8s 内的存在与可见性振荡
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
await page.goto('http://localhost:4173/?seed=1&fast=1&board=3d');
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'visible' });
console.log('entered game');

for (let i = 0; i < 40; i++) {
  const s = await page.evaluate(() => {
    const b3 = document.querySelector('.board3d');
    const b2 = document.querySelector('.board');
    const ov = document.querySelector('.board3d-overlay');
    const prims = [...document.querySelectorAll('[data-testid="action-primary"]')].map(
      (el) => {
        const r = el.getBoundingClientRect();
        return `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.x)},${Math.round(r.y)}`;
      },
    );
    const hidden = (el) => {
      if (!el) return '-';
      let n = el;
      while (n && n !== document.body) {
        if (getComputedStyle(n).display === 'none') return `hidden@${n.className.slice(0, 30)}`;
        n = n.parentElement;
      }
      return 'shown';
    };
    return {
      b3: b3 ? hidden(b3) : 'none',
      b2: b2 ? 'present' : 'none',
      ov: ov ? hidden(ov) : 'none',
      canvas: document.querySelectorAll('canvas').length,
      prims,
    };
  });
  console.log(i, JSON.stringify(s));
  await page.waitForTimeout(200);
}
await browser.close();
