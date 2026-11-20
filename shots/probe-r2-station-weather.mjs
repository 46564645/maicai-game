/** probe-r2-station-weather.mjs — ww 追加项 2/3 的手机实测。
 * Usage: node shots/probe-r2-station-weather.mjs
 * 前置：vite preview 4173（dist 为当前构建）。
 *  ② 棋盘总览：存 r10e_r2_board_phone_check.png，离线量色点（脚本只
 *     存图 + 打印 DOM 侧信息，像素量测由 PIL 侧按预测中心窗口做）。
 *  ③ 事件站天气 card 相位：存 r10e_r2_weather_result_phone.png，
 *     同时采结果卡文字元素（.card-view-name / .moment-tap）的 rect、
 *     计算色、自身底色，写 r10e_r2_weather_result_phone.json 供环带
 *     口径离线算对比度。
 * 手机口径：874×402 + hasTouch/isMobile + --safe-* 注入（与验收组一致）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

async function shot(page, file) {
  const full = path.join(OUT, file);
  const methods = [
    async () => { await page.screenshot({ path: full, timeout: 60_000 }); return 'pw'; },
    async () => {
      const cdp = await page.context().newCDPSession(page);
      const res = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('cap 60s')), 60_000)),
      ]);
      fs.writeFileSync(full, Buffer.from(res.data, 'base64'));
      return 'cdp-surface';
    },
    async () => {
      const cdp = await page.context().newCDPSession(page);
      const res = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('cap 60s')), 60_000)),
      ]);
      fs.writeFileSync(full, Buffer.from(res.data, 'base64'));
      return 'cdp-nosurface';
    },
  ];
  for (let round = 1; round <= 2; round++) {
    for (const m of methods) {
      try {
        const tag = await m();
        console.log(`  shot ${file} (${tag})`);
        return true;
      } catch (e) {
        console.log(`  shot ${file} failed: ${String(e).slice(0, 80)}`);
      }
    }
    await page.waitForTimeout(4000).catch(() => {});
  }
  return false;
}

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({
  viewport: { width: 874, height: 402 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript(() => {
  try {
    window.localStorage.setItem('maicai-lang', 'en');
  } catch { /* ignore */ }
});
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.addStyleTag({ content: SAFE_CSS });
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(5000);

/* —— ② 棋盘总览（站点色点验证图） —— */
await shot(page, 'r10e_r2_board_phone_check.png');

/* —— 跳事件站，等天气 card 相位 —— */
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(700);
}
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-lap-1"]').dispatchEvent('click');
await page.locator('[data-testid="demo-station-5"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-event"]').waitFor({ timeout: 60_000 }).catch(() => null);
// 跳站后停在棋盘态（Go to this stop），需点进站钮才开事件面板
{
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    if ((await page.locator('[data-testid="panel-event"]').count()) > 0) break;
    if ((await page.locator('.popup').count()) === 0) {
      const enter = page.locator('.board-enter, [data-testid="action-primary"]').first();
      if ((await enter.count()) > 0) await enter.dispatchEvent('click').catch(() => {});
    }
    await page.waitForTimeout(400);
  }
}
const diag = await page.evaluate(() => ({
  prog: document.querySelector('.prog')?.getAttribute('aria-label') ?? null,
  panels: [...document.querySelectorAll('[data-testid^="panel-"]')].map((e) => e.getAttribute('data-testid')),
  moment: document.querySelectorAll('[data-testid="weather-moment"]').length,
  spinner: document.querySelectorAll('[data-testid="weather-spinner"]').length,
  card: document.querySelectorAll('[data-testid="weather-card"]').length,
  popup: document.querySelectorAll('.popup').length,
  status: document.querySelector('.board-status')?.textContent?.trim() ?? null,
}));
console.log('  after jump diag:', JSON.stringify(diag));

let phase = 'none';
{
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000) {
    phase = await page.evaluate(() => {
      const vis = (el) => !!el && el.getClientRects().length > 0;
      if (vis(document.querySelector('[data-testid="weather-card"]'))) return 'card';
      if (vis(document.querySelector('[data-testid="weather-spinner"]'))) return 'spin';
      return 'none';
    });
    if (phase === 'card') break;
    await page.waitForTimeout(250);
  }
}
console.log(`  weather phase: ${phase}`);
if (phase !== 'card') {
  console.log('  !! 未等到 card 相位');
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const grab = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      sel,
      text: el.textContent?.trim() ?? null,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      color: cs.color,
      bg: cs.backgroundColor,
      fontSize: cs.fontSize,
    };
  };
  const head = document.querySelector('.popup-head');
  return {
    popupHead: head?.textContent?.trim() ?? null,
    name: grab('[data-testid="weather-card"] .card-view-name'),
    tap: grab('[data-testid="weather-card"] .moment-tap'),
    card: grab('[data-testid="weather-card"]'),
  };
});
console.log('  weather info:', JSON.stringify(info, null, 1));
fs.writeFileSync(path.join(OUT, 'r10e_r2_weather_result_phone.json'), JSON.stringify(info, null, 2));
// 等卡片 pop-in 落定 + 滚进竖栏可视区，再拍（本机截图帧会滞后于 DOM，
// 拍完由离线侧核对卡面像素在不在图里）
await page.locator('[data-testid="weather-card"]').scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(2500);
await shot(page, process.env.WEATHER_OUT ?? 'r10e_r2_weather_result_phone.png');
await browser.close();
console.log('done');
