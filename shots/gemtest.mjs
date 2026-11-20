import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1');
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(2500);
// 跳到市场
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(600);
}
await page.keyboard.press('d');
await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
await page.waitForTimeout(1000);
const res = await page.evaluate(() => {
  const gem = document.querySelector('.stall-hand .card-view-gem');
  if (!gem) return 'no gem';
  const cs = getComputedStyle(gem);
  const base = { sh: gem.scrollHeight, ch: gem.clientHeight, fs: cs.fontSize, lh: cs.lineHeight, display: cs.display };
  const trials = {};
  const tryStyle = (name, styles) => {
    const saved = {};
    for (const [k, v] of Object.entries(styles)) { saved[k] = gem.style[k]; gem.style[k] = v; }
    trials[name] = { sh: gem.scrollHeight, ch: gem.clientHeight };
    for (const [k, v] of Object.entries(saved)) gem.style[k] = v;
  };
  tryStyle('lh-exact-16px', { lineHeight: '16px' });
  tryStyle('fs-15px', { fontSize: '15px' });
  tryStyle('fs-14px', { fontSize: '14px' });
  tryStyle('grid', { display: 'grid', placeItems: 'center' });
  tryStyle('padding-bottom-3', { paddingBottom: '3px' });
  return { base, trials, html: gem.outerHTML.slice(0, 120) };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
