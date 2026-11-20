/** probe-names-scan.mjs — S-1 强扫描：卡名/标签 vs 全部裁剪祖先（含 .card-view 本身）
 * 与卡内容盒宽的双口径溢出；多 seed 覆盖不同摊位存货。
 * Usage: node shots/probe-names-scan.mjs <sizeKey> [seedFrom] [seedTo]
 */
import { chromium } from '@playwright/test';

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
if (!SIZE) { console.error('bad size', sizeKey); process.exit(1); }
const seedFrom = Number(process.argv[3] ?? 1);
const seedTo = Number(process.argv[4] ?? seedFrom);

async function waitPanel(page, testid, timeoutMs = 60_000) {
  const panel = page.locator(`[data-testid="${testid}"]`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if ((await panel.count()) > 0) return true;
    if ((await page.locator('.popup').count()) === 0) {
      const enter = page.locator('.board-enter, [data-testid="action-primary"]').first();
      if ((await enter.count()) > 0) await enter.dispatchEvent('click').catch(() => {});
    }
    await page.waitForTimeout(300);
  }
  return false;
}

async function jumpTo(page, stationIdx, panelTestid, lap = 1) {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
    await page.waitForTimeout(700);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  if (lap !== null) await page.locator(`[data-testid="demo-lap-${lap}"]`).dispatchEvent('click');
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  return waitPanel(page, panelTestid);
}

async function startPage(browser, seed) {
  const ctx = SIZE.phone
    ? await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, hasTouch: true, isMobile: true })
    : await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await page.addInitScript(() => {
    try { window.localStorage.setItem('maicai-lang', 'en'); } catch { /* ignore */ }
  });
  await page.goto(`${BASE}/?board=3d&seed=${seed}&fast=1&demo=1`);
  if (SIZE.safe) await page.addStyleTag({ content: SAFE_CSS });
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(2500);
  return { ctx, page };
}

const NAME_FN = () => {
  const out = [];
  const seen = new Set();
  const ctxOf = (el) => {
    let n = el;
    while (n && n !== document.body) {
      const c = typeof n.className === 'string' ? n.className : '';
      for (const key of ['phone-market-float', 'phone-weather-float', 'phone-rail', 'popup', 'hand', 'stall', 'store', 'deck', 'reflection', 'feast', 'wallet'])
        if (c.includes(key)) return key;
      n = n.parentElement;
    }
    return 'other';
  };
  for (const card of document.querySelectorAll('.card-view')) {
    if (card.getClientRects().length === 0) continue;
    const cs = getComputedStyle(card);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const cardPad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const cardContentW = card.clientWidth - cardPad;
    for (const sel of ['.card-view-name', '.card-view-tag']) {
      const el = card.querySelector(sel);
      if (!el || !el.textContent.trim()) continue;
      // 最近裁剪祖先（含 .card-view 本身）的最小 clientWidth
      let clipW = Infinity;
      let node = el.parentElement;
      while (node) {
        const ncs = getComputedStyle(node);
        if (ncs.overflowX === 'hidden' || ncs.overflowX === 'clip') clipW = Math.min(clipW, node.clientWidth);
        if (node === card) break;
        node = node.parentElement;
      }
      if (!Number.isFinite(clipW)) clipW = el.clientWidth;
      const text = el.textContent.trim().replace(/­/g, '¬');
      seen.add(text);
      const dWclip = el.scrollWidth - clipW;
      const dWcard = el.scrollWidth - cardContentW;
      const banner = el.closest('.card-view-banner');
      const dH = banner ? el.scrollHeight - banner.clientHeight : 0;
      out.push({
        sel, text: text.slice(0, 30), ctx: ctxOf(el),
        fs: getComputedStyle(el).fontSize, ws: getComputedStyle(el).whiteSpace,
        dWclip, dWcard, dH,
        sw: el.scrollWidth, clipW, cardContentW,
      });
    }
  }
  return { rows: out, seen: [...seen] };
};

const browser = await chromium.launch({ args: GL_ARGS });
const stations = [
  [2, 'panel-market', 'market'],
  [7, 'panel-store', 'store'],
  [3, 'panel-partner', 'partner'],
];
let totalBad = 0;
const allNames = new Set();
for (let seed = seedFrom; seed <= seedTo; seed++) {
  const { ctx, page } = await startPage(browser, seed);
  for (const [idx, testid, label] of stations) {
    const ok = await jumpTo(page, idx, testid, 1);
    await page.waitForTimeout(800);
    const { rows, seen } = await page.evaluate(NAME_FN);
    for (const s of seen) allNames.add(s);
    const bad = rows.filter((r) => r.dWclip > 0 || r.dWcard > 0 || r.dH > 1);
    totalBad += bad.length;
    console.log(`[${sizeKey} seed${seed}/${label}] jump=${ok} texts=${rows.length} bad=${bad.length}`);
    for (const b of bad)
      console.log(`  BAD ${b.ctx} ${b.sel} "${b.text}" fs=${b.fs} ws=${b.ws} dWclip=${b.dWclip} dWcard=${b.dWcard} dH=${b.dH} (sw=${b.sw} clipW=${b.clipW} cardW=${b.cardContentW})`);
  }
  await ctx.close();
}
console.log(`TOTAL bad=${totalBad}; names seen: ${[...allNames].join(' | ')}`);
await browser.close();
