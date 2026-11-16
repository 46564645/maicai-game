/**
 * shot-m45_8b.mjs —— M4.5.8b ww 验收阻断项复核截图（需 preview 已在 :4173 运行）。
 * 874×402 横屏右竖栏：主按钮（Go to this stop / Buy / Done with this stop）
 * 必须整颗露出、不被屏幕下沿裁掉。
 * 用法：node scripts/shot-m45_8b.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';
const PREFIX = 'm45_8b_';
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${PREFIX}${name}.png` });
  console.log(`  ${PREFIX}${name}.png`);
}

async function enterGame(page) {
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click();
}

async function jumpStation(page, station, panelTestid, timeout = 30_000) {
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

const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
try {
  const ctx = await browser.newContext({
    viewport: { width: 874, height: 402 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await enterGame(page);
  await page.keyboard.press('d');
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 15_000 }).catch(() => null);
  await page.waitForTimeout(3500);
  await shot(page, 'board_phone'); // 「Your turn」+ Go to this stop 主按钮

  await jumpStation(page, 2, 'panel-market');
  await page.waitForTimeout(600);
  await shot(page, 'market_phone'); // 吸底操作区：Buy / Maybe later / Skip + Done

  // 选中一张卡 → Buy 接管主按钮，仍整颗露出
  const stallCard = page
    .locator('.phone-rail [data-testid^="action-stall-"]:not(:disabled)')
    .first();
  if ((await stallCard.count()) > 0) {
    await stallCard.dispatchEvent('click');
    await page.waitForTimeout(400);
    await shot(page, 'market_phone_sel');
  }

  await jumpStation(page, 7, 'panel-store');
  await page.waitForTimeout(600);
  await shot(page, 'store_phone');

  const storeCard = page
    .locator('.phone-rail .store-section:first-of-type [data-testid^="action-store-"]:not(:disabled)')
    .first();
  if ((await storeCard.count()) > 0) {
    await storeCard.dispatchEvent('click');
    await page.waitForTimeout(400);
    await shot(page, 'store_phone_sel');
  }

  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
}
console.log('done');
