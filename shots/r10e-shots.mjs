/**
 * r10e-shots.mjs — R10 Slice E 截图驱动（SwiftShader-safe CDP 截图）。
 * Usage: node shots/r10e-shots.mjs <en|zh> <desktop|phone> <prefix> [only-substr]
 * Expects vite preview on BASE (default http://localhost:4173).
 *
 * r10e：舞台去框弹窗（抽卡/市场/事件/家长/小卖部）· 天气电影时刻
 *     （转盘推近/弹出大卡/点掉后世界换天气）· 角色 ProfileCard 高光
 *     （点 bot 头像/真人头像弹出）· 底栏物件化（金币堆/小卡摞）·
 *     lap-card 只剩图形簇。
 * prefix 例：r10e_before（基线）/ r10e（落地后）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const LANG = process.argv[2] ?? 'zh';
const SIZE = process.argv[3] ?? 'desktop';
const PREFIX = process.argv[4] ?? 'r10e';
const ONLY = process.argv[5] ?? '';
const CTX =
  SIZE === 'phone'
    ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }
    : { viewport: { width: 1440, height: 900 } };
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

async function shot(page, name) {
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  fs.writeFileSync(path.join(OUT, `${PREFIX}_${name}_${LANG}_${SIZE}.png`), Buffer.from(res.data, 'base64'));
  console.log(`  shot ${PREFIX}_${name}_${LANG}_${SIZE}.png`);
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

async function railTop(page) {
  if (SIZE !== 'phone') return;
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
  });
  await page.waitForTimeout(350);
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
  if (lap !== null) {
    await page.locator(`[data-testid="demo-lap-${lap}"]`).dispatchEvent('click');
  }
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  await waitPanel(page, panelTestid);
}

/** 事件站：天气时刻（转盘 → 大卡）→ 点掉 → 牌堆翻故事卡 → 点故事卡看选项 */
async function revealEvent(page) {
  await page.locator('[data-testid="weather-card"]').click().catch(() => {});
  await page.waitForTimeout(600);
  await page.locator('.deck-top').click().catch(() => {});
  await page.locator('.event-story').waitFor({ timeout: 8_000 }).catch(() => null);
  await page.waitForTimeout(400);
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

/* —— ① 板面 HUD：底栏物件 + lap-card 图形簇 + bot 徽章列 —— */
if (want('hud')) {
  await jumpTo(page, 2, 'panel-market', 1);
  await page.locator('.popup [data-testid="action-primary"]').last().click().catch(() => {});
  await page.waitForTimeout(900);
  await shot(page, 'hud');
}

/* —— ② 抽菜谱站：牌堆浮在舞台上（含 pill 头） —— */
if (want('draw')) {
  await jumpTo(page, 1, 'panel-drawTask', 1);
  await railTop(page);
  await page.waitForTimeout(800);
  await shot(page, 'draw');
}

/* —— ③ 天气时刻：转盘推近/大卡弹出 → 点掉 → 世界换天气 —— */
if (want('weather')) {
  await jumpTo(page, 5, 'panel-event', 1);
  // 中转盘帧（3D 推近同时 DOM 转盘转）
  await shot(page, 'weather_spin');
  // 等天气大卡弹出（Slice E 新卡；旧构建没有 → 直接拍现状）
  await page.locator('[data-testid="weather-card"]').waitFor({ timeout: 4_000 }).catch(() => null);
  await railTop(page);
  await shot(page, 'weather_card');
  // 点掉大卡 → 世界换天气（色调 + 3D 灯光）→ 牌堆登场
  await page.locator('[data-testid="weather-card"]').click().catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, 'weather_dressed');
}

/* —— ④ 市场舞台：扇形手牌 + 投放区浮动钮 —— */
if (want('market')) {
  await jumpTo(page, 2, 'panel-market', 1);
  await railTop(page);
  await page.waitForTimeout(900);
  await shot(page, 'market');
}

/* —— ⑤ 事件故事卡：翻开的大故事卡（新流程点它才出选项） —— */
if (want('event')) {
  await jumpTo(page, 5, 'panel-event', 1);
  await revealEvent(page);
  await railTop(page);
  await shot(page, 'event_story');
  // 点故事卡 → 选项卡扇
  await page.locator('.event-story').click().catch(() => {});
  await page.waitForTimeout(700);
  await railTop(page);
  await shot(page, 'event_options');
}

/* —— ⑥ 家长站：聊天气泡 + 图卡扇 + 浮动输入条 —— */
if (want('parent')) {
  await jumpTo(page, 6, 'panel-parent', 1);
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.locator('.parent-fan').waitFor({ timeout: 15_000 }).catch(() => null);
  await railTop(page);
  await page.waitForTimeout(700);
  await shot(page, 'parent');
}

/* —— ⑦ 小卖部舞台 —— */
if (want('store')) {
  await jumpTo(page, 7, 'panel-store', 1);
  await railTop(page);
  await page.waitForTimeout(900);
  await shot(page, 'store');
}

/* —— ⑧ bot ProfileCard 高光（Slice E 新件；旧构建没有 → 跳过） —— */
if (want('spotlight')) {
  await jumpTo(page, 2, 'panel-market', 1);
  await page.locator('.popup [data-testid="action-primary"]').last().click().catch(() => {});
  await page.waitForTimeout(900);
  const medal = SIZE === 'phone'
    ? page.locator('.phone-bot').first()
    : page.locator('.bot-card').first();
  await medal.click().catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, 'spotlight');
}

await browser.close();
console.log('done');
