import { chromium } from '@playwright/test';
const GL_ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
const ctx = await browser.newContext({ viewport:{width:874,height:402}, hasTouch:true, isMobile:true });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=2d&seed=1&fast=1&demo=1');
await page.locator('[data-primary="true"]').waitFor();
await page.locator('[data-testid="action-primary"]').click();
await page.keyboard.press('d');
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(1500);
await page.addStyleTag({content: SAFE_CSS});

async function jumpStation(station, panelTestid, timeout=30000){
  await page.keyboard.press('d');
  await page.locator(`[data-testid="demo-station-${station}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  const panel = page.locator(`[data-testid="${panelTestid}"]`);
  const t0 = Date.now();
  while (Date.now()-t0 < timeout){
    if (await panel.count()) return;
    const enter = page.locator('[data-testid="action-primary"]').first();
    if ((await page.locator('.popup').count())===0 && (await enter.count())>0) await enter.click();
    await page.waitForTimeout(300);
  }
  throw new Error('no panel '+panelTestid);
}

await jumpStation(7,'panel-store');
await page.waitForTimeout(800);
const card = page.locator('.phone-rail [data-testid^="action-store-"]:not([disabled])').first();
if ((await card.count()) > 0) { await card.dispatchEvent('click'); await page.waitForTimeout(400); }
await page.screenshot({ path: '/tmp/dbg_store9b.png' });
// dump rendered name texts incl breaks
const names = await page.evaluate(() => [...document.querySelectorAll('.phone-rail .card-view-name')].map(e => {
  const r = e.getBoundingClientRect();
  return {t: e.textContent, h: Math.round(r.height), sw: e.scrollWidth, cw: e.clientWidth};
}));
console.log(JSON.stringify(names));
await ctx.close(); await browser.close();
