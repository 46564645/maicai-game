/** r10e-r2-market-shots.mjs — R2 市场站批次验收截图。
 * Usage: node shots/r10e-r2-market-shots.mjs
 * 前置：npm run build 后 vite preview 在 4176。
 * 桌面 1280×800，EN + ZH 各两张：
 *  - r10e_r2_market_desktop_<lang>.png：进市场站初始态（自检：顶部层数、
 *    卡扇下说明行+缺菜图标、卡名完整、算式不在卡上）；
 *  - r10e_r2_market_afterbuy_desktop_<lang>.png：买下一张再选一张后
 *    （自检：Bought ✓ 角标、算式与按钮同行、Done 藏青）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4176';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

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
    if ((await panel.count()) > 0) return true;
    if ((await page.locator('.popup').count()) === 0) {
      const enter = page.locator('.board-enter, [data-testid="action-primary"]').first();
      if ((await enter.count()) > 0) await enter.dispatchEvent('click').catch(() => {});
    }
    await page.waitForTimeout(300);
  }
  return false;
}

async function jumpTo(page, stationIdx, panelTestid, lap = null) {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
    await page.waitForTimeout(700);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  if (lap !== null) await page.locator(`[data-testid="demo-lap-${lap}"]`).dispatchEvent('click');
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  return waitPanel(page, panelTestid);
}

const browser = await chromium.launch({ args: GL_ARGS });

for (const lang of ['en', 'zh']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await page.addInitScript((l) => {
    try {
      window.localStorage.setItem('maicai-lang', l);
    } catch { /* ignore */ }
  }, lang);
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(3000);

  await jumpTo(page, 2, 'panel-market', 1);
  // jumpTo 关弹窗的连点可能误触篮子买下一张：先等后悔窗结算，
  // 再显式点第一张摊卡把选中态定住，拍「选中待买」的初始态
  await page.waitForTimeout(2400);
  const first = page.locator('[data-testid^="action-stall-"]').first();
  await first.click().catch(() => {});
  await page.waitForTimeout(700);
  await shot(page, `r10e_r2_market_desktop_${lang}.png`);

  // 买下当前选中卡（走后悔窗 ~1.5s），再选另一张，看角标/算式行
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(3000);
  const stallCards = page.locator('[data-testid^="action-stall-"]');
  const n = await stallCards.count();
  console.log(`  [${lang}] stall cards after buy: ${n}`);
  if (n > 1) await stallCards.nth(1).click().catch(() => {});
  await page.waitForTimeout(700);
  await shot(page, `r10e_r2_market_afterbuy_desktop_${lang}.png`);
  await ctx.close();
}

await browser.close();
console.log('done');
