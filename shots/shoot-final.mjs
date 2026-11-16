/**
 * shoot-final.mjs — visual quality pass final evidence screenshots.
 * Navigation flow follows scripts/shot-m45_7.mjs (same entry clicks, same
 * viewports, same settle waits); differences: Playwright bundled Chromium
 * (no Google Chrome on this VM) and output into ./shots as final_*.png.
 * Expects a preview server on http://localhost:4173 (npm run build first).
 * Usage: node shots/shoot-final.mjs [only-substring]
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const ONLY = process.argv[2] ?? '';
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

async function shot(page, name) {
  const file = path.join(OUT, `final_${name}.png`);
  await page.screenshot({ path: file, timeout: 180_000 });
  console.log(`  final_${name}.png`);
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

async function newPage(browser, phone, extra = '') {
  const ctx = await browser.newContext(
    phone
      ? { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }
      : { viewport: { width: 1280, height: 800 } },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1${extra}`);
  return { ctx, page, errors };
}

async function capBoard(browser, phone) {
  const name = `board_${phone ? 'phone' : 'desktop'}`;
  const { ctx, page, errors } = await newPage(browser, phone);
  await enterGame(page);
  await enterChar(page);
  await page.keyboard.press('d');
  await page.waitForTimeout(4500);
  if (phone) {
    const fps = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let n = 0;
          const t0 = performance.now();
          const tick = () => {
            n++;
            if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
            else resolve(Math.round((n / (performance.now() - t0)) * 1000));
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log(`  phone rAF fps probe (SwiftShader): ~${fps}`);
  }
  await shot(page, name);
  if (errors.length) console.log(`  ${name} errors:`, errors.join(' | '));
  await ctx.close();
}

async function capMarket(browser, phone) {
  const name = `market_${phone ? 'phone' : 'desktop'}`;
  const { ctx, page, errors } = await newPage(browser, phone);
  await enterGame(page);
  await enterChar(page);
  await page.keyboard.press('d');
  await page.waitForTimeout(3000);
  await jumpStation(page, 2, 'panel-market');
  await page.waitForTimeout(1200);
  await shot(page, name);
  if (errors.length) console.log(`  ${name} errors:`, errors.join(' | '));
  await ctx.close();
}

async function capSpinner(browser, phone) {
  const name = `spinner_${phone ? 'phone' : 'desktop'}`;
  const { ctx, page, errors } = await newPage(browser, phone);
  await enterGame(page);
  await enterChar(page);
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
  for (const [i, ms] of [400, 500, 500].entries()) {
    await page.waitForTimeout(ms);
    if (i === 1) await shot(page, name);
  }
  await page.waitForTimeout(1500);
  await shot(page, `${name}_done`);
  if (errors.length) console.log(`  ${name} errors:`, errors.join(' | '));
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
console.log('done.');
