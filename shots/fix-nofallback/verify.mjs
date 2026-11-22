/**
 * verify.mjs — fix/no-2d-fallback verification (2026-11-21).
 * Usage:
 *   node shots/fix-nofallback/verify.mjs 3d    <baseUrl>  -> board must render 3D
 *   node shots/fix-nofallback/verify.mjs block <baseUrl>  -> WebGL blocked: error card, no 2D
 *   node shots/fix-nofallback/verify.mjs sizes <baseUrl>  -> five-size button spot check
 * Screenshots land next to this script.
 */
import { chromium } from '@playwright/test';

const MODE = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:8932/';
const OUT = 'shots/fix-nofallback';
const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const BLOCK = ['--no-sandbox', '--disable-webgl', '--disable-webgl2'];

async function enterGame(page) {
  await page.locator('[data-testid="action-primary"]').click({ timeout: 90_000 });
  await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 30_000 });
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 30_000 });
}

async function boardState(page) {
  return page.evaluate(() => {
    const c = document.querySelector('.board3d-canvas canvas');
    const retry = document.querySelector('.board-retry');
    const vis = (el) => !!el && el.getBoundingClientRect().height > 0;
    return {
      canvas3d: !!c,
      canvasBuf: c ? `${c.width}x${c.height}` : null,
      board2d: !!document.querySelector('section.board'),
      errorCard: vis(document.querySelector('.board-error')),
      retryH: retry ? retry.getBoundingClientRect().height : null,
    };
  }).catch(() => null);
}

if (MODE === '3d' || MODE === 'block') {
  const browser = await chromium.launch({ args: MODE === 'block' ? BLOCK : GL });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() !== 'log') logs.push(`console.${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 200)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const gl = await page.evaluate(() => {
    const out = {};
    for (const k of ['webgl2', 'webgl']) {
      try { out[k] = !!document.createElement('canvas').getContext(k); } catch { out[k] = false; }
    }
    return out;
  });
  console.log('GL_AVAILABLE', JSON.stringify(gl));
  await enterGame(page);
  let last = null;
  for (let i = 0; i < 45; i++) {
    last = await boardState(page);
    if (last && (last.canvas3d || last.errorCard)) break;
    await page.waitForTimeout(1000);
  }
  console.log('STATE', JSON.stringify(last));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${MODE === '3d' ? 'board-3d' : 'webgl-blocked-error'}.png`, timeout: 150_000 }).catch((e) => console.log('SHOT-FAIL', String(e).slice(0, 120)));
  console.log('LOGS', JSON.stringify(logs.slice(0, 12)));
  await browser.close();
} else if (MODE === 'sizes') {
  const SIZES = [[667, 375], [874, 402], [1024, 768], [1280, 800], [1440, 900]];
  const browser = await chromium.launch({ args: GL });
  for (const [w, h] of SIZES) {
    const phone = w <= 874;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(phone ? { hasTouch: true, isMobile: true } : {}) });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await enterGame(page);
      let st = null;
      for (let i = 0; i < 30; i++) {
        st = await boardState(page);
        if (st && (st.canvas3d || st.errorCard)) break;
        await page.waitForTimeout(1000);
      }
      const btns = await page.evaluate(() => {
        const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
        const hs = [...document.querySelectorAll('button')].filter(vis).map((b) => Math.round(b.getBoundingClientRect().height));
        return { count: hs.length, min: hs.length ? Math.min(...hs) : null, under48: hs.filter((x) => x < 48).length };
      });
      console.log(`SIZE ${w}x${h}`, JSON.stringify({ state: st && (st.canvas3d ? '3d' : st.errorCard ? 'error-card' : 'unknown'), board2d: st?.board2d ?? null, buttons: btns }));
      await page.screenshot({ path: `${OUT}/size-${w}.png`, timeout: 60_000 }).catch(() => {});
    } catch (e) {
      console.log(`SIZE ${w}x${h}`, 'FLOW-ERROR', String(e).slice(0, 160));
    }
    await ctx.close();
  }
  await browser.close();
}
