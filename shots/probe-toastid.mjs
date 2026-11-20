/** probe-toastid.mjs — 定位截图里右上角「Tag bought Sticker」药丸到底是哪个元素 */
import { chromium } from '@playwright/test';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
await page.goto(`${BASE}/?board=3d&seed=2&fast=1&demo=1`);
await page.addStyleTag({ content: SAFE_CSS });
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(3000);
const t0 = Date.now();
let found = 0;
while (Date.now() - t0 < 90000 && found < 3) {
  const hits = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const t = (el.textContent || '').trim();
      if (/bought/.test(t) && t.length < 60 && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        out.push({ tag: el.tagName, cls: el.className, text: t, rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }, pos: cs.position, z: cs.zIndex, parent: el.parentElement?.className });
      }
    }
    return out;
  });
  if (hits.length) {
    found++;
    console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(hits, null, 1));
    await page.waitForTimeout(600);
  } else {
    // 推进游戏：点主按钮/卡
    const b = page.locator('[data-testid="action-primary"]').first();
    if (await b.count()) await b.click().catch(() => {});
    await page.waitForTimeout(250);
  }
}
await browser.close();
console.log('done, samples:', found);
