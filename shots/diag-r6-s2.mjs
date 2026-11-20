import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30_000 });
await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(() => {});
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(2000);
for (let i = 0; i < 6; i++) { if ((await page.locator('.popup').count()) === 0) break; await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {}); await page.waitForTimeout(600); }
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) { await page.keyboard.press('d'); await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 }); }
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
await page.waitForTimeout(800);
const chain = await page.evaluate(() => {
  const out = [];
  let el = document.querySelector('.panel-selected');
  while (el && out.length < 7) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.push(`${el.tagName}.${el.className.split(' ').join('.')} w=${Math.round(r.width)} display=${cs.display} align-items=${cs.alignItems} align-self=${cs.alignSelf}`);
    el = el.parentElement;
  }
  return out;
});
console.log(chain.join('\n'));
await browser.close();
