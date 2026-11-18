/**
 * r10a-shots.mjs — R10 Slice A 截图驱动（SwiftShader-safe CDP 截图）。
 * Usage: node shots/r10a-shots.mjs <en|zh> <desktop|phone>
 * Expects vite preview on BASE (default http://localhost:4173).
 * 截：抽任务牌堆翻牌中 / 翻牌落位后；市场扇形 / 可打出发光 / 选中态。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const LANG = process.argv[2] ?? 'en';
const SIZE = process.argv[3] ?? 'desktop';
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

/** 手机竖栏吸底滚动：证据图要拍牌堆/扇形，先把栏滚到顶（r9 同款） */
async function railTop(page) {
  if (SIZE !== 'phone') return;
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
  });
  await page.waitForTimeout(350);
}

/* —— ① 抽任务站：牌堆翻牌仪式（第 1 圈首个站点自然到达） —— */
await waitPanel(page, 'panel-drawTask');
await page.locator('.deck').waitFor({ timeout: 15_000 });
await railTop(page);
await page.waitForTimeout(400);

// 点牌堆 → 翻牌中（--flip-ms 560ms，截 ~300ms 处）
await page.locator('.deck-top').click();
await page.waitForTimeout(300);
await shot(page, `r10a_draw_flip_${LANG}_${SIZE}.png`);

// 翻完 → DRAW_RECIPE 派发 → 确认条 + 菜谱落进底栏手牌
await page.waitForTimeout(900);
await shot(page, `r10a_draw_landed_${LANG}_${SIZE}.png`);

// 确认条 ACK 关掉弹窗（键盘主按钮 = 当前 OK）
await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
await page.waitForTimeout(600);

/* —— ② 市场站：扇形手牌 + 投放区 —— */
// demo 跳到站 2（跳转会补齐菜谱——底栏手牌有常驻卡，市场有 6 张摊卡）
if ((await page.locator('[data-testid="demo-station-2"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-2"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await waitPanel(page, 'panel-market');
await page.locator('.stall-hand').waitFor({ timeout: 15_000 });
await railTop(page);
// 手牌弹入 stagger 播完 + 扫光带走过一遍
await page.waitForTimeout(1100);
await shot(page, `r10a_market_fan_${LANG}_${SIZE}.png`);

// 悬停一张可打卡：Tilt 倾斜 + glare + 柔光 + 邻卡让位
const stallCard = page.locator('[data-testid^="action-stall-"]').nth(1);
await stallCard.hover().catch(() => {});
await page.waitForTimeout(450);
await shot(page, `r10a_market_glow_${LANG}_${SIZE}.png`);

// 点选最后一张摊卡（完全露出、点得中）：上抬回正 + 描边 + 投放区亮「armed」
await page.locator('[data-testid^="action-stall-"]').last().click().catch(() => {});
await page.waitForTimeout(450);
if (SIZE === 'phone') {
  // 滚到投放区行尾可见：选中卡 + 浮名在上、亮区在下
  await page.evaluate(() => {
    document.querySelector('.drop-row')?.scrollIntoView({ block: 'end' });
  });
  await page.waitForTimeout(350);
}
await shot(page, `r10a_market_selected_${LANG}_${SIZE}.png`);

await ctx.close();
await browser.close();
console.log('done');
