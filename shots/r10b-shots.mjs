/**
 * r10b-shots.mjs — R10 Slice B 截图驱动（SwiftShader-safe CDP 截图）。
 * Usage: node shots/r10b-shots.mjs <en|zh> <desktop|phone> [only-substr]
 * Expects vite preview on BASE (default http://localhost:4173).
 * 截：抽卡翻牌/落位（demo 条关闭）· 事件翻牌前后 · 好友扇 · 家长图卡扇 ·
 *     商店货架扇 · 开饭组装。
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

/** 手机竖栏吸底滚动：证据图要拍卡扇，先把栏滚到顶（r9/r10a 同款） */
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
  // 未决弹窗会挡 DEMO_JUMP（如开局 drawTask）：先一路点主动作把它收掉
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

/* —— ① 抽任务站：干净翻牌仪式（demo 条全程关着，重拍 r10a 脏图） —— */
if (want('draw')) {
  await waitPanel(page, 'panel-drawTask');
  await page.locator('.deck').waitFor({ timeout: 15_000 });
  await railTop(page);
  await page.waitForTimeout(400);
  await page.locator('.deck-top').click();
  await page.waitForTimeout(300); // 翻到一半（--flip-ms 560ms）
  await shot(page, `r10b_draw_flip_${LANG}_${SIZE}.png`);
  await page.waitForTimeout(900); // 翻完 → DRAW_RECIPE → 确认条
  await shot(page, `r10b_draw_landed_${LANG}_${SIZE}.png`);
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(600);
}

/* —— ② 事件站：牌背 → 翻牌 → 事件卡 + 天气卡 + 二选一卡扇 —— */
if (want('event')) {
  await jumpTo(page, 5, 'panel-event');
  await page.locator('.deck').waitFor({ timeout: 15_000 }).catch(() => null);
  await railTop(page);
  await page.waitForTimeout(1400); // 天气转盘先停稳
  await shot(page, `r10b_event_facedown_${LANG}_${SIZE}.png`); // 牌背
  await page.locator('.deck-top').click();
  await page.waitForTimeout(300);
  await shot(page, `r10b_event_flip_${LANG}_${SIZE}.png`); // 翻到一半
  await page.waitForTimeout(900);
  await railTop(page);
  await shot(page, `r10b_event_revealed_${LANG}_${SIZE}.png`); // 事件卡+天气卡+选择扇
}

/* —— ③ 好友站：邀请回应卡扇 或 换菜 mini 卡扇 —— */
if (want('friends')) {
  await jumpTo(page, 3, 'panel-partner');
  await railTop(page);
  await page.waitForTimeout(1100); // 扇形入场播完
  await shot(page, `r10b_friends_fan_${LANG}_${SIZE}.png`);
}

/* —— ④ 家长站：图卡扇（离线模式即可；点「现在用」进问答才见扇——
      注意：答题前不会发 API 请求，截图即停在扇面上，安全） —— */
if (want('parent')) {
  await jumpTo(page, 6, 'panel-parent');
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.locator('.parent-fan').waitFor({ timeout: 15_000 }).catch(() => null);
  await railTop(page);
  await page.waitForTimeout(1100);
  await shot(page, `r10b_parent_fan_${LANG}_${SIZE}.png`);
}

/* —— ⑤ 商店站：缺货货架扇 —— */
if (want('store')) {
  await jumpTo(page, 7, 'panel-store');
  await railTop(page);
  await page.waitForTimeout(1100);
  await shot(page, `r10b_store_fan_${LANG}_${SIZE}.png`);
}

/* —— ⑥ 公交站：车票卡 + 车门投放区（加拍） —— */
if (want('bus')) {
  await jumpTo(page, 4, 'panel-bus');
  await railTop(page);
  await page.waitForTimeout(700);
  await shot(page, `r10b_bus_ticket_${LANG}_${SIZE}.png`);
}

/* —— ⑦ 开饭：做菜组装 + 盘卡弹入 + foil（第 3 圈做菜才进开饭） —— */
if (want('feast')) {
  // 先去菜市场把「需要的」菜买一两张——做菜组装飞入要有 collected 才出镜
  await jumpTo(page, 2, 'panel-market', 1);
  for (let i = 0; i < 2; i++) {
    const needed = page.locator('.stall-hand .card-view:has(.card-view-mark)').first();
    if ((await needed.count()) === 0) break;
    await needed.click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('.drop-zone--basket').click().catch(() => {});
    await page.waitForTimeout(700);
  }
  await jumpTo(page, 8, 'panel-cook', 3);
  await railTop(page);
  await page.waitForTimeout(900); // 组装飞入播一段
  await shot(page, `r10b_cook_${LANG}_${SIZE}.png`);
  // 一路 ACK 走到开饭屏（做菜 → 圈末篮子 → feast）；优先点弹窗里的主按钮
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    if ((await page.locator('[data-testid="screen-feast"]').count()) > 0) break;
    const inPopup = page.locator('.popup [data-testid="action-primary"]').first();
    const anywhere = page.locator('[data-testid="action-primary"]').first();
    const btn = (await inPopup.count()) > 0 ? inPopup : anywhere;
    if ((await btn.count()) > 0) await btn.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.locator('.plate-card').first().waitFor({ timeout: 10_000 }).catch(() => null);
  await page.waitForTimeout(700); // 盘卡弹入 + foil 闪光一瞬
  await shot(page, `r10b_feast_${LANG}_${SIZE}.png`);
}

await ctx.close();
await browser.close();
console.log('done');
