/**
 * r10c-probe.mjs — R10 Slice C PM spot-check screenshots.
 * Usage: node shots/r10c-probe.mjs <desktop|phone>
 * Expects vite preview on http://localhost:4174 (C build).
 * Shots: market fan + selected card (hero pill + CoinBar) per size.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:4174';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const SIZE = process.argv[2] ?? 'desktop';
const CTX =
  SIZE === 'phone'
    ? { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }
    : { viewport: { width: 1280, height: 800 } };
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

async function shot(page, name) {
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(res.data, 'base64'));
  console.log(`  shot ${name}`);
}

async function waitPanel(page, testid, timeoutMs = 60_000) {
  const panel = page.locator(`[data-testid="${testid}"]`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if ((await panel.count()) > 0) return;
    const hasPopup = (await page.locator('.popup').count()) > 0;
    if (!hasPopup) {
      const enter = page.locator('.board-enter, [data-testid="action-primary"]').first();
      if ((await enter.count()) > 0) await enter.dispatchEvent('click').catch(() => {});
    }
    await page.waitForTimeout(300);
  }
  if ((await panel.count()) === 0) throw new Error(`${testid} never opened`);
}

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext(CTX);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript(() => {
  try {
    window.localStorage.setItem('maicai-lang', 'zh');
  } catch { /* ignore */ }
});
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);

await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(3000);

await waitPanel(page, 'panel-drawTask');
await page.locator('.deck').waitFor({ timeout: 15_000 });
await page.waitForTimeout(400);
await page.locator('.deck-top').click();
await page.waitForTimeout(1200);
await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
await page.waitForTimeout(600);

if ((await page.locator('[data-testid="demo-station-2"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-2"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await waitPanel(page, 'panel-market');
await page.locator('.stall-hand').waitFor({ timeout: 15_000 });
if (SIZE === 'phone') {
  await page.evaluate(() => {
    document.querySelector('.phone-rail')?.scrollTo({ top: 0 });
  });
  await page.waitForTimeout(350);
}
await page.waitForTimeout(1100);
await shot(page, `r10c_market_fan_zh_${SIZE}.png`);

// Select a stall card: hero pill + CoinBar spend lighting should appear.
await page.locator('[data-testid^="action-stall-"]').last().click().catch(() => {});
await page.waitForTimeout(600);
if (SIZE === 'phone') {
  await page.evaluate(() => {
    document.querySelector('.drop-row')?.scrollIntoView({ block: 'end' });
  });
  await page.waitForTimeout(350);
}
await shot(page, `r10c_market_selected_zh_${SIZE}.png`);

await ctx.close();
await browser.close();
console.log('done');
