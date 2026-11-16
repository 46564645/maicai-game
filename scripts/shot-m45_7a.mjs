/**
 * shot-m45_7a.mjs —— M4.5.7a 手机文案修复截图（需 preview 已在 :4173 运行）。
 * 1. 菜市场右栏「Picked: Fish (3 coins)」+「After you buy: 9 coins」两行
 * 2. 窄卡「On my list」+ 卡角 ✓ 不溢出（菜市场 + 小卖部）
 * 3. 竖屏「Turn your phone sideways」文字水平居中（402×874）
 * 用法：node scripts/shot-m45_7a.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';
const PREFIX = 'm45_7a_';
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
  await page.keyboard.press('d'); // ?demo=1 自动打开的演示条先收起，选人页不被遮
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 15_000 }).catch(() => null);
  await page.waitForTimeout(2500);

  // 菜市场：选中一张卡 → 拍两行 Picked + On my list 角标
  await jumpStation(page, 2, 'panel-market');
  await page.waitForTimeout(400);
  const stallCard = page
    .locator('.phone-rail [data-testid^="action-stall-"]:not(:disabled)')
    .first();
  if ((await stallCard.count()) > 0) {
    await stallCard.dispatchEvent('click');
    await page.waitForTimeout(400);
  }
  await shot(page, 'market_phone');

  // 小卖部：弹窗打开时焦点落在第一张卡上（onFocus 即选中）——
  // 直接滚到栏顶拍 ✓ 角标，再滚到底拍两行 Picked，勿再点卡（会切换取消）
  await jumpStation(page, 7, 'panel-store');
  await page.locator('.phone-rail').evaluate((el) => el.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, 'store_phone');
  await page.locator('.phone-rail').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(300);
  await shot(page, 'store_phone_picked');

  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();

  // 竖屏 402×874：转屏提示文字水平居中
  const ctxP = await browser.newContext({
    viewport: { width: 402, height: 874 },
    hasTouch: true,
    isMobile: true,
  });
  const pageP = await ctxP.newPage();
  await pageP.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await pageP.waitForTimeout(1500);
  await pageP.screenshot({ path: `${OUT}/${PREFIX}portrait.png` });
  console.log(`  ${PREFIX}portrait.png`);
  await ctxP.close();
} finally {
  await browser.close();
}
console.log('done');
