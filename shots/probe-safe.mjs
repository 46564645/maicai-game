/** Probe: measure phone-land market rail buttons at 874x402 with SAFE insets.
 * Usage: BASE=http://localhost:4173 node /tmp/probe-safe.mjs [label]
 * Replicates safearea.spec.ts conditions (seed=1, fast=1, SAFE 20/62/20/62)
 * but jumps straight to the market panel via the demo bar. */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const LABEL = process.argv[2] ?? 'probe';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.addStyleTag({ content: SAFE_CSS }); // 必须在 goto 之后：导航会丢掉之前注入的 <style>
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(3000);

// jump to market (station 2), lap 1
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(700);
}
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-lap-1"]').dispatchEvent('click');
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 15_000 });
await page.waitForTimeout(1500); // let entrance + scroll-to-bottom settle

const m = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { t: Math.round(r.top * 10) / 10, b: Math.round(r.bottom * 10) / 10, l: Math.round(r.left * 10) / 10, r: Math.round(r.right * 10) / 10, h: Math.round(r.height * 10) / 10 };
  };
  const rail = document.querySelector('.phone-rail');
  const popup = document.querySelector('.phone-rail .popup');
  return {
    rail: rail ? { scrollTop: rail.scrollTop, scrollHeight: rail.scrollHeight, clientHeight: rail.clientHeight, box: box(rail) } : null,
    popup: popup ? box(popup) : null,
    railButtons: q('.phone-rail [data-key]').filter((e) => e.getClientRects().length > 0).map((e) => ({
      key: e.getAttribute('data-key'), testid: e.getAttribute('data-testid'), text: (e.textContent || '').trim().slice(0, 18), ...box(e),
    })),
    headerBits: q('.phone-rail .popup [class*="goal"], .phone-rail .popup [class*="recipe"], .phone-rail .popup [class*="strip"], .phone-rail .popup [class*="head"]').slice(0, 12).map((e) => ({
      cls: e.className.toString().slice(0, 60), ...box(e),
    })),
    railChildren: [...rail.children].map((el) => {
      const cs = getComputedStyle(el);
      return { cls: el.className.toString().slice(0, 40), testid: el.getAttribute('data-testid'), ...box(el), mb: cs.marginBottom, pb: cs.paddingBottom };
    }),
  };
});
console.log(`=== ${LABEL} (${BASE}) ===`);
console.log(JSON.stringify(m, null, 1));
await browser.close();
