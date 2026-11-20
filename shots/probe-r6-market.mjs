/**
 * probe-r6-market.mjs — R6 item 4: fresh market shots + IN-CONTEXT name
 * contrast measured by pixel sampling (text pixels vs local card background
 * inside the name bbox, from the actual screenshot — captures opacity,
 * filters and glare), plus per-card dim state (pglow--dim / hand--dim,
 * effective opacity, art filter) and the Fish name-duplication check
 * (visible .hand-tag whose text equals the on-card name).
 * Usage: node shots/probe-r6-market.mjs <667|874|1024|1280|1440> [seed]
 * Saves shots/r6_market_<w>.png (full page) and prints per-card rows.
 */
import { chromium } from '@playwright/test';

const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const BASE = 'http://localhost:4173';
const SIZES = { 667: [667, 375], 874: [874, 402], 1024: [1024, 768], 1280: [1280, 800], 1440: [1440, 900] };
const key = process.argv[2] ?? '1280';
const seed = Number(process.argv[3] ?? 1);
const [W, H] = SIZES[key];
const phone = key === '874' || key === '667';

const browser = await chromium.launch({ args: GL });
const ctx = phone
  ? await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true })
  : await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
const page = await ctx.newPage();
await page.goto(`${BASE}/?board=3d&seed=${seed}&fast=1&demo=1`, { waitUntil: 'load', timeout: 30_000 });
if (phone && key === '874') {
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
await page.waitForTimeout(1500);

/* Select the first stall card (click) so the selected-state rendering is
   captured too (ww: the selected Fish also looked grey). */
const firstCard = page.locator('.stall-hand .hand-item .card-view').first();
await firstCard.click().catch(() => {});
await page.waitForTimeout(900);
/* 等吐司离场再拍/再采样：停留中的吐司会盖住扇上卡名，
   像素采样会读出假低对比（实测 1.06:1 即此） */
for (let i = 0; i < 24; i++) {
  if ((await page.locator('.toast').count()) === 0) break;
  await page.waitForTimeout(500);
}

const shotPath = `shots/r6_market_${W}.png`;
await page.screenshot({ path: shotPath, timeout: 150_000 });
const { readFileSync } = await import('node:fs');
const shotB64 = readFileSync(shotPath).toString('base64');

const rows = await page.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const dpr = img.naturalWidth / window.innerWidth;
  const lum = (r, gg, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
  };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
  };
  const effOpacity = (el) => {
    let o = 1; let n = el;
    while (n && n !== document.body) { o *= Number(getComputedStyle(n).opacity); n = n.parentElement; }
    return o;
  };
  const out = [];
  for (const card of document.querySelectorAll('.stall-hand .card-view, .stall-slot .card-view')) {
    if (!vis(card)) continue;
    const nameEl = card.querySelector('.card-view-name');
    if (!nameEl) continue;
    const name = nameEl.textContent ?? '';
    const wrap = card.closest('.pglow') ?? card.parentElement;
    const dim = !!card.closest('.pglow--dim');
    const handDim = !!card.closest('.hand--dim');
    const art = card.querySelector('.card-view-art');
    const artFilter = art ? getComputedStyle(art).filter : '';
    const item = card.closest('.hand-item');
    const selected = card.classList.contains('card-view--selected') || item?.classList.contains('hand-item--sel') || item?.getAttribute('aria-selected') === 'true';
    /* pixel sampling inside the name bbox: background = modal colour bucket,
       text = darkest 2% luminance cluster */
    const r = nameEl.getBoundingClientRect();
    const x0 = Math.max(0, Math.floor(r.left * dpr)), y0 = Math.max(0, Math.floor(r.top * dpr));
    const x1 = Math.min(cv.width, Math.ceil(r.right * dpr)), y1 = Math.min(cv.height, Math.ceil(r.bottom * dpr));
    let contrast = null, bgHex = '', fgHex = '';
    if (x1 > x0 && y1 > y0) {
      const data = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      const buckets = new Map();
      const px = [];
      for (let i = 0; i < data.length; i += 4) {
        const R = data[i], G = data[i + 1], B = data[i + 2];
        const k = `${R >> 4},${G >> 4},${B >> 4}`;
        buckets.set(k, (buckets.get(k) ?? 0) + 1);
        px.push([R, G, B, lum(R, G, B)]);
      }
      let bestK = '', bestN = -1;
      for (const [k, n] of buckets) if (n > bestN) { bestN = n; bestK = k; }
      const [br, bgc, bb] = bestK.split(',').map((v) => Number(v) * 16 + 8);
      const bgL = lum(br, bgc, bb);
      px.sort((a, b) => a[3] - b[3]);
      const dark = px.slice(0, Math.max(8, Math.floor(px.length * 0.02)));
      const fr = dark.reduce((s, p) => s + p[0], 0) / dark.length;
      const fg = dark.reduce((s, p) => s + p[1], 0) / dark.length;
      const fb = dark.reduce((s, p) => s + p[2], 0) / dark.length;
      const fgL = lum(fr, fg, fb);
      const hi = Math.max(bgL, fgL), lo = Math.min(bgL, fgL);
      contrast = (hi + 0.05) / (lo + 0.05);
      bgHex = `rgb(${br},${bgc},${bb})`; fgHex = `rgb(${Math.round(fr)},${Math.round(fg)},${Math.round(fb)})`;
    }
    /* duplication: visible hand-tag with same text as the card name */
    const tag = item?.querySelector('.hand-tag');
    const tagDup = !!(tag && vis(tag) && (tag.textContent ?? '').trim() === name.trim());
    out.push({
      name, dim, handDim, selected,
      effOpacity: Math.round(effOpacity(card) * 100) / 100,
      artFilter, contrast: contrast ? Math.round(contrast * 100) / 100 : null,
      bgHex, fgHex, tagDup,
      nameColor: getComputedStyle(nameEl).color,
      cardBg: getComputedStyle(card).backgroundColor,
    });
  }
  return out;
}, shotB64);

console.log(`MARKET ${W}x${H} seed=${seed} shot=${shotPath} cards=${rows.length}`);
for (const r of rows) {
  console.log(`  "${r.name}" contrast=${r.contrast}:1 bg=${r.bgHex} fg=${r.fgHex} dim=${r.dim} handDim=${r.handDim} sel=${r.selected} effOp=${r.effOpacity} artFilter=${r.artFilter || 'none'} tagDup=${r.tagDup} nameColor=${r.nameColor} cardBg=${r.cardBg}`);
}
const dups = rows.filter((r) => r.tagDup);
console.log(`DUPLICATED NAMES: ${dups.length}${dups.length ? ' -> ' + dups.map((d) => d.name).join(', ') : ''}`);
const low = rows.filter((r) => r.contrast !== null && r.contrast < 4.5);
console.log(`NAMES < 4.5:1: ${low.length}${low.length ? ' -> ' + low.map((d) => `${d.name}=${d.contrast}:1(dim=${d.dim})`).join(', ') : ''}`);
await browser.close();
