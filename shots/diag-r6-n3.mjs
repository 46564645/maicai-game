// R6 N3 诊断：667 市场景——弹窗/站名签/选中行/浮层栈的矩形、层级与遮挡点
import { chromium } from '@playwright/test';

const W = Number(process.argv[2] ?? 667);
const H = Number(process.argv[3] ?? 375);
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); localStorage.setItem('maicai-icons-seen', '1'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30_000 });
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(1500);
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
}
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
await page.waitForTimeout(800);
await page.locator('.stall-hand .hand-item .card-view').first().click().catch(() => {});
await page.waitForTimeout(500);
const out = await page.evaluate(() => {
  const info = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      z: cs.zIndex, pos: cs.position, text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40),
      centerHit: top ? (top === el || el.contains(top) ? 'self' : `${top.tagName}.${top.className.toString().slice(0, 40)}`) : 'none',
    };
  };
  return {
    rail: info('.phone-rail'),
    popup: info('.popup'),
    head: info('.popup-head'),
    title: info('.popup-title'),
    coinbar: info('.coin-bar'),
    foot: info('.panel-foot'),
    selected: info('.panel-selected'),
    footMath: info('.cb-math--foot'),
    stack: info('.phone-float-stack'),
    backdrop: info('.popup-backdrop'),
    floatBackdrop: info('.phone-market-float'),
    doneBtn: info('.phone-float-stack .btn--navy'),
  };
});
console.log(`N3 ${W}x${H}`, JSON.stringify(out, null, 1));
await browser.close();
