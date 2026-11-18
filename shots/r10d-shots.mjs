/**
 * r10d-shots.mjs — R10 Slice D 截图驱动（SwiftShader-safe CDP 截图）。
 * Usage: node shots/r10d-shots.mjs <en|zh> <desktop|phone> [only-substr]
 * Expects vite preview on BASE (default http://localhost:4173).
 *
 * r10d_*：进度簇（圈点+站点格）· 弹窗头目标小片+菜谱条 · 事件后果回声 ·
 *     事件「币不够」拒付反馈 · 第 3 圈市场无说明句 · 商店格子卡整幅 ·
 *     家长「听一听问题」钮 · 下一位高亮。
 * r10c_*（补 R10C 欠的）：事件牌背+提示 · 事件翻开 · 做菜飞锅 · 成品落位。
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
// R10D 要求的验收视口：desktop 1440×900 / phone-land 844×390
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

async function railTop(page) {
  if (SIZE !== 'phone') return;
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
  });
  await page.waitForTimeout(350);
}

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
  await page.keyboard.press('d');
  await waitPanel(page, panelTestid);
}

/** 事件站翻开（deck → 故事卡），返回是否翻开成功 */
async function revealEvent(page) {
  await page.locator('.deck').waitFor({ timeout: 15_000 }).catch(() => null);
  await page.waitForTimeout(1500); // 转盘停稳
  await page.locator('.deck-top').click().catch(() => {});
  await page.locator('.event-story').waitFor({ timeout: 8_000 }).catch(() => null);
  await page.waitForTimeout(500); // 选项卡扇入场弹完
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

/* —— ① 进度簇 + 下一位高亮（desktop：lap-card；phone：小头像排） —— */
if (want('progress')) {
  await jumpTo(page, 2, 'panel-market', 1);
  // 关掉弹窗看板面 HUD（lap-card / phone-bots 在板面上）
  await page.locator('.popup [data-testid="action-primary"]').last().click().catch(() => {});
  await page.waitForTimeout(900);
  await shot(page, `r10d_progress_${LANG}_${SIZE}.png`);
}

/* —— ② 弹窗头：目标小片 + 迷你菜谱进度条 —— */
if (want('popuphead')) {
  await jumpTo(page, 2, 'panel-market', 1);
  await railTop(page);
  await page.waitForTimeout(900);
  // .popup-head 区域用 CDP clip 截（locator.screenshot 等元素静止会超时——
  // 站内 bot 回合/入场动画让框一直在动）
  const box = await page.locator('.popup-head').boundingBox();
  if (box) {
    const cdp = await page.context().newCDPSession(page);
    const res = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: false,
      clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 },
    });
    fs.writeFileSync(path.join(OUT, `r10d_popup_head_${LANG}_${SIZE}.png`), Buffer.from(res.data, 'base64'));
    console.log(`  shot r10d_popup_head_${LANG}_${SIZE}.png`);
  }
}

/* —— ③ 市场说明句随圈退场：lap2 紧凑句 / lap3 无句 + ×2 徽标（若摊上连号） —— */
if (want('hint')) {
  await jumpTo(page, 2, 'panel-market', 2);
  await railTop(page);
  await page.waitForTimeout(900);
  await shot(page, `r10d_market_lap2_${LANG}_${SIZE}.png`);
  await jumpTo(page, 2, 'panel-market', 3);
  await railTop(page);
  await page.waitForTimeout(900);
  await shot(page, `r10d_market_lap3_${LANG}_${SIZE}.png`);
}

/* —— ④ 事件后果回声（花钱 → 后悔窗口里回声行） —— */
if (want('echo')) {
  await jumpTo(page, 5, 'panel-event', 1);
  await revealEvent(page);
  await railTop(page);
  const spend = page.locator('.event-hand .card-view').first();
  await spend.click().catch(() => {});
  await page.waitForTimeout(420); // 后悔窗口期：回声 + 撤销片同框
  await shot(page, `r10d_event_echo_${LANG}_${SIZE}.png`);
}

/* —— ⑤ 事件「币不够」拒付：花光零钱 → 买不起的花钱卡可点不可打 —— */
if (want('deny')) {
  // demo-spend-all 把真人币压到 < 第 1 圈车费，落在公交站
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
  }
  await page.locator('[data-testid="demo-spend-all"]').click();
  await waitPanel(page, 'panel-bus', 90_000);
  await page.waitForTimeout(600);
  await shot(page, `r10d_bus_nocoins_${LANG}_${SIZE}.png`); // 公交「币不够」同款
  await jumpTo(page, 5, 'panel-event', 1);
  await revealEvent(page);
  await railTop(page);
  const spend = page.locator('.event-hand .card-view').first();
  await spend.click().catch(() => {});
  await page.waitForTimeout(90); // 180ms 摇+红闪播到一半
  await shot(page, `r10d_event_deny_${LANG}_${SIZE}.png`);
  // 若这枚事件卡恰好买得起，回声会出现——busy-deny 兜底同款反馈
  await page.waitForTimeout(500);
  if ((await page.locator('[data-testid="event-echo"]').count()) > 0) {
    console.log('  note: event was affordable after spend-all; echo shot covers pending state');
  }
}

/* —— ⑥ 商店「全部食材」格子卡（整幅 contain + 名横幅 + 宝石在卡上） —— */
if (want('store')) {
  await jumpTo(page, 7, 'panel-store', 1);
  await railTop(page);
  await page.waitForTimeout(900);
  await shot(page, `r10d_store_grid_${LANG}_${SIZE}.png`);
}

/* —— ⑦ 家长站「👂 听一听问题」诚实语音钮（进问答页才看到） —— */
if (want('parent')) {
  await jumpTo(page, 6, 'panel-parent', 1);
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.locator('.parent-fan').waitFor({ timeout: 15_000 }).catch(() => null);
  await railTop(page);
  await page.waitForTimeout(700);
  await shot(page, `r10d_parent_hearq_${LANG}_${SIZE}.png`);
}

/* —— ⑧ r10c 欠账：事件牌背+提示 / 翻开 / 做菜飞锅 / 成品落位 —— */
if (want('r10c-event')) {
  await jumpTo(page, 5, 'panel-event', 1);
  await page.locator('.deck').waitFor({ timeout: 15_000 }).catch(() => null);
  await railTop(page);
  await page.waitForTimeout(1500);
  await shot(page, `r10c_event_facedown_${LANG}_${SIZE}.png`);
  await page.locator('.deck-top').click().catch(() => {});
  await page.waitForTimeout(1300);
  await railTop(page);
  await shot(page, `r10c_event_revealed_${LANG}_${SIZE}.png`);
}
if (want('r10c-cook')) {
  await jumpTo(page, 2, 'panel-market', 1);
  for (let i = 0; i < 2; i++) {
    const needed = page.locator('.stall-hand .card-view:has(.card-view-mark)').first();
    if ((await needed.count()) === 0) break;
    await needed.click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('.drop-zone--basket').click().catch(() => {});
    await page.waitForTimeout(1900);
  }
  await jumpTo(page, 8, 'panel-cook', 3);
  await railTop(page);
  await page.waitForTimeout(320);
  await shot(page, `r10c_cook_fly_${LANG}_${SIZE}.png`);
  await page.waitForTimeout(1100);
  await shot(page, `r10c_cook_dish_${LANG}_${SIZE}.png`);
}

await browser.close();
console.log('done');
