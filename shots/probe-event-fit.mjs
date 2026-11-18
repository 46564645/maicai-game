/** Measure event spend-card fit at phone-land 874x402 with SAFE insets.
 * Plays naturally (seed=1) until the event panel opens, reveals the story,
 * then reports every [data-primary] button's scroll vs client size. */
import { chromium } from '@playwright/test';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.goto(`${BASE}/?seed=1&fast=1`);
await page.addStyleTag({ content: SAFE_CSS });
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(2000);

// step driver (mirrors tests/e2e/helpers.ts stepOnce)
async function stepOnce() {
  const primary = page.locator('[data-testid="action-primary"]:not([disabled])');
  if ((await primary.count()) > 0) { await primary.first().tap().catch(() => {}); return 'primary'; }
  const keyed = page.locator('[data-key]:not([disabled])');
  const n = await keyed.count();
  if (n > 0) {
    let best = null, bestKey = -1;
    for (let i = 0; i < n; i++) {
      const el = keyed.nth(i);
      if ((await el.evaluate((e) => e.getClientRects().length > 0)) === false) continue;
      const k = Number(await el.getAttribute('data-key'));
      if (k > bestKey) { bestKey = k; best = el; }
    }
    if (best) { await best.tap().catch(() => {}); return 'keyed'; }
  }
  await page.waitForTimeout(200);
  return 'wait';
}

let found = false;
for (let i = 0; i < 900; i++) {
  if ((await page.locator('[data-testid="panel-event"]').count()) > 0) { found = true; break; }
  await stepOnce();
}
console.log('panel-event found:', found);
if (found) {
  // reveal: deck-top via dispatchEvent (bob animation defeats stability waits)
  await page.locator('.deck-top').dispatchEvent('click').catch((e) => console.log('deck click fail', String(e).slice(0, 80)));
  await page.locator('.event-story').waitFor({ timeout: 10_000 }).catch(() => console.log('no .event-story'));
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const out = { echo: !!document.querySelector('[data-testid="event-echo"]') };
    out.primaries = [...document.querySelectorAll('[data-primary="true"]')]
      .filter((e) => e.getClientRects().length > 0)
      .map((e) => ({ testid: e.getAttribute('data-testid'), text: (e.textContent || '').trim().slice(0, 30), cw: e.clientWidth, ch: e.clientHeight, sw: e.scrollWidth, sh: e.scrollHeight }));
    out.eventCards = [...document.querySelectorAll('.event-hand .card-view')]
      .map((e) => ({ ch: e.clientHeight, sh: e.scrollHeight }));
    return out;
  });
  console.log(JSON.stringify(m, null, 1));
}
await browser.close();
