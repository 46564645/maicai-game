/**
 * shoot.mjs — acceptance screenshots for baseline / WIP / final comparison.
 * Adapted from the project's scripts/shot-m45_7.mjs navigation flow
 * (same entry clicks, same viewports, same settle time), with two changes:
 *  - launches Playwright's bundled Chromium (no channel:'chrome' on this VM)
 *  - writes into ./shots/ with a caller-chosen prefix
 * Usage: node shots/shoot.mjs <prefix> [extraQuery]
 * Expects a preview server on http://localhost:4173 (npm run build && npm run preview).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = process.argv[2] ?? 'shot_';
const EXTRA = process.argv[3] ?? '';
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

async function enterGame(page) {
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click();
}
async function enterChar(page) {
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 20_000 }).catch(() => null);
}

const browser = await chromium.launch({ args: GL_ARGS });
try {
  const only = process.env.ONLY ?? '';
  for (const [name, phone] of [
    ['board_desktop', false],
    ['board_phone', true],
  ].filter(([n]) => !only || n.includes(only))) {
    const ctx = await browser.newContext(
      phone
        ? { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }
        : { viewport: { width: 1280, height: 800 } },
    );
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1${EXTRA}`);
    await enterGame(page);
    await enterChar(page);
    await page.keyboard.press('d'); // hide demo bar
    await page.waitForTimeout(4500); // camera damping settles
    // FPS probe (rAF over 3s) — swiftshader software rendering; relative only.
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
    const file = path.join(OUT, `${PREFIX}${name}.png`);
    await page.screenshot({ path: file, timeout: 180_000 });
    console.log(`${path.basename(file)} fps~${fps}${errors.length ? ' errors: ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
