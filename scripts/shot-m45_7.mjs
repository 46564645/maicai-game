/**
 * shot-m45_7.mjs —— M4.5.7「画质：织梦岛风」验收截图（需 preview 已在 :4173 运行，先 npm run build）。
 * 用法：node scripts/shot-m45_7.mjs [prefix]   默认前缀 m45_7_
 * 产出（docs/screenshots/m45_7_*）：
 *   board_desktop      1280×800：整岛全景（①移轴 ②镜头 ③材质 ④亮绿 ⑤光影 ⑦细节 ⑧圆 ⑨水）
 *   board_phone        874×402：手机中档（无移轴/泛光，亮绿长影保留）
 *   spinner_desktop / spinner_phone：⑤事件站转盘转中+推近
 *   market_desktop / market_phone：②菜市场特写（③高光 ⑦细节 ⑤长影）
 *   tonemap_neutral_desktop / tonemap_aces_desktop：ww 挑色调对照
 *   ao_off_desktop（可选）：?fx=0 关后期对照
 * 固定机位：进棋盘等 ~3s 阻尼停稳再拍，保证与 M4.5.6 截图同机位可对比。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';
const PREFIX = process.argv[2] ?? 'm45_7_';
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

async function enterChar(page) {
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 20_000 }).catch(() => null);
}

/** 演示条跳站（站号 1..8） */
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

/* —— 棋盘全景：桌面 + 手机 + tonemap 对照 —— */
async function capBoard(browser) {
  for (const [name, phone, extra] of [
    ['board_desktop', false, ''],
    ['board_phone', true, ''],
    ['tonemap_neutral_desktop', false, '&tonemap=neutral'],
    ['tonemap_aces_desktop', false, '&tonemap=aces'],
    ['ao_off_desktop', false, '&fx=0'],
  ]) {
    const { ctx, page, errors } = await newPage(browser, phone, extra);
    await enterGame(page);
    await enterChar(page);
    await page.keyboard.press('d'); // 收演示条，正式画面干净
    await page.waitForTimeout(4500); // 相机阻尼停稳 + HDRI/后期就绪
    await shot(page, name);
    if (errors.length) console.log(`  ${name} errors:`, errors.join(' | '));
    await ctx.close();
  }
}

/* —— 菜市场特写 —— */
async function capMarket(browser, phone) {
  const name = `market_${phone ? 'phone' : 'desktop'}`;
  const { ctx, page, errors } = await newPage(browser, phone);
  await enterGame(page);
  await enterChar(page);
  await page.keyboard.press('d');
  await page.waitForTimeout(3000);
  await jumpStation(page, 2, 'panel-market');
  await page.waitForTimeout(1200); // 相机跟到菜市场 + 面板打开
  await shot(page, name);
  if (errors.length) console.log(`  ${name} errors:`, errors.join(' | '));
  await ctx.close();
}

/* —— 转盘推近：跳 ⑤事件站 → 转盘转中 + 落定 —— */
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
  // 转盘：蓄力 0.16s + 主旋 1.05s + 落定 0.6s；连拍抓推近特写
  for (const [i, ms] of [400, 500, 500].entries()) {
    await page.waitForTimeout(ms);
    if (i === 1) await shot(page, name); // 转中/推近位
  }
  await page.waitForTimeout(1500);
  await shot(page, `${name}_done`);
  if (errors.length) console.log(`  ${name} errors:`, errors.join(' | '));
  await ctx.close();
}

const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
try {
  console.log('== board（桌面/手机/tonemap 对照）==');
  await capBoard(browser);
  console.log('== market 桌面 ==');
  await capMarket(browser, false);
  console.log('== market 手机 ==');
  await capMarket(browser, true);
  console.log('== spinner 桌面 ==');
  await capSpinner(browser, false);
  console.log('== spinner 手机 ==');
  await capSpinner(browser, true);
} finally {
  await browser.close();
}
console.log('done.');
