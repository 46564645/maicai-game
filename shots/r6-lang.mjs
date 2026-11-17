/**
 * r6-lang.mjs — R6 language captures: preset localStorage `maicai-lang`
 * before page load, then CDP-shoot board (desktop+phone) and market
 * (desktop), and dump the lang-toggle rects for the ≥48px check.
 * Usage: node shots/r6-lang.mjs <lang: en|zh> <tag>
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const LANG = process.argv[2] ?? 'zh';
const TAG = process.argv[3] ?? `r6${LANG}`;
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

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
  await ctx.addInitScript((lang) => {
    try {
      window.localStorage.setItem('maicai-lang', lang);
    } catch { /* ignore */ }
  }, LANG);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  return { ctx, page };
}

async function toggleInfo(page) {
  return page.evaluate(() => {
    const t = document.querySelector('[data-testid="lang-toggle"]');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    const segs = [...t.querySelectorAll('.lang-toggle-seg')].map((s) => {
      const b = s.getBoundingClientRect();
      return { text: s.textContent, w: Math.round(b.width), h: Math.round(b.height) };
    });
    return {
      lang: t.getAttribute('data-lang'),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      segs,
    };
  });
}

const browser = await chromium.launch({ args: GL_ARGS });
const info = {};
try {
  for (const phone of [false, true]) {
    const vp = phone ? 'phone' : 'desktop';
    console.log(`== board_${vp} (${LANG}) ==`);
    const { ctx, page } = await newPage(browser, phone);
    await enterGame(page);
    await enterChar(page);
    if (!(await ensure3d(page))) console.log(`  WARN board_${vp}: 3D fell back to 2D`);
    await page.keyboard.press('d');
    await page.locator('.board3d-reset').click().catch(() => null);
    await page.waitForTimeout(4500);
    info[`board_${vp}`] = await toggleInfo(page);
    console.log('  toggle:', JSON.stringify(info[`board_${vp}`]));
    await shot(page, `ui_board_${vp}_${TAG}.png`);
    await ctx.close();
  }
  console.log(`== market_desktop (${LANG}) ==`);
  const { ctx, page } = await newPage(browser, false);
  await enterGame(page);
  await enterChar(page);
  if (!(await ensure3d(page))) console.log('  WARN market: 3D fell back to 2D');
  await page.keyboard.press('d');
  await page.waitForTimeout(3000);
  await jumpStation(page, 2, 'panel-market');
  await page.waitForTimeout(1200);
  await shot(page, `ui_market_desktop_${TAG}.png`);
  await ctx.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(info, null, 2));
