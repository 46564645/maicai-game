// quick check: reflection finished page on desktop + portrait
import { chromium } from '@playwright/test';
const GL_ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const BASE = 'http://localhost:4173';
async function stepOnce(page) {
  const primary = page.locator('[data-testid="action-primary"]:not([disabled])').first();
  if ((await primary.count()) > 0) { await primary.click(); return; }
  const handle = await page.evaluateHandle(() => {
    const els = [...document.querySelectorAll('[data-key]:not([disabled])')].filter((el) => el.getClientRects().length > 0);
    if (!els.length) return null;
    return els.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
  });
  const el = handle.asElement();
  if (el) { await el.click(); return; }
  await page.waitForTimeout(200);
}
const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
for (const [name, vp] of [['desktop', {width:1280,height:800}], ['portrait', {width:390,height:844,isMobile:true,hasTouch:true}]]) {
  const ctx = await browser.newContext({ viewport: {width:vp.width,height:vp.height}, hasTouch: !!vp.hasTouch, isMobile: !!vp.isMobile });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?board=2d&seed=1&fast=1`);
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  for (let i = 0; i < 900; i++) {
    if ((await page.getByTestId('action-replay').count()) > 0) break;
    if ((await page.locator('.reflection-options').count()) > 0) {
      const opt = page.locator('.reflection-options [data-testid="action-primary"]:not([disabled])').first();
      if ((await opt.count()) > 0) await opt.click();
      continue;
    }
    await stepOnce(page);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `docs/screenshots/dbg_reflect_${name}.png` });
  console.log(name, 'cards:', await page.locator('.reflection-card').count(), 'replay:', await page.getByTestId('action-replay').count());
  await ctx.close();
}
await browser.close();
console.log('done');
