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
await page.waitForTimeout(800);
const info = await page.locator('.phone-turn [data-testid="action-primary"]').evaluate((el) => {
  const cs = getComputedStyle(el);
  const kids = [...el.children].map((k) => ({
    tag: k.tagName, cls: k.className,
    h: k.getBoundingClientRect().height, w: k.getBoundingClientRect().width,
    ws: getComputedStyle(k).whiteSpace, lh: getComputedStyle(k).lineHeight,
    fs: getComputedStyle(k).fontSize, disp: getComputedStyle(k).display,
  }));
  return {
    html: el.innerHTML, text: el.textContent,
    cw: el.clientWidth, ch: el.clientHeight, sw: el.scrollWidth, sh: el.scrollHeight,
    ws: cs.whiteSpace, fs: cs.fontSize, lh: cs.lineHeight, pad: cs.padding,
    minH: cs.minHeight, kids,
  };
});
console.log(JSON.stringify(info, null, 1));
await ctx.close(); await browser.close();
