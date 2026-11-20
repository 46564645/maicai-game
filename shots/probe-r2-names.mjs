/** Probe R2-names: 手机横屏 874×402 下「站名」实际字号实测。
 * 站名在手机棋盘态出现在两处 DOM：① 右栏状态行 .phone-turn
 * .board-status（"Your turn: at 'Recipe Stop'"，整行同字号）；
 * ② 进站弹窗头丸 .phone-rail .popup-title（"② The Market" 式）。
 * 量 computed font-size + 文本 Range 的实际像素高（替代口径）。
 * 用法：BASE=http://localhost:4175 node shots/probe-r2-names.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4175';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';

const MEASURE_FN = (sels) => {
  const out = {};
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) {
      out[sel] = null;
      continue;
    }
    const cs = getComputedStyle(el);
    // 站名文本节点的实际渲染高（取元素内第一个文本节点的 Range）
    let textH = null;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim().length > 1) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        if (r.height > 0) {
          textH = Math.round(r.height * 10) / 10;
          break;
        }
      }
    }
    const r = el.getBoundingClientRect();
    out[sel] = {
      fontSizePx: parseFloat(cs.fontSize),
      text: el.textContent.trim().slice(0, 60),
      rectH: Math.round(r.height * 10) / 10,
      textH,
    };
  }
  return out;
};

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({
  viewport: { width: 874, height: 402 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
await page.addInitScript(() => {
  try {
    window.localStorage.setItem('maicai-lang', 'en');
  } catch { /* ignore */ }
});
await page.goto(`${BASE}/?board=3d&seed=1&fast=1`);
await page.addStyleTag({ content: SAFE_CSS });
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(4000);

const boardState = await page.evaluate(MEASURE_FN, [
  '.phone-turn .board-status',
  '.phone-rail .popup-title',
  '.board-status',
]);
console.log('board state:', JSON.stringify(boardState, null, 1));

// 进站 → 弹窗头丸里的站名
await page.locator('[data-testid="action-primary"]').click().catch(() => null);
await page.waitForTimeout(2500);
const popupState = await page.evaluate(MEASURE_FN, [
  '.phone-rail .popup-title',
  '.phone-rail .popup-head',
]);
console.log('popup state:', JSON.stringify(popupState, null, 1));
await browser.close();
