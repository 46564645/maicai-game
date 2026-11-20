/** probe-fanshot.mjs — T-1 情境图：棋盘手牌扇（人类回合、无弹窗时）。
 * Usage: node shots/probe-fanshot.mjs <1280|874>
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const sizeKey = process.argv[2];
const SIZE = sizeKey === '874' ? { w: 874, h: 402, phone: true } : { w: 1280, h: 800, phone: false };

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = SIZE.phone
  ? await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, hasTouch: true, isMobile: true })
  : await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h } });
const page = await ctx.newPage();
await page.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
if (SIZE.phone) await page.addStyleTag({ content: SAFE_CSS });
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(3000);
// 关掉可能的开局弹窗（规则卡），停在棋盘自由态
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(700);
}
await page.waitForTimeout(1200);
const info = await page.evaluate(() => ({
  popups: document.querySelectorAll('.popup').length,
  handCards: document.querySelectorAll('.hand .card-view, .hand-item .card-view').length,
  allCards: document.querySelectorAll('.card-view').length,
}));
console.log('state:', JSON.stringify(info));
await page.screenshot({ path: `shots/r10e_r3fix_fan_${sizeKey}.png`, animations: 'disabled' });
await browser.close();
console.log('done');
