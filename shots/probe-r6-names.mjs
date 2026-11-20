/** probe-r6-names.mjs — R6 item 1 验证：卡名新口径全屏扫描。
 * 规则：无 &shy;（软连字符绝迹）、只在空格处折行、行数 ≤3、
 * 横向溢出 0、计算字号 ≥14px、卡内不裁剪（card scrollHeight ≤ clientHeight）。
 * Usage: node shots/probe-r6-names.mjs <sizeKey> [seedFrom] [seedTo]
 * sizeKey: 667 | 874 | 1024 | 1280 | 1440 | feast874 | feast1280
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
const arg = process.argv[2];
const feastMode = arg?.startsWith('feast');
const sizeKey = feastMode ? arg.replace('feast', '') : arg;
const SIZE = SIZES[sizeKey];
if (!SIZE) { console.error('bad size', arg); process.exit(1); }
const seedFrom = Number(process.argv[3] ?? 1);
const seedTo = Number(process.argv[4] ?? seedFrom);

async function waitPanel(page, testid, timeoutMs = 12_000) {
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
    await page.locator('.popup [data-testid="action-primary"]').first().dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(500);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  if (lap !== null) await page.locator(`[data-testid="demo-lap-${lap}"]`).dispatchEvent('click');
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  return panelTestid ? waitPanel(page, panelTestid) : true;
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

const SCAN_FN = () => {
  const out = [];
  const ctxOf = (el) => {
    let n = el;
    while (n && n !== document.body) {
      const c = typeof n.className === 'string' ? n.className : '';
      for (const key of ['phone-market-float', 'phone-weather-float', 'phone-rail', 'popup', 'stall', 'store', 'deck', 'reflection', 'feast', 'event', 'parent', 'swap', 'choice', 'invite', 'cook', 'wallet', 'hand'])
        if (c.includes(key)) return key;
      n = n.parentElement;
    }
    return 'other';
  };
  for (const el of document.querySelectorAll('.card-view-name')) {
    if (el.getClientRects().length === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const raw = el.textContent ?? '';
    const fs = parseFloat(cs.fontSize);
    const lh = parseFloat(cs.lineHeight);
    const lineH = Number.isFinite(lh) && lh > 0 ? lh : fs * 1.2;
    const lines = Math.max(1, Math.round(el.scrollHeight / lineH));
    const card = el.closest('.card-view');
    const cardClip = card ? card.scrollHeight - card.clientHeight : 0;
    out.push({
      text: raw.replace(/­/g, '¬').trim().slice(0, 34),
      shy: raw.includes('­'),
      fs, lines,
      dW: el.scrollWidth - el.clientWidth,
      cardClip,
      ctx: ctxOf(el),
    });
  }
  return out;
};

function report(label, rows, badSink, namesSink, steppedSink) {
  for (const r of rows) {
    namesSink.add(`${r.text} @${r.ctx}`);
    if (r.fs < 16) steppedSink.add(`${r.text} fs=${r.fs} ctx=${r.ctx} lines=${r.lines}`);
  }
  const bad = rows.filter((r) => r.shy || r.dW > 1 || r.lines > 3 || r.fs < 14 || r.cardClip > 1);
  badSink.n += bad.length;
  console.log(`[${sizeKey}/${label}] names=${rows.length} bad=${bad.length}`);
  for (const b of bad)
    console.log(`  BAD ctx=${b.ctx} "${b.text}" shy=${b.shy} fs=${b.fs} lines=${b.lines} dW=${b.dW} cardClip=${b.cardClip}`);
}

const browser = await chromium.launch({ args: GL_ARGS });
const badSink = { n: 0 };
const namesSink = new Set();
const steppedSink = new Set();

if (feastMode) {
  const { ctx, page } = await startPage(browser, seedFrom);
  const advance = () =>
    page.evaluate(() => {
      const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
      const no = document.querySelector('[data-testid="proposal-no"]');
      if (vis(no)) { no.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
      const p = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
      if (p) { p.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
      const k = [...document.querySelectorAll('[data-key]')].filter(vis);
      if (k.length) k[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).catch(() => {});
  await jumpTo(page, 8, 'panel-cook', 3);
  let gotFeast = false;
  for (let i = 0; i < 120 && !gotFeast; i++) {
    if (await page.locator('[data-testid="screen-feast"]').count()) { gotFeast = true; break; }
    await advance();
    await page.waitForTimeout(450);
  }
  console.log(`[${sizeKey}/feast] reached=${gotFeast}`);
  if (gotFeast) {
    await page.waitForTimeout(1500);
    report('feast', await page.evaluate(SCAN_FN), badSink, namesSink, steppedSink);
    let gotReflect = false;
    for (let i = 0; i < 60 && !gotReflect; i++) {
      if (await page.locator('[data-testid="screen-reflection"]').count()) { gotReflect = true; break; }
      await advance();
      await page.waitForTimeout(450);
    }
    console.log(`[${sizeKey}/reflection] reached=${gotReflect}`);
    if (gotReflect) {
      await page.waitForTimeout(1800);
      report('reflection', await page.evaluate(SCAN_FN), badSink, namesSink, steppedSink);
    }
  }
  await ctx.close();
} else {
  const stations = [
    [1, null, 'station1'],
    [4, null, 'station4'],
    [6, null, 'station6'],
    [2, 'panel-market', 'market'],
    [3, 'panel-partner', 'partner'],
    [5, 'panel-event', 'event'],
    [7, 'panel-store', 'store'],
    [8, 'panel-cook', 'cook'],
  ];
  for (let seed = seedFrom; seed <= seedTo; seed++) {
    const { ctx, page } = await startPage(browser, seed);
    for (const [idx, testid, label] of stations) {
      const ok = await jumpTo(page, idx, testid, 1);
      await page.waitForTimeout(900);
      const panelNow = await page.evaluate(() => {
        const p = document.querySelector('.popup [data-testid^="panel-"]');
        return p ? p.getAttribute('data-testid') : null;
      });
      report(`${label}${panelNow ? ':' + panelNow : ''} seed${seed} jump=${ok}`, await page.evaluate(SCAN_FN), badSink, namesSink, steppedSink);
    }
    await ctx.close();
  }
}
console.log(`TOTAL bad=${badSink.n}`);
console.log(`names seen (${namesSink.size}): ${[...namesSink].join(' | ')}`);
console.log(`stepped-down or small (${steppedSink.size}): ${[...steppedSink].join(' | ')}`);
await browser.close();
