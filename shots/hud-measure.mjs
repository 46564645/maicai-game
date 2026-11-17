import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.goto('http://localhost:4188/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'domcontentloaded' });
await page.locator('[data-primary="true"]').waitFor();
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(2500);
const out = await page.evaluate(() => {
  const bar = document.querySelector('.game-bottom');
  if (!bar) return { err: 'no bar' };
  const br = bar.getBoundingClientRect();
  const kids = [...bar.children].map((el) => {
    const r = el.getBoundingClientRect();
    return { cls: el.className.split(' ')[0], w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
  });
  const cs = getComputedStyle(bar);
  return {
    barW: br.width, barH: br.height, gap: cs.gap, padL: cs.paddingLeft, padR: cs.paddingRight,
    scrollW: bar.scrollWidth, kids,
    totalKids: kids.reduce((a, k) => a + k.w, 0),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
