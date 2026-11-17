/**
 * r6-cap.mjs — R6 top-up captures: board noui + phone board (CDP shots),
 * merging rects into shots/ui_rects_all.json under an existing tag.
 * Usage: node shots/r6-cap.mjs <tag>
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] ?? 'r6before';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const PANEL_SELECTORS = [
  '.game-topbar', '.bot-card', '.lap-card', '.game-bottom', '.board3d-overlay',
  '.board3d-status', '.popup', '.phone-rail', '.phone-turn', '.phone-bots',
  '.phone-quick', '.toast-stack', '.speech-bubble', '.lang-toggle',
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
          out.panels.push({ sel, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
        }
      }
    }
    const primary = document.querySelector('[data-testid="action-primary"]');
    if (primary) {
      const r = primary.getBoundingClientRect();
      out.primary = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }
    const toggle = document.querySelector('[data-testid="lang-toggle"]');
    if (toggle) {
      const r = toggle.getBoundingClientRect();
      out.langToggle = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }
    return out;
  }, PANEL_SELECTORS);
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
  console.log(`  ${name}`);
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

async function capBoard(browser, phone, { withUi = true } = {}) {
  const vp = phone ? 'phone' : 'desktop';
  const name = `board_${vp}`;
  const ctx = await browser.newContext(
    phone
      ? { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }
      : { viewport: { width: 1280, height: 800 } },
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await enterGame(page);
  await enterChar(page);
  if (!(await ensure3d(page))) console.log(`  WARN ${name}: 3D fell back to 2D`);
  await page.keyboard.press('d');
  await page.locator('.board3d-reset').click().catch(() => null);
  await page.waitForTimeout(4500);
  const rects = await dumpRects(page);
  if (withUi) await shot(page, `ui_${name}_${TAG}.png`);
  await page.addStyleTag({ content: `${PANEL_SELECTORS.join(',')}{visibility:hidden !important}` });
  await page.waitForTimeout(600);
  await shot(page, `ui_${name}_${TAG}_noui.png`);
  await ctx.close();
  return rects;
}

const browser = await chromium.launch({ args: GL_ARGS });
const rects = {};
try {
  console.log('== board_desktop (noui top-up) ==');
  rects.board_desktop = await capBoard(browser, false, { withUi: false });
  console.log('== board_phone ==');
  rects.board_phone = await capBoard(browser, true);
} finally {
  await browser.close();
}
const allPath = path.join(OUT, 'ui_rects_all.json');
const prev = fs.existsSync(allPath) ? JSON.parse(fs.readFileSync(allPath, 'utf8')) : {};
prev[TAG] = { ...(prev[TAG] ?? {}), ...rects };
fs.writeFileSync(allPath, JSON.stringify(prev, null, 2));
console.log(`rects merged under tag "${TAG}"`);
