// R6 N4/N5/N6 量测：市场面——投放区/完成钮真实可点矩形（rect + 中心命中）、
// 算式字号与矩形、记号渲染 px、价丸计算字号、每张摊卡的可见宽度
//（卡宽 − 被更高层邻卡横向盖住的部分）
// 用法: node shots/probe-r6-n45.mjs <w> <h> <phone|desktop> [seed]
import { chromium } from '@playwright/test';

const W = Number(process.argv[2]);
const H = Number(process.argv[3]);
const PHONE = process.argv[4] === 'phone';
const SEED = Number(process.argv[5] ?? 1);
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: PHONE, isMobile: PHONE });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); } catch {} });
const page = await ctx.newPage();
await page.goto(`http://localhost:4173/?board=3d&seed=${SEED}&fast=1&demo=1`, { waitUntil: 'load', timeout: 30_000 });
if (PHONE && W === 874) {
  await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(() => {});
}
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(2000);
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(600);
}
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
await page.waitForTimeout(1000);
/* 选中第一张卡，让投放区进入 armed 态、算式出现 */
await page.locator('.stall-hand .hand-item .card-view').first().click().catch(() => {});
await page.waitForTimeout(600);

const out = await page.evaluate(() => {
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const hit = (el) => {
    const r = el.getBoundingClientRect();
    const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return t === el || el.contains(t);
  };
  const btns = {};
  for (const [k, sel] of Object.entries({
    buy: '.drop-zone--basket',
    hold: '.drop-zone--hold',
    skip: '.drop-row .btn',
  })) {
    const el = document.querySelector(sel);
    if (el) btns[k] = { ...R(el), hitCenter: hit(el), text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 22) };
  }
  const doneEl = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Done'));
  if (doneEl) btns.done = { ...R(doneEl), hitCenter: hit(doneEl), text: 'Done' };
  const stack = document.querySelector('.phone-float-stack');
  const stackInfo = stack ? R(stack) : null;
  const math = document.querySelector('.cb-math--foot') ?? document.querySelector('.cb-math--inrow');
  const mathInfo = math ? { ...R(math), fontPx: parseFloat(getComputedStyle(math).fontSize), text: math.textContent.trim() } : null;
  const gem = document.querySelector('.stall-hand .card-view-gem');
  /* 摊卡可见宽度：按层序（DOM 后压前，选中 z-10）逐卡算未被盖的横向跨度 */
  const items = [...document.querySelectorAll('.stall-hand .hand-item')];
  const cards = items.map((it, i) => {
    const v = it.querySelector('.card-view');
    const r = v.getBoundingClientRect();
    const icon = v.querySelector('.meta-icon');
    return {
      name: v.querySelector('.card-view-name')?.textContent?.trim(),
      x: r.x, w: r.width, z: it.classList.contains('hand-item--sel') ? 10 : i,
      iconPx: icon ? +icon.getBoundingClientRect().width.toFixed(1) : null,
      iconKind: icon ? [...icon.classList].join(' ').match(/meta-icon--(\w+)/)?.[1] : null,
    };
  });
  for (const c of cards) {
    let covered = [];
    for (const o of cards) {
      if (o === c || o.z <= c.z) continue;
      const a = Math.max(c.x, o.x);
      const b = Math.min(c.x + c.w, o.x + o.w);
      if (b > a) covered.push([a, b]);
    }
    covered.sort((p, q) => p[0] - q[0]);
    let vis = c.w;
    let cur = c.x;
    for (const [a, b] of covered) {
      if (a > cur) { /* gap visible */ }
      vis -= Math.max(0, Math.min(b, c.x + c.w) - Math.max(a, cur));
      cur = Math.max(cur, b);
    }
    c.visibleW = Math.round(Math.max(0, vis));
    c.cardW = Math.round(c.w);
    delete c.x; delete c.w; delete c.z;
  }
  return { btns, mathInfo, stackInfo, gemFontPx: gem ? parseFloat(getComputedStyle(gem).fontSize) : null, cards };
});
console.log(`N45 ${W}x${H} seed=${SEED}`);
console.log('  btns=', JSON.stringify(out.btns));
console.log('  math=', JSON.stringify(out.mathInfo), 'gemFontPx=', out.gemFontPx, 'stack=', JSON.stringify(out.stackInfo));
for (const c of out.cards) console.log('  card=', JSON.stringify(c));
await browser.close();
