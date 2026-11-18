/**
 * r9-shots.mjs — R9 家长站状态点截图驱动（SwiftShader-safe CDP 截图）。
 * Usage: node shots/r9-shots.mjs <en|zh> <desktop|phone> [fallback]
 * Expects vite preview on BASE (default http://localhost:4173).
 * 'fallback' 模式：答 1 题触发 fetch 失败→自动重试→再失败→回退离线版，
 * 截状态点变灰的瞬间（live 构建专用证据）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const LANG = process.argv[2] ?? 'en';
const SIZE = process.argv[3] ?? 'desktop';
const FALLBACK = process.argv[4] === 'fallback';
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

async function statusInfo(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="parent-status"]');
    return el ? `${el.getAttribute('data-live')} | ${el.textContent}` : 'absent';
  });
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

if ((await page.locator('[data-testid="demo-station-6"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-6"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-6"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
{
  const panel = page.locator('[data-testid="panel-parent"]');
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    if ((await panel.count()) > 0) break;
    const enter = page.locator('[data-testid="action-primary"]').first();
    const hasPopup = (await page.locator('.popup').count()) > 0;
    if (!hasPopup && (await enter.count()) > 0) await enter.dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(300);
  }
  if ((await panel.count()) === 0) throw new Error('parent panel never opened');
}
console.log('parent panel open; status:', await statusInfo(page));

// 「现在用」→ 聊天打开（live 构建此时真对话会话已建立，未发任何 API 请求）
if ((await page.locator('[data-testid="parent-chat"]').count()) === 0) {
  await page.locator('[data-testid="panel-parent"] [data-testid="action-primary"]').click();
}
await page.locator('[data-testid="parent-chat"]').waitFor({ timeout: 20_000 });
await page.waitForTimeout(800);
console.log('chat open; status:', await statusInfo(page));

// 手机竖栏吸底滚动：状态点在面板顶，先滚到顶再截（只截证据图，不改交互）
if (SIZE === 'phone') {
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
  });
  await page.waitForTimeout(400);
}

if (FALLBACK) {
  // 答 1 题 → fetch 失败（VM 沙箱内隧道不通）→ ~800ms 自动重试 → 再失败
  // → 回退离线脚本，状态点应变灰
  const input = page.locator('[data-testid="parent-text-input"]');
  await input.fill(LANG === 'zh' ? '我想要2个币' : 'I want 2 coins');
  await page.locator('[data-testid="action-parent-text"]').click();
  const t0 = Date.now();
  let st = '';
  while (Date.now() - t0 < 30_000) {
    st = await statusInfo(page);
    if (st.startsWith('off')) break;
    await page.waitForTimeout(400);
  }
  console.log('after answer; status:', st);
  await page.waitForTimeout(800);
  await shot(page, `r9_parent_${LANG}_fallback_${SIZE}.png`);
} else {
  const mode = process.env.SHOT_MODE ?? 'live';
  await shot(page, `r9_parent_${LANG}_${mode}_${SIZE}.png`);
}

await ctx.close();
await browser.close();
console.log('done');
