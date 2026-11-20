import { chromium } from '@playwright/test';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
await page.goto(`${BASE}/?board=3d&seed=2&fast=1&demo=1`);
await page.addStyleTag({ content: SAFE_CSS });
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(2500);
// 跳市场站（jumpTo 与 probe-r3fix 同款）
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(700);
}
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 30000 }).catch(() => null);
await page.waitForTimeout(1500);
const data = await page.evaluate(() => {
  const RR = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) }; };
  const log = document.querySelector('.board-log');
  const tog = document.querySelector('.lang-toggle--corner') || document.querySelector('.lang-toggle');
  const turn = document.querySelector('.phone-turn');
  const ov = (a, b) => (!a || !b) ? 0 : Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
  return { boardLog: log ? { rect: RR(log), text: log.textContent.trim(), parentChain: (() => { let s = [], n = log; while (n && s.length < 5) { s.push(n.className); n = n.parentElement; } return s; })() } : null, toggle: RR(tog), phoneTurn: RR(turn), overlapLogToggle: ov(RR(log), RR(tog)) };
});
console.log(JSON.stringify(data, null, 1));
await browser.close();
