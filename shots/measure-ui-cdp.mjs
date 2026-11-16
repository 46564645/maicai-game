/**
 * measure-ui.mjs — UI A/B iteration harness (see ~/workspace/custom-skills/ui-ab-iteration).
 * Usage: node shots/measure-ui.mjs <tag> [only-substring]
 * Captures, for board/market/spinner × desktop/phone:
 *   ui_<screen>_<viewport>_<tag>.png        settled screenshot
 *   ui_board_<viewport>_<tag>_noui.png      board with all DOM panels visibility:hidden
 *                                           (island segmentation reference)
 * and writes panel rects to shots/ui_rects_<tag>.json.
 * Expects the preview server on http://localhost:4173 serving the current build.
 * Navigation flows mirror shots/shoot-final.mjs.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] ?? 'before';
const ONLY = process.argv[3] ?? '';
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

const PANEL_SELECTORS = [
  '.game-topbar',
  '.bot-card',
  '.lap-card',
  '.game-bottom',
  '.board3d-overlay',
  '.board3d-status',
  '.popup',
  '.phone-rail',
  '.phone-turn',
  '.phone-bots',
  '.phone-quick',
  '.toast-stack',
  '.speech-bubble',
];

async function dumpRects(page) {
  return page.evaluate((selectors) => {
    const out = { viewport: { w: window.innerWidth, h: window.innerHeight }, panels: [] };
    const canvas = document.querySelector('.board3d');
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      out.canvas = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none') {
          out.panels.push({
            sel,
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
      }
    }
    const primary = document.querySelector('[data-testid="action-primary"]');
    if (primary) {
      const r = primary.getBoundingClientRect();
      out.primary = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }
    return out;
  }, PANEL_SELECTORS);
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  const cdp = await page.context().newCDPSession(page);
  const t0 = Date.now();
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
  console.log(`  ${name} (cdp ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

async function enterGame(page) {
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click();
}

async function enterChar(page) {
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 20_000 }).catch(() => null);
}

// The desktop 3D mount can time out under SwiftShader (lazy chunk + shader
// compile racing the first-frame watchdog) and fall back to Board2D.
// Detect it and retry once on a warm reload so a 2D shot never lands in the
// measurement set.
async function ensure3d(page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await page.reload();
      await enterGame(page);
      await enterChar(page);
    }
    if ((await page.locator('[data-testid="board3d"] canvas').count()) > 0) return true;
  }
  return false;
}

async function jumpStation(page, station, panelTestid, timeout = 40_000) {
  await page.keyboard.press('d');
  await page.locator(`[data-testid="demo-station-${station}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  const panel = page.locator(`[data-testid="${panelTestid}"]`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await panel.count()) > 0) return;
    const enter = page.locator('[data-testid="action-primary"]').first();
    const hasPopup = (await page.locator('.popup').count()) > 0;
    if (!hasPopup && (await enter.count()) > 0) await enter.click();
    await page.waitForTimeout(300);
  }
  throw new Error(`jumpStation ${station}: timed out waiting for ${panelTestid}`);
}

async function newPage(browser, phone) {
  const ctx = await browser.newContext(
    phone
      ? { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }
      : { viewport: { width: 1280, height: 800 } },
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  return { ctx, page };
}

const rects = {};

async function capBoard(browser, phone) {
  const vp = phone ? 'phone' : 'desktop';
  const name = `board_${vp}`;
  const { ctx, page } = await newPage(browser, phone);
  await enterGame(page);
  await enterChar(page);
  if (!(await ensure3d(page))) console.log(`  WARN ${name}: 3D fell back to 2D after retry`);
  await page.keyboard.press('d');
  // R5 protocol: pin the camera at the design default framing (post-resetKey),
  // then a fixed 4.5s settle. The follow target lerps back to base while the
  // position is already home, so the shot is the default view regardless of
  // which station was active on entry.
  await page.locator('.board3d-reset').click().catch(() => null);
  // NOTE: keep this at 4500ms — the baseline matrix was captured with it.
  // The camera follow-lerp is frame-based, so the wait defines the camera
  // state in the shot (at 20s the follow has converged to the station-0
  // mix and the island sits panned down-right — a different, also-valid
  // state). Same wait = comparable shots; verified across before/r1/r1b.
  await page.waitForTimeout(4500);
  rects[name] = await dumpRects(page);
  await shot(page, `ui_${name}_${TAG}.png`);
  // island reference: hide every DOM panel, keep the canvas exactly as-is
  await page.addStyleTag({
    content: `${PANEL_SELECTORS.join(',')}{visibility:hidden !important}`,
  });
  await page.waitForTimeout(600);
  await shot(page, `ui_${name}_${TAG}_noui.png`);
  await ctx.close();
}

async function capMarket(browser, phone) {
  const vp = phone ? 'phone' : 'desktop';
  const name = `market_${vp}`;
  const { ctx, page } = await newPage(browser, phone);
  await enterGame(page);
  await enterChar(page);
  if (!(await ensure3d(page))) console.log(`  WARN ${name}: 3D fell back to 2D after retry`);
  await page.keyboard.press('d');
  await page.waitForTimeout(3000);
  await jumpStation(page, 2, 'panel-market');
  await page.waitForTimeout(1200);
  rects[name] = await dumpRects(page);
  await shot(page, `ui_${name}_${TAG}.png`);
  await ctx.close();
}

async function capSpinner(browser, phone) {
  const vp = phone ? 'phone' : 'desktop';
  const name = `spinner_${vp}`;
  const { ctx, page } = await newPage(browser, phone);
  await enterGame(page);
  await enterChar(page);
  if (!(await ensure3d(page))) console.log(`  WARN ${name}: 3D fell back to 2D after retry`);
  await page.keyboard.press('d');
  await page.waitForTimeout(3000);
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-5"]').dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  const enter = page.locator('[data-testid="action-primary"]').first();
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    if ((await enter.count()) > 0) {
      await enter.click();
      break;
    }
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(900);
  rects[name] = await dumpRects(page);
  await shot(page, `ui_${name}_${TAG}.png`);
  await page.waitForTimeout(1500);
  await shot(page, `ui_${name}_${TAG}_done.png`);
  await ctx.close();
}

const browser = await chromium.launch({ args: GL_ARGS });
try {
  const jobs = [
    ['board_desktop', () => capBoard(browser, false)],
    ['board_phone', () => capBoard(browser, true)],
    ['market_desktop', () => capMarket(browser, false)],
    ['market_phone', () => capMarket(browser, true)],
    ['spinner_desktop', () => capSpinner(browser, false)],
    ['spinner_phone', () => capSpinner(browser, true)],
  ];
  for (const [name, fn] of jobs) {
    if (ONLY && !name.includes(ONLY)) continue;
    console.log(`== ${name} ==`);
    await fn();
  }
} finally {
  await browser.close();
}
const prev = fs.existsSync(path.join(OUT, 'ui_rects_all.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT, 'ui_rects_all.json'), 'utf8'))
  : {};
fs.writeFileSync(path.join(OUT, 'ui_rects_all.json'), JSON.stringify({ ...prev, [TAG]: rects }, null, 2));
console.log(`rects saved under tag "${TAG}"`);
