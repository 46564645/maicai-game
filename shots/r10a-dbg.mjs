import { chromium } from '@playwright/test';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/?board=3d&seed=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(4000);
const m = await page.evaluate(() => {
  const ovs = [...document.querySelectorAll('.board3d-overlay')];
  return {
    nOverlays: ovs.length,
    overlay: ovs.map((o) => {
      const r = o.getBoundingClientRect();
      const cs = getComputedStyle(o);
      return { rect: r.toJSON(), pos: cs.position, bottom: cs.bottom, top: cs.top, display: cs.display, inDoc: document.contains(o) };
    }),
    area: document.querySelector('.game-board-area')?.getBoundingClientRect().toJSON(),
    layout: document.querySelector('.game-layout')?.getBoundingClientRect().toJSON(),
    bottom: document.querySelector('.game-bottom')?.getBoundingClientRect().toJSON(),
    screen: document.querySelector('.game-screen')?.getBoundingClientRect().toJSON(),
    canvasCount: document.querySelectorAll('canvas').length,
  };
});
console.log(JSON.stringify(m, null, 1));
await browser.close();
