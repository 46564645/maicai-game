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
await page.addStyleTag({ content: SAFE_CSS });
await page.keyboard.press('d');
await page.locator('[data-testid="demo-station-6"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.waitForTimeout(1500);
const info = await page.locator('.phone-rail [data-primary="true"]').evaluate((el) => {
  const out = { btn: { text: el.textContent, cw: el.clientWidth, ch: el.clientHeight, sw: el.scrollWidth, sh: el.scrollHeight, fs: getComputedStyle(el).fontSize, lh: getComputedStyle(el).lineHeight, pad: getComputedStyle(el).padding, ws: getComputedStyle(el).whiteSpace }, chain: [] };
  let n = el.parentElement;
  while (n && out.chain.length < 8) {
    const cs = getComputedStyle(n);
    out.chain.push({ cls: n.className, w: n.getBoundingClientRect().width, h: n.getBoundingClientRect().height, disp: cs.display, sw: n.scrollWidth });
    n = n.parentElement;
  }
  return out;
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: 'docs/screenshots/dbg_parent_rail.png' });
await ctx.close(); await browser.close();
