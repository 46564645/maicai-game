/**
 * shot-m45_8.mjs —— M4.5.8 全英文文案验收截图（需 preview 已在 :4173 运行，先 npm run build）。
 * 用法：node scripts/shot-m45_8.mjs [prefix]   默认前缀 m45_8_
 * 覆盖：
 *   rotate_portrait    402×874 竖屏：「Turn your phone sideways」转屏提示
 *   char_phone         874×402 触屏横屏：4 个角色一行全显示
 *   board_phone        874×402：左岛右栏
 *   market_phone       874×402：菜市场 6 卡 2×3
 *   store_phone        874×402：小卖部先选再买
 *   store_phone_sel    874×402：点卡后橙框 + Buy (N coins)
 *   char_desktop       1280×800：4 角色一行
 *   board_desktop      1280×800：3D 棋盘
 *   market_desktop     1280×800
 *   store_desktop / store_desktop_sel  1280×800
 *   spinner_desktop_*  1280×800：转盘转动 + 落定
 * 画面不得再出现中文。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';
const PREFIX = process.argv[2] ?? 'm45_8_';
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
  await page.locator('[data-testid="action-primary"]').click(); // 开场 → 选人
}

async function pickChar(page) {
  await page.locator('[data-testid^="action-char-"]').first().waitFor();
}

async function enterChar(page) {
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 15_000 }).catch(() => null);
}

/** 演示条跳站（站号 1..8） */
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

/* —— 手机竖屏 402×874：转屏提示 —— */
async function capPortrait(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 874 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1`);
  await page.getByTestId('rotate-gate').waitFor();
  await page.waitForTimeout(400);
  await shot(page, 'rotate_portrait');
  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
}

/* —— 手机横屏 874×402（iPhone 17 Pro：触屏 + 小短边）—— */
async function capPhone(browser) {
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
  await page.keyboard.press('d'); // 先收演示条，正式画面干净
  await pickChar(page);
  await page.waitForTimeout(400);
  await shot(page, 'char_phone'); // 4 个角色一行
  await enterChar(page);
  await page.waitForTimeout(3500);
  await shot(page, 'board_phone'); // 左岛右栏

  await jumpStation(page, 2, 'panel-market');
  await page.waitForTimeout(600);
  await shot(page, 'market_phone');

  await jumpStation(page, 7, 'panel-store');
  await page.waitForTimeout(600);
  await shot(page, 'store_phone');
  // 先选再买：点第一张可买的卡 → 抬起+橙框 + Buy (N coins)
  const card = page
    .locator('.phone-rail .store-section:first-of-type [data-testid^="action-store-"]:not(:disabled)')
    .first();
  if ((await card.count()) > 0) {
    await card.dispatchEvent('click');
    await page.waitForTimeout(400);
    await shot(page, 'store_phone_sel');
  }

  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
}

/* —— 桌面 1280×800 —— */
async function capDesktop(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await enterGame(page);
  await pickChar(page);
  await page.waitForTimeout(400);
  await shot(page, 'char_desktop'); // 4 角色一行
  await enterChar(page);
  await page.keyboard.press('d');
  await page.waitForTimeout(3500);
  await shot(page, 'board_desktop');

  await jumpStation(page, 2, 'panel-market');
  await page.waitForTimeout(600);
  await shot(page, 'market_desktop');

  await jumpStation(page, 7, 'panel-store');
  await page.waitForTimeout(600);
  await shot(page, 'store_desktop');
  const card = page
    .locator('.popup .store-section:first-of-type [data-testid^="action-store-"]:not(:disabled)')
    .first();
  if ((await card.count()) > 0) {
    await card.click();
    await page.waitForTimeout(400);
    await shot(page, 'store_desktop_sel');
  }
  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
}

/* —— 天气转盘：跳到 ⑤Surprise Stop → 进站 → 转盘转 + 相机推近 —— */
async function capSpinner(browser, mode) {
  const isPhone = mode === 'phone';
  const ctx = await browser.newContext(
    isPhone
      ? { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }
      : { viewport: { width: 1280, height: 800 } },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await enterGame(page);
  await enterChar(page);
  await page.keyboard.press('d');
  await page.waitForTimeout(3500);

  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-5"]').dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  const enter = page.locator('[data-testid="action-primary"]').first();
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    if ((await enter.count()) > 0) {
      await enter.click();
      break;
    }
    if ((await page.locator('canvas').count()) === 0) break;
    await page.waitForTimeout(150);
    if ((await page.locator('[data-testid="action-primary"]').count()) === 0 && Date.now() - t0 > 1200)
      break;
  }
  // 转盘：蓄力 0.16s + 主旋 1.05s + 落定 0.6s；连拍抓转动与推近
  for (const [i, ms] of [300, 500, 500, 500].entries()) {
    await page.waitForTimeout(ms);
    await shot(page, `spinner_${mode}_${i}`);
  }
  await page.waitForTimeout(1200);
  await shot(page, `spinner_${mode}_done`);
  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
}

const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
try {
  console.log('== phone 竖屏 402×874 ==');
  await capPortrait(browser);
  console.log('== phone 横屏 874×402 ==');
  await capPhone(browser);
  console.log('== desktop 1280×800 ==');
  await capDesktop(browser);
  console.log('== spinner desktop ==');
  await capSpinner(browser, 'desktop');
  console.log('== spinner phone ==');
  await capSpinner(browser, 'phone');
} finally {
  await browser.close();
}
console.log('done');
