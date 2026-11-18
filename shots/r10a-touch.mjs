/** r10a-touch.mjs — 触屏仿真：CDP 真触摸序列拖拽买入 + tap-tap 等效 */
import { chromium } from '@playwright/test';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({
  viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true,
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(2500);
async function waitPanel(testid, timeoutMs = 60_000) {
  const panel = page.locator(`[data-testid="${testid}"]`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if ((await panel.count()) > 0) return;
    if ((await page.locator('.popup').count()) === 0) {
      const e = page.locator('.board-enter, [data-testid="action-primary"]').first();
      if ((await e.count()) > 0) await e.dispatchEvent('click').catch(() => {});
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`${testid} never opened`);
}
await waitPanel('panel-drawTask');
await page.locator('.deck').waitFor({ timeout: 15_000 });
await page.locator('.deck-top').tap();
await page.waitForTimeout(1200);
if ((await page.locator('[data-testid="demo-station-2"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-2"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await waitPanel('panel-market');
await page.evaluate(() => { document.querySelector('.phone-rail')?.scrollTo(0, 0); });
await page.waitForTimeout(900);

const label = async () =>
  page.evaluate(() => document.querySelector('.cc-live')?.textContent ??
    document.querySelector('.coins')?.getAttribute('aria-label'));

// —— 真触摸拖拽：touchStart → touchMove×N → touchEnd 于篮子上 ——
const card = page.locator('.stall-hand [data-testid^="action-stall-"]').last();
const zone = page.locator('.drop-zone--basket');
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
const cb = await card.boundingBox();
// 手机 rail 窄：卡右缘可能被相邻扇片压住，取卡在视口内的实际命中点
const hit = await page.evaluate(({ x, y, w, h }) => {
  for (const fx of [0.5, 0.7, 0.85]) {
    for (const fy of [0.5, 0.3, 0.75]) {
      const px = x + w * fx, py = y + h * fy;
      const el = document.elementFromPoint(px, py);
      if (el && el.closest('.hand-drag')) return { x: px, y: py, cls: el.className?.toString().slice(0, 40) };
    }
  }
  return null;
}, { x: cb.x, y: cb.y, w: cb.width, h: cb.height });
const zb = await zone.boundingBox();
if (!hit || !zb) throw new Error('missing hit/zone boxes');
const sx = hit.x, sy = hit.y;
const tx = zb.x + zb.width / 2, ty = zb.y + zb.height / 2;
console.log('hit point:', JSON.stringify(hit), 'zone:', JSON.stringify(zb));
const before = await label();
await page.evaluate(() => {
  window.__ev = [];
  for (const t of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove']) {
    window.addEventListener(t, (e) => window.__ev.push(
      `${t}:${e.pointerType ?? ''}@${e.target?.tagName}.${(e.target?.className ?? '').toString().slice(0, 30)}`), true);
  }
});
await page.waitForTimeout(50);
const probe = await page.evaluate(({ x, y }) => {
  const el = document.elementFromPoint(x, y);
  const chain = [];
  let n = el;
  while (n && chain.length < 8) {
    chain.push(`${n.tagName}.${(n.className || '').toString().slice(0, 30)} ta=${getComputedStyle(n).touchAction}`);
    n = n.parentElement;
  }
  return chain;
}, { x: sx, y: sy });
console.log('elementFromPoint chain:', JSON.stringify(probe, null, 1));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
for (let i = 1; i <= 10; i++) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: sx + ((tx - sx) * i) / 10, y: sy + ((ty - sy) * i) / 10, id: 1 }],
  });
  await page.waitForTimeout(30);
}
const dragging = await page.evaluate(() => ({
  up: !!document.querySelector('.hand-drag--up'),
  hot: document.querySelector('.drop-zone--basket')?.classList.contains('drop-zone--hot'),
  ev: window.__ev.slice(0, 30),
}));
console.log('touch drag-follow+zone-hot:', JSON.stringify(dragging));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(800);
const after = await label();
console.log(`touch drag→buy: ${before} → ${after}`, before !== after ? 'OK' : 'FAIL');

// —— 触摸无效弹回 ——
const card2 = page.locator('.stall-hand [data-testid^="action-stall-"]').last();
const cb2 = await card2.boundingBox();
if (cb2) {
  const x2 = cb2.x + cb2.width / 2, y2 = cb2.y + cb2.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x2, y: y2, id: 1 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x2 - i * 30, y: y2 - i * 20, id: 1 }],
    });
    await page.waitForTimeout(25);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
  const settled = await page.evaluate(() =>
    [...document.querySelectorAll('.hand-drag')].every((d) => d.style.transform === ''));
  console.log('touch spring-back settled:', settled ? 'OK' : 'FAIL');
}

// —— 触摸 tap-tap：tap 卡 → tap 篮子 ——
const before2 = await label();
await page.locator('.stall-hand [data-testid^="action-stall-"]').first().tap();
await page.waitForTimeout(300);
await zone.tap();
await page.waitForTimeout(800);
const after2 = await label();
console.log(`touch tap-tap buy: ${before2} → ${after2}`, before2 !== after2 ? 'OK' : 'FAIL');
await browser.close();
console.log('done');
