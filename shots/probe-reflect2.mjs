/** probe-reflect2.mjs — 精简版 feast+reflect 量测（替代 size5 reflect 全程驱动：
 * demo 跳 cook lap3 → 无条件推进 → 开饭量测+截图 → ACK → 感想量测+截图。
 * 量测函数与 probe-size5 的 METRICS_FN 同款，输出同样写 sweep-data。
 * Usage: node shots/probe-reflect2.mjs <667|874|1024|1280|1440>
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const SIZES = {
  '667': { w: 667, h: 375, phone: true, safe: false },
  '874': { w: 874, h: 402, phone: true, safe: true },
  '1024': { w: 1024, h: 768, phone: false, safe: false },
  '1280': { w: 1280, h: 800, phone: false, safe: false },
  '1440': { w: 1440, h: 900, phone: false, safe: false },
};
const sizeKey = process.argv[2];
const SIZE = SIZES[sizeKey];
if (!SIZE) { console.error('bad size'); process.exit(1); }
fs.mkdirSync('shots/sweep-data', { recursive: true });

const METRICS_FN = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  const pathOf = (el) => {
    const cls = (el.className?.baseVal !== undefined ? el.className.baseVal : el.className || '')
      .toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const inDemo = (el) => !!el.closest('[data-testid="demo-bar"]');
  const overflow = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || inDemo(el)) continue;
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)) continue;
    const dW = el.scrollWidth - el.clientWidth;
    const dH = el.scrollHeight - el.clientHeight;
    if (dW > 0 || dH > 0) overflow.push({ sel: pathOf(el), text: (el.textContent || '').trim().slice(0, 30), dW, dH, leaf: el.children.length === 0, fs: parseFloat(cs.fontSize) });
  }
  const localRect = (el, root) => {
    let x = 0; let y = 0; let n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
  };
  let cardOverlap = { max: 0, worst: null };
  for (const card of document.querySelectorAll('.card-view')) {
    const art = card.querySelector('.card-view-art');
    if (!art || !vis(art)) continue;
    const ar = localRect(art, card);
    for (const t of card.querySelectorAll('.card-view-name,.card-view-tag,.card-view-gem,.card-view-kind,.card-view-mark')) {
      if (!vis(t)) continue;
      const r = localRect(t, card);
      const ox = Math.max(0, Math.min(ar.right, r.right) - Math.max(ar.x, r.x));
      const oy = Math.max(0, Math.min(ar.bottom, r.bottom) - Math.max(ar.y, r.y));
      const area = Math.round(ox * oy);
      if (area > cardOverlap.max) cardOverlap = { max: area, worst: { cls: t.className.toString(), text: t.textContent.trim().slice(0, 20) } };
    }
  }
  const buttons = [];
  for (const el of document.querySelectorAll('button, [role="button"], .hand-item')) {
    if (!vis(el) || inDemo(el)) continue;
    const r = el.getBoundingClientRect();
    buttons.push({ sel: pathOf(el), text: (el.textContent || '').trim().slice(0, 22), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
  }
  const fonts = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length > 0 || !vis(el) || inDemo(el)) continue;
    if (/(^|\s)(sr-only|cc-live)(\s|$)/.test(el.className?.toString() ?? '')) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;
    fonts.push({ sel: pathOf(el), text: text.slice(0, 24), fs: parseFloat(getComputedStyle(el).fontSize) });
  }
  return { overflow, cardOverlap, buttons, fonts };
};

async function metrics(page, label) {
  const m = await page.evaluate(METRICS_FN);
  fs.writeFileSync(`shots/sweep-data/size5-${sizeKey}-${label}.json`, JSON.stringify(m, null, 1));
  const leafOv = m.overflow.filter((o) => o.leaf);
  const below48 = m.buttons.filter((b) => b.h < 48);
  const below14 = m.fonts.filter((f) => f.fs < 14);
  const minBtn = m.buttons.length ? Math.min(...m.buttons.map((b) => b.h)) : null;
  const minFs = m.fonts.length ? Math.min(...m.fonts.map((f) => f.fs)) : null;
  console.log(`  [size5 ${sizeKey}/${label}] leafOv=${leafOv.length} cardOnArt=${m.cardOverlap.max} minBtnH=${minBtn} below48=${below48.length} minFs=${minFs} below14=${below14.length}`);
  return m;
}

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = SIZE.phone
  ? await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, hasTouch: true, isMobile: true })
  : await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e).slice(0, 120)));
await page.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
if (SIZE.safe) await page.addStyleTag({ content: SAFE_CSS });
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(2500);

async function jumpTo(stationIdx, panelTestid, lap) {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
    await page.waitForTimeout(600);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  if (lap !== null) await page.locator(`[data-testid="demo-lap-${lap}"]`).dispatchEvent('click');
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  await page.locator(`[data-testid="${panelTestid}"]`).waitFor({ timeout: 30_000 }).catch(() => null);
}

const advance = () => page.evaluate(() => {
  const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
  const no = document.querySelector('[data-testid="proposal-no"]');
  if (vis(no)) { no.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
  const p = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
  if (p) { p.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
  const k = [...document.querySelectorAll('[data-key]')].filter(vis);
  if (k.length) k[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
}).catch(() => {});

await jumpTo(8, 'panel-cook', 3);
await page.waitForTimeout(800);
let gotFeast = false;
for (let i = 0; i < 120 && !gotFeast; i++) {
  if (await page.locator('[data-testid="screen-feast"]').count()) { gotFeast = true; break; }
  await advance();
  await page.waitForTimeout(450);
}
console.log('  feast reached =', gotFeast);
if (gotFeast) {
  await page.waitForTimeout(1500);
  await metrics(page, 'feast');
  await page.screenshot({ path: `shots/r10e_r2fix_feast_${sizeKey}.png`, animations: 'disabled' }).catch(() => {});
  // ACK → 感想屏
  let gotReflect = false;
  for (let i = 0; i < 60 && !gotReflect; i++) {
    if (await page.locator('[data-testid="screen-reflection"]').count()) { gotReflect = true; break; }
    await advance();
    await page.waitForTimeout(450);
  }
  console.log('  reflection reached =', gotReflect);
  if (gotReflect) {
    await page.waitForTimeout(1800);
    await metrics(page, 'reflect');
    await page.screenshot({ path: `shots/r10e_r2fix_reflect_${sizeKey}.png`, animations: 'disabled' }).catch(() => {});
  }
}
await browser.close();
console.log('done');
