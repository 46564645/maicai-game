/** probe-r2-board-phone.mjs — 手机棋盘总览干净图（关演示条后拍），
 * 供站点色点像素量测。存 shots/r10e_r2_board_phone_check.png。 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

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
await page.waitForTimeout(3000);
// 关演示条（点关闭钮；没有就按 d）
const closeBtn = page.locator('[data-testid="demo-close"]');
if ((await closeBtn.count()) > 0) await closeBtn.dispatchEvent('click').catch(() => {});
else await page.keyboard.press('d');
await page.waitForTimeout(3500);
console.log('  demo bar present:', (await page.locator('[data-testid="demo-bar"]').count()) > 0);
const file = path.join(OUT, 'r10e_r2_board_phone_check.png');
await page.screenshot({ path: file, timeout: 60_000 });
console.log('  shot r10e_r2_board_phone_check.png');
await browser.close();
