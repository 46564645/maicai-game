/**
 * r8-capture.mjs — R8 responsive-round harness.
 * Usage: node shots/r8-capture.mjs <tag> [name-substring-filter]
 * Captures the settled board view (R5 protocol: fresh load, reset-click,
 * 4.5s settle) at every acceptance viewport, via CDP screenshots
 * (page.screenshot hangs on SwiftShader WebGL — see ART_R5.md §5).
 * Writes:
 *   shots/r8_<name>_<tag>.png / _noui.png
 *   shots/r8_rects_<tag>.json  (incremental, per viewport)
 * Expects the preview server on BASE (default http://localhost:4188).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4188';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] ?? 'r8base';
const ONLY = process.argv[3] ?? '';
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

export const VIEWPORTS = [
  { name: 'phone-844x390', w: 844, h: 390, phone: true },
  { name: 'phone-874x402', w: 874, h: 402, phone: true },
  { name: 'phone-915x412', w: 915, h: 412, phone: true },
  { name: 'phone-740x360', w: 740, h: 360, phone: true },
  { name: 'desktop-1024x768', w: 1024, h: 768, phone: false },
  { name: 'desktop-1280x800', w: 1280, h: 800, phone: false },
  { name: 'desktop-1440x900', w: 1440, h: 900, phone: false },
  { name: 'desktop-1600x1000', w: 1600, h: 1000, phone: false },
  { name: 'desktop-1920x1080', w: 1920, h: 1080, phone: false },
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
  '.lang-toggle',
];

async function dumpRects(page) {
  return page.evaluate((selectors) => {
    const R = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const vis = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const out = { viewport: { w: window.innerWidth, h: window.innerHeight }, panels: [] };
    out.canvas = R(document.querySelector('.board3d'));
    out.screen = R(document.querySelector('.game-screen'));
    out.layout = R(document.querySelector('.game-layout'));
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (vis(el)) out.panels.push({ sel, ...R(el) });
      }
    }
    const primary = document.querySelector('[data-testid="action-primary"]');
    if (primary && vis(primary)) out.primary = R(primary);
    // every visible button (touch-target audit)
    out.buttons = [];
    for (const b of document.querySelectorAll('button')) {
      if (!vis(b)) continue;
      const r = R(b);
      out.buttons.push({
        id: b.getAttribute('data-testid') || b.className.split(' ')[0] || b.tagName,
        ...r,
      });
    }
    // structural free rect (same definition the runtime fit uses)
    const q = (s) => document.querySelector(s);
    const rail = q('.phone-rail');
    if (rail && vis(rail)) {
      const bots = q('.phone-bots');
      const quick = q('.phone-quick');
      const br = R(rail), bo = R(bots), qu = R(quick);
      out.free = {
        x: bo ? Math.max(0, bo.x - 8) : 0,
        y: bo ? bo.y + bo.h : 0,
        w: br.x - (bo ? Math.max(0, bo.x - 8) : 0),
        h: (qu ? qu.y : window.innerHeight) - (bo ? bo.y + bo.h : 0),
      };
      out.phoneBotsRight = bo ? bo.x + bo.w : null;
      out.railLeft = br.x;
    } else {
      const gl = q('.game-left'), gr = q('.game-right');
      const tb = q('.game-topbar'), ov = q('.board3d-overlay'), gb = q('.game-bottom');
      const glr = R(gl), grr = R(gr), tbr = R(tb), ovr = R(ov), gbr = R(gb);
      const left = glr ? glr.x + glr.w : 0;
      const right = grr ? grr.x : window.innerWidth;
      const top = tbr ? tbr.y + tbr.h : 0;
      const bottom = ovr ? ovr.y : gbr ? gbr.y : window.innerHeight;
      out.free = { x: left, y: top, w: right - left, h: bottom - top };
      const actions = q('.game-topbar-actions');
      const ar = R(actions);
      out.topbarActionsRight = ar ? ar.x + ar.w : null;
      out.topbarRight = tbr ? tbr.x + tbr.w : null;
    }
    const ov = q('.board3d-overlay');
    if (ov) {
      const cs = getComputedStyle(ov);
      out.overlayStyle = { position: cs.position, flexDirection: cs.flexDirection, flexWrap: cs.flexWrap };
    }
    out.docOverflowX = document.documentElement.scrollWidth - window.innerWidth;
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

const rectsFile = path.join(OUT, `r8_rects_${TAG}.json`);
const rects = fs.existsSync(rectsFile) ? JSON.parse(fs.readFileSync(rectsFile, 'utf8')) : {};

async function capBoard(browser, vp, lang) {
  const name = vp.name + (lang === 'zh' ? '-zh' : '');
  const ctx = await browser.newContext(
    vp.phone
      ? { viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true }
      : { viewport: { width: vp.w, height: vp.h } },
  );
  if (lang === 'zh') {
    await ctx.addInitScript(() => {
      try { localStorage.setItem('maicai-lang', 'zh'); } catch { /* noop */ }
    });
  }
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await enterGame(page);
  await enterChar(page);
  if (!(await ensure3d(page))) console.log(`  WARN ${name}: 3D fell back to 2D after retry`);
  await page.keyboard.press('d');
  await page.locator('.board3d-reset').click().catch(() => null);
  // Under SwiftShader + CPU contention the lazy 3D chunk + overlay can
  // lag seconds behind the DOM chrome; wait until the board overlay is
  // actually mounted before the settle, or rects/shots race states.
  await page
    .waitForFunction(
      () => {
        const ov = document.querySelector('.board3d-overlay');
        const pr = document.querySelector('[data-testid="action-primary"]');
        const cv = document.querySelector('[data-testid="board3d"] canvas');
        return !!(ov && pr && cv && ov.getBoundingClientRect().height > 0);
      },
      { timeout: 90_000 },
    )
    .catch(() => console.log(`  WARN ${name}: overlay wait timed out`));
  // Large viewports under SwiftShader can still be mid-mount at dump
  // time (rects race: canvas 0x0 while the presented frame is fine).
  // Poll until the canvas has real size before dumping rects.
  await page
    .waitForFunction(
      () => {
        const cv = document.querySelector('.board3d');
        if (!cv) return false;
        const r = cv.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      },
      { timeout: 60_000 },
    )
    .catch(() => console.log(`  WARN ${name}: canvas wait timed out`));
  await page.waitForTimeout(4500);
  rects[name] = await dumpRects(page);
  fs.writeFileSync(rectsFile, JSON.stringify(rects, null, 2));
  await shot(page, `r8_${name}_${TAG}.png`);
  await page.addStyleTag({
    content: `${PANEL_SELECTORS.join(',')}{visibility:hidden !important}`,
  });
  await page.waitForTimeout(600);
  await shot(page, `r8_${name}_${TAG}_noui.png`);
  await ctx.close();
  console.log(`== ${name} done ==`);
}

const browser = await chromium.launch({ args: GL_ARGS });
try {
  const jobs = [];
  for (const vp of VIEWPORTS) jobs.push([vp.name, vp, 'en']);
  // ZH spot-checks: smallest phone + reference desktop
  jobs.push(['phone-740x360-zh', VIEWPORTS[3], 'zh']);
  jobs.push(['desktop-1280x800-zh', VIEWPORTS[5], 'zh']);
  for (const [name, vp, lang] of jobs) {
    if (ONLY && !name.includes(ONLY)) continue;
    console.log(`== ${name} (${lang}) ==`);
    await capBoard(browser, vp, lang);
  }
} finally {
  await browser.close();
}
console.log(`rects saved to r8_rects_${TAG}.json`);
