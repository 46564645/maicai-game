/**
 * r10c-shots.mjs — R10 Slice C 截图驱动（SwiftShader-safe CDP 截图）。
 * Usage: node shots/r10c-shots.mjs <en|zh> <desktop|phone> [only-substr]
 * Expects vite preview on BASE (default http://localhost:4173).
 * 截：菜市场扇+选中卡大浮签（hero pill）· 手机横屏不裁切网格 ·
 *     事件牌背+提示句 · 事件翻开大故事卡 · 做菜飞锅+成品落位 ·
 *     家长站入场（对话先行）· 选中卡点亮金币条。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const LANG = process.argv[2] ?? 'zh';
const SIZE = process.argv[3] ?? 'desktop';
const ONLY = process.argv[4] ?? '';
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

/** 等到某弹窗出现；期间板上有「进入这一站」按钮就点 */
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

/** 手机竖栏吸底滚动：证据图要拍卡扇，先把栏滚到顶（r9/r10a/r10b 同款） */
async function railTop(page) {
  if (SIZE !== 'phone') return;
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
  });
  await page.waitForTimeout(350);
}

/** demo 跳站（先关掉开着的弹窗→开条→选圈/站→跳→关条→等弹窗） */
async function jumpTo(page, stationIdx /*1-based*/, panelTestid, lap = null) {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
    await page.waitForTimeout(700);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  if (lap !== null) {
    await page.locator(`[data-testid="demo-lap-${lap}"]`).dispatchEvent('click');
  }
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d'); // 关上 demo 条再拍
  await waitPanel(page, panelTestid);
}

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext(CTX);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript((lang) => {
  try {
    window.localStorage.setItem('maicai-lang', lang);
  } catch {
    /* ignore */
  }
}, LANG);
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);

await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(3000);

const want = (s) => ONLY === '' || s.includes(ONLY);

/* —— ① 菜市场扇 + 选中卡 28px 大浮签 + 金币条点亮 —— */
if (want('market')) {
  await jumpTo(page, 2, 'panel-market', 1);
  await railTop(page);
  await page.waitForTimeout(1100); // 扇形入场 + 扫光播完
  await shot(page, `r10c_market_fan_${LANG}_${SIZE}.png`);
  // 点一张摊卡 → hand-tag 28px 大浮签 + CoinBar 点亮花费格
  const card = page.locator('.stall-hand .card-view').nth(1);
  await card.click().catch(() => {});
  await page.waitForTimeout(450);
  await shot(page, `r10c_market_hero_${LANG}_${SIZE}.png`); // 选中卡大浮签
  await shot(page, `r10c_coinbar_sel_${LANG}_${SIZE}.png`); // 金币条 + 9−2→7
}

/* —— ② 手机横屏菜市场：扇退成不裁切网格（每卡全露出 ≥48px 可点面） —— */
if (SIZE === 'phone' && want('marketgrid')) {
  await railTop(page);
  await page.waitForTimeout(300);
  await shot(page, `r10c_market_grid_${LANG}_${SIZE}.png`);
}

/* —— ③ 事件站：牌背 + 「点一下，翻开看看」提示 + idle 浮动 —— */
if (want('event')) {
  await jumpTo(page, 5, 'panel-event');
  await page.locator('.deck').waitFor({ timeout: 15_000 }).catch(() => null);
  await railTop(page);
  await page.waitForTimeout(1500); // 天气转盘停稳（--wheel-ms 1300）
  await shot(page, `r10c_event_facedown_${LANG}_${SIZE}.png`); // 牌背+提示句
  await page.locator('.deck-top').click();
  await page.waitForTimeout(300);
  await shot(page, `r10c_event_flip_${LANG}_${SIZE}.png`); // 翻到一半
  await page.waitForTimeout(900);
  await railTop(page);
  await shot(page, `r10c_event_revealed_${LANG}_${SIZE}.png`); // 大故事卡+双选项
}

/* —— ④ 家长站入场：对话先行（头像名签 + 招呼气泡，无评分口径） —— */
if (want('parent')) {
  await jumpTo(page, 6, 'panel-parent');
  await railTop(page);
  await page.waitForTimeout(800);
  await shot(page, `r10c_parent_entry_${LANG}_${SIZE}.png`); // 入场=聊天，不答题
  // 进问答（离线脚本）：示范对话 + 句首启口片
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.locator('.parent-fan').waitFor({ timeout: 15_000 }).catch(() => null);
  await railTop(page);
  await page.waitForTimeout(900);
  await shot(page, `r10c_parent_demo_${LANG}_${SIZE}.png`); // 「示范」对话+启口片
}

/* —— ⑤ 做菜：先买两样菜 → 组装飞锅 mid-flight → 成品落位 —— */
if (want('cook')) {
  await jumpTo(page, 2, 'panel-market', 1);
  for (let i = 0; i < 2; i++) {
    const needed = page.locator('.stall-hand .card-view:has(.card-view-mark)').first();
    if ((await needed.count()) === 0) break;
    await needed.click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('.drop-zone--basket').click().catch(() => {});
    await page.waitForTimeout(1900); // 后悔窗口 1.5s 到期才派发
  }
  await jumpTo(page, 8, 'panel-cook', 3);
  await railTop(page);
  await page.waitForTimeout(320); // 食材卡飞锅途中（错峰 50ms×n + 220ms）
  await shot(page, `r10c_cook_fly_${LANG}_${SIZE}.png`);
  await page.waitForTimeout(1100); // 全落锅 → 成品弹出 + 蒸汽
  await shot(page, `r10c_cook_dish_${LANG}_${SIZE}.png`);
}

await browser.close();
console.log('done');
