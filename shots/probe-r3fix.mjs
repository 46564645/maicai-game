/** probe-r3fix.mjs — ww 第 3 轮（4a34d06 驳回）修复的量测探针。
 * Usage:
 *   node shots/probe-r3fix.mjs market-874        必改1：手机市场浮层/竖栏安全区边量测
 *   node shots/probe-r3fix.mjs weather-<size>    必改3：天气结果两缩略卡名 + 故事卡 Tap 钮
 *   node shots/probe-r3fix.mjs wallet-667        必改4b：667 钱包「My coins」× 金币图标重叠
 *   node shots/probe-r3fix.mjs reflect-667       必改4a：667 感想标题 × 语言开关重叠（长驱动）
 *   node shots/probe-r3fix.mjs toast-<size>      必改2：toast × 按钮重叠狩猎（驱动中轮询）
 * size ∈ 667|874|1024|1280|1440。前置：npm run build 后 vite preview 在 4173。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[2];
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';

const SIZES = {
  '667': { w: 667, h: 375, phone: true, safe: false },
  '874': { w: 874, h: 402, phone: true, safe: true },
  '1024': { w: 1024, h: 768, phone: false, safe: false },
  '1280': { w: 1280, h: 800, phone: false, safe: false },
  '1440': { w: 1440, h: 900, phone: false, safe: false },
};
const [screen, sizeKey] = MODE.split('-');
const SIZE = SIZES[sizeKey];
if (!SIZE) { console.error('bad mode', MODE); process.exit(1); }

async function shot(page, file) {
  const full = path.join(OUT, file);
  try {
    await page.screenshot({ path: full, timeout: 60_000, animations: 'disabled' });
    console.log(`  shot ${file}`);
    return true;
  } catch (e) {
    console.log(`  shot ${file} failed: ${String(e).slice(0, 80)}`);
    return false;
  }
}

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

async function startPage(browser) {
  const ctx = SIZE.phone
    ? await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, hasTouch: true, isMobile: true })
    : await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await page.addInitScript(() => {
    try { window.localStorage.setItem('maicai-lang', 'en'); } catch { /* ignore */ }
  });
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  if (SIZE.safe) await page.addStyleTag({ content: SAFE_CSS });
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(3000);
  return { ctx, page };
}

const R = (r) => r ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) } : null;
function overlap(a, b) {
  if (!a || !b) return 0;
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
  return Math.round(x * y * 10) / 10;
}

const browser = await chromium.launch({ args: GL_ARGS });

/* ================= 必改1：手机市场安全区 ================= */
if (MODE === 'market-874') {
  const { ctx, page } = await startPage(browser);
  const ok = await jumpTo(page, 2, 'panel-market', 1);
  console.log('  jump market ok =', ok);
  await page.locator('.phone-market-float [data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(900);
  // 选中第一张卡（购买行/算式出现）
  const firstCard = page.locator('.phone-market-float [data-testid^="action-stall-"]').first();
  if ((await firstCard.count()) > 0) await firstCard.click().catch(() => {});
  await page.waitForTimeout(600);
  const data = await page.evaluate(() => {
    const RR = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    const cards = [...document.querySelectorAll('.phone-market-float [data-testid^="action-stall-"]')].map(RR);
    const buy = RR(document.querySelector('.phone-market-float [data-testid="action-primary"]'));
    const hold = RR(document.querySelector('.phone-market-float .drop-zone--hold'));
    const skip = RR(document.querySelector('.phone-market-float .drop-row > .btn'));
    const done = RR(document.querySelector('.phone-market-float .btn--navy'));
    const stack = RR(document.querySelector('.phone-float-stack'));
    const float = RR(document.querySelector('.phone-market-float'));
    // 竖栏内可交互元素（按钮/开关）的最右缘
    const railEls = [...document.querySelectorAll('.phone-rail button, .phone-rail .lang-toggle')].map((el) => ({ cls: el.className?.toString().slice(0, 30), text: (el.textContent ?? '').trim().slice(0, 16), rect: RR(el) })).filter((e) => e.rect && e.rect.w > 0);
    const rail = RR(document.querySelector('.phone-rail'));
    const toggle = RR(document.querySelector('.phone-rail .lang-toggle'));
    return { cards, buy, hold, skip, done, stack, float, rail, toggle, railEls };
  });
  const lefts = [...data.cards.map((c) => c.x), data.buy?.x, data.done?.x, data.hold?.x].filter((v) => v !== undefined && v !== null);
  console.log('  float rect:', JSON.stringify(data.float), ' stack:', JSON.stringify(data.stack));
  console.log('  cards x:', data.cards.map((c) => c.x).join(', '));
  console.log('  buy:', JSON.stringify(data.buy), '\n  hold:', JSON.stringify(data.hold), '\n  skip:', JSON.stringify(data.skip), '\n  done:', JSON.stringify(data.done));
  console.log(`  >>> min left edge (fan/Buy/Done/Hold) = ${Math.min(...lefts)}px （安全区左界 62）`);
  console.log('  rail rect:', JSON.stringify(data.rail), ' toggle:', JSON.stringify(data.toggle));
  const maxRight = Math.max(...data.railEls.map((e) => e.rect.right));
  console.log(`  >>> rail interactive max right edge = ${maxRight}px （安全区右界 812）`);
  for (const e of data.railEls) if (e.rect.right > 800) console.log('    near-edge:', e.cls, `"${e.text}"`, JSON.stringify(e.rect));
  const ys = [...data.cards.map((c) => c.y), data.stack?.y].filter((v) => v != null);
  const yb = [...data.cards.map((c) => c.bottom), data.done?.bottom].filter((v) => v != null);
  console.log(`  >>> float content y range = ${Math.min(...ys)} .. ${Math.max(...yb)} （安全区 20..382）`);
  await shot(page, 'r10e_r3fix_market_874.png');
  await ctx.close();
}

/* ================= 必改3：天气结果 ================= */
if (screen === 'weather') {
  const { ctx, page } = await startPage(browser);
  const ok = await jumpTo(page, 5, 'panel-event', 1);
  console.log('  jump event ok =', ok);
  // S-5：转盘相位里 .weather-result 标题就在 DOM（落点名已定）——
  // 趁 spin 相位截标题元素图 + 读计算样式（PIL 像素级测对比在外部做）
  {
    const tw = Date.now();
    let got = false;
    while (Date.now() - tw < 30_000 && !got) {
      const info = await page.evaluate(() => {
        const el = document.querySelector('.weather-result');
        if (!el || el.getClientRects().length === 0) return null;
        const cs = getComputedStyle(el);
        return { text: el.textContent.trim(), bg: cs.backgroundColor, color: cs.color };
      });
      if (info && info.text.includes('It is')) {
        console.log('  [weather-result]', JSON.stringify(info));
        await page.locator('.weather-result').first().screenshot({ path: `shots/tmp_weather_result_${sizeKey}.png` }).catch((e) => console.log('  wr shot fail', e.message));
        got = true;
      } else {
        await page.waitForTimeout(120);
      }
    }
    if (!got) console.log('  [weather-result] NOT CAPTURED');
  }
  // 等天气大卡（结果）出现
  let phase = 'none';
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000) {
    phase = await page.evaluate(() => {
      const vis = (el) => !!el && el.getClientRects().length > 0;
      if (vis(document.querySelector('[data-testid="weather-card"]'))) return 'card';
      if (vis(document.querySelector('[data-testid="weather-spinner"]'))) return 'spin';
      return 'none';
    });
    if (phase === 'card') break;
    await page.waitForTimeout(250);
  }
  console.log('  moment phase =', phase);
  await page.waitForTimeout(600);
  const momentData = await page.evaluate(() => {
    const RR = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    const name = document.querySelector('.moment-card .card-view-name');
    const tap = document.querySelector('.moment-tap');
    return {
      momentName: name ? { text: name.textContent.trim(), dW: name.scrollWidth - name.clientWidth, dH: name.scrollHeight - name.clientHeight, rect: RR(name), fs: getComputedStyle(name).fontSize } : null,
      momentTap: tap ? { text: tap.textContent.trim(), rect: RR(tap) } : null,
      momentCard: RR(document.querySelector('.moment-card')),
    };
  });
  console.log('  [moment]', JSON.stringify(momentData, null, 1));
  // 点掉天气大卡 → 结果舞台（天气缩略卡 + 牌堆/故事卡）
  await page.locator('[data-testid="weather-card"]').dispatchEvent('click').catch(() => {});
  await page.waitForTimeout(1200);
  // 等天气缩略卡入场动画（延迟 = wheel-ms + 120ms，backwards 填充会
  // 先缩 0.7）彻底落定再量名——动画中途的 bbox 是缩放值，不作数
  await page.evaluate(async () => {
    const el = document.querySelector('.event-weather');
    if (el) await Promise.allSettled(el.getAnimations().map((a) => a.finished));
  }).catch(() => {});
  await page.waitForTimeout(300);
  const stageData = await page.evaluate(() => {
    const RR = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    const nameInfo = (root) => {
      const n = root?.querySelector('.card-view-name');
      if (!n) return null;
      return { text: n.textContent.trim(), dW: n.scrollWidth - n.clientWidth, dH: n.scrollHeight - n.clientHeight, rect: RR(n), fs: getComputedStyle(n).fontSize, whiteSpace: getComputedStyle(n).whiteSpace };
    };
    return {
      weatherThumb: RR(document.querySelector('.event-weather')),
      weatherName: nameInfo(document.querySelector('.event-weather')),
      deckName: nameInfo(document.querySelector('.deck')),
      deck: RR(document.querySelector('.deck')),
    };
  });
  console.log('  [stage/deck]', JSON.stringify(stageData, null, 1));
  await shot(page, `r10e_r3fix_weather_stage_${sizeKey}.png`);
  // 翻开牌堆 → 故事卡
  const deckBtn = page.locator('[data-testid="action-primary"]').first();
  if ((await deckBtn.count()) > 0) await deckBtn.dispatchEvent('click').catch(() => {});
  await page.waitForTimeout(1200);
  // 等故事卡入场弹跳动画（scale 0.82→1）落定再量按钮——动画中途
  // 的 bbox 带缩放，不作数（874 首测 tap 45.6 即此污染） */
  await page.evaluate(async () => {
    const el = document.querySelector('.event-story');
    if (el) await Promise.allSettled(el.getAnimations().map((a) => a.finished));
  }).catch(() => {});
  await page.waitForTimeout(300);
  const storyData = await page.evaluate(() => {
    const RR = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    const art = document.querySelector('.event-story-art');
    const n = art?.querySelector('.card-view-name');
    const text = document.querySelector('.event-story-text');
    const tap = document.querySelector('.event-story-next');
    return {
      story: RR(document.querySelector('.event-story')),
      artName: n ? { text: n.textContent.trim(), dW: n.scrollWidth - n.clientWidth, dH: n.scrollHeight - n.clientHeight, rect: RR(n), fs: getComputedStyle(n).fontSize, whiteSpace: getComputedStyle(n).whiteSpace } : null,
      artCard: RR(art),
      weatherName: (() => { const w = document.querySelector('.event-weather .card-view-name'); return w ? { text: w.textContent.trim(), dW: w.scrollWidth - w.clientWidth, dH: w.scrollHeight - w.clientHeight } : null; })(),
      text: text ? { content: text.textContent.trim().slice(0, 40), rect: RR(text) } : null,
      tap: tap ? { content: tap.textContent.trim(), rect: RR(tap), fs: getComputedStyle(tap).fontSize } : null,
    };
  });
  console.log('  [story]', JSON.stringify(storyData, null, 1));
  if (storyData.text && storyData.tap) {
    const below = storyData.tap.rect.y >= storyData.text.rect.bottom - 1;
    console.log(`  >>> tap below text? ${below} （tap.y=${storyData.tap.rect.y} vs text.bottom=${storyData.text.rect.bottom}）; tap height = ${storyData.tap.rect.h}px （目标 ≥48）`);
  }
  await shot(page, `r10e_r3fix_weather_story_${sizeKey}.png`);
  await ctx.close();
}

/* ================= 必改4b：667 钱包 ================= */
if (MODE === 'wallet-667') {
  const { ctx, page } = await startPage(browser);
  // 点钱包圆钮开抽屉
  const fab = page.locator('.phone-fab').first();
  await fab.click().catch(() => {});
  await page.waitForTimeout(1200);
  const data = await page.evaluate(() => {
    const RR = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    const count = document.querySelector('.popup .coins-count');
    const row = document.querySelector('.popup .coins-row');
    const coins = [...document.querySelectorAll('.popup .coins-row .coin')].map(RR);
    const coinsBox = document.querySelector('.popup .coins');
    return { count: count ? { text: count.textContent.trim(), rect: RR(count) } : null, row: RR(row), coinsBox: RR(coinsBox), coins: coins.slice(0, 14), popup: RR(document.querySelector('.app-shell--phone-land > .popup-backdrop > .popup, .popup')) };
  });
  console.log(JSON.stringify(data, null, 1));
  if (data.count) {
    let worst = 0; let worstI = -1;
    data.coins.forEach((c, i) => { const o = overlap(data.count.rect, c); if (o > worst) { worst = o; worstI = i; } });
    console.log(`  >>> coins-count × coin icon worst overlap = ${worst}px² (coin #${worstI})`);
  }
  await shot(page, 'r10e_r3fix_wallet_667.png');
  await ctx.close();
}

/* ================= 必改4a：667 感想标题 ================= */
if (MODE === 'reflect-667') {
  const { ctx, page } = await startPage(browser);
  const ok = await jumpTo(page, 8, 'panel-cook', 3);
  console.log('  jump cook-lap3 ok =', ok);
  const STATE_FN = () => ({
    reflection: !!document.querySelector('[data-testid="screen-reflection"]'),
    feast: !!document.querySelector('[data-testid="screen-feast"]'),
    pill: !!document.querySelector('[data-testid="await-proposal"]'),
    botThinking: !!document.querySelector('.bot-card--thinking, .phone-bot--on'),
  });
  const advance = () => page.evaluate(() => {
    const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
    const no = document.querySelector('[data-testid="proposal-no"]');
    if (vis(no)) { no.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
    const primary = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
    if (primary) { primary.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
    const keyed = [...document.querySelectorAll('[data-key]')].filter(vis);
    if (keyed.length) {
      const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  }).catch(() => {});
  const t0 = Date.now();
  let lastAdvance = 0; let reached = false;
  while (Date.now() - t0 < 900_000) {
    const s = await page.evaluate(STATE_FN).catch(() => null);
    if (s?.reflection) {
      const hasOpts = await page.locator('.reflection-options .hand-item').count().catch(() => 0);
      if (hasOpts >= 5) { reached = true; break; }
    }
    if (s && !s.botThinking && !s.reflection) {
      const now = Date.now();
      if (now - lastAdvance >= 250) { lastAdvance = now; await advance(); }
    }
    await page.waitForTimeout(150);
  }
  console.log('  reflection reached =', reached, `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  if (reached) {
    const closeBtn = page.locator('[data-testid="demo-close"]');
    if ((await closeBtn.count()) > 0) await closeBtn.dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(1200);
    const data = await page.evaluate(() => {
      const RR = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
      };
      const title = document.querySelector('[data-testid="screen-reflection"] .intro-title');
      const toggle = document.querySelector('.lang-toggle--corner, .lang-toggle');
      return { title: title ? { text: title.textContent.trim(), rect: RR(title), fs: getComputedStyle(title).fontSize } : null, toggle: RR(toggle) };
    });
    console.log(JSON.stringify(data, null, 1));
    if (data.title && data.toggle) console.log(`  >>> title × toggle overlap = ${overlap(data.title.rect, data.toggle)}px²`);
    await shot(page, 'r10e_r3fix_reflect_667.png');
  }
  await ctx.close();
}

/* ================= 必改2：toast × 按钮重叠狩猎 ================= */
if (screen === 'toast') {
  const { ctx, page } = await startPage(browser);
  // 桌面：跳到市场后开始驱动全局（bot 回合会产生购买 toast）；手机：市场浮层开着时买卡也会产生 toast
  if (SIZE.phone) {
    await jumpTo(page, 2, 'panel-market', 1);
    await page.locator('[data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
  }
  const MEASURE_FN = () => {
    const toast = document.querySelector('.toast-stack .toast');
    if (!toast) return null;
    if (getComputedStyle(document.querySelector('.toast-stack')).visibility === 'hidden') return null;
    if (getComputedStyle(toast).visibility === 'hidden') return null;
    const tr = toast.getBoundingClientRect();
    if (tr.width === 0) return null;
    const T = { x: tr.x, y: tr.y, right: tr.right, bottom: tr.bottom, h: tr.height };
    const hits = [];
    for (const el of document.querySelectorAll('button, [role="button"]')) {
      if (el.closest('[data-testid="demo-bar"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const ox = Math.max(0, Math.min(T.right, r.right) - Math.max(T.x, r.x));
      const oy = Math.max(0, Math.min(T.bottom, r.bottom) - Math.max(T.y, r.y));
      if (ox * oy > 0) hits.push({ cls: el.className?.toString().slice(0, 34), text: (el.textContent ?? '').trim().slice(0, 22), area: Math.round(ox * oy * 10) / 10 });
    }
    const toggle = document.querySelector('.lang-toggle');
    let toggleHit = 0;
    if (toggle) {
      const r = toggle.getBoundingClientRect();
      const ox = Math.max(0, Math.min(T.right, r.right) - Math.max(T.x, r.x));
      const oy = Math.max(0, Math.min(T.bottom, r.bottom) - Math.max(T.y, r.y));
      toggleHit = Math.round(ox * oy * 10) / 10;
    }
    const zToast = getComputedStyle(document.querySelector('.toast-stack')).zIndex;
    return { toastText: toast.textContent.trim().slice(0, 40), toastRect: { x: Math.round(T.x), y: Math.round(T.y), w: Math.round(tr.width), h: Math.round(T.h) }, zToast, hits, toggleHit };
  };
  const seen = [];
  const t0 = Date.now();
  let lastAdvance = 0;
  const advance = () => page.evaluate(() => {
    const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
    const no = document.querySelector('[data-testid="proposal-no"]');
    if (vis(no)) { no.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
    const primary = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
    if (primary) { primary.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
    const keyed = [...document.querySelectorAll('[data-key]')].filter(vis);
    if (keyed.length) {
      const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  }).catch(() => {});
  while (Date.now() - t0 < 240_000 && seen.length < 14) {
    const m = await page.evaluate(MEASURE_FN).catch(() => null);
    if (m && !seen.some((s) => s.toastText === m.toastText && Math.abs(s.toastRect.y - m.toastRect.y) < 4)) {
      seen.push(m);
      console.log(`  [toast] "${m.toastText}" rect=${JSON.stringify(m.toastRect)} z=${m.zToast} toggleOverlap=${m.toggleHit}px² btnHits=${JSON.stringify(m.hits)}`);
      if (m.hits.length > 0 || m.toggleHit > 0) await shot(page, `r10e_r3fix_toast_hit_${sizeKey}_${seen.length}.png`);
    }
    const thinking = await page.evaluate(() => !!document.querySelector('.bot-card--thinking, .phone-bot--on')).catch(() => false);
    const now = Date.now();
    if (!thinking && now - lastAdvance >= 900) { lastAdvance = now; await advance(); }
    await page.waitForTimeout(120);
  }
  console.log(`  toast samples = ${seen.length}; with button hits = ${seen.filter((s) => s.hits.length).length}; with toggle hits = ${seen.filter((s) => s.toggleHit > 0).length}`);
  await ctx.close();
}

/* ================= 浮层栈子元素宽度分解 ================= */
if (MODE === 'stack-874') {
  const { ctx, page } = await startPage(browser);
  await jumpTo(page, 2, 'panel-market', 1);
  await page.locator('.phone-market-float [data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(800);
  const firstCard = page.locator('.phone-market-float [data-testid^="action-stall-"]').first();
  if ((await firstCard.count()) > 0) await firstCard.click().catch(() => {});
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => {
    const RR = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), w: +r.width.toFixed(1), right: +r.right.toFixed(1), h: +r.height.toFixed(1) }; };
    return {
      kids: [...document.querySelectorAll('.phone-float-stack > *')].map((el) => ({ cls: el.className?.toString().slice(0, 30), ...RR(el) })),
      handItems: [...document.querySelectorAll('.phone-market-float .hand-item')].map(RR),
      hand: RR(document.querySelector('.phone-market-float .stall-hand')),
      guide: RR(document.querySelector('.phone-market-float .stall-guide')),
      fanBlock: RR(document.querySelector('.phone-market-float .stall-fan-block')),
      row: RR(document.querySelector('.phone-market-float .drop-row')),
      rowKids: [...document.querySelectorAll('.phone-market-float .drop-row > *')].map((el) => ({ cls: el.className?.toString().slice(0, 26), text: (el.textContent ?? '').trim().slice(0, 18), ...RR(el) })),
    };
  });
  console.log(JSON.stringify(data, null, 1));
  await ctx.close();
}

/* ================= S-3：Done 下缘距屏底 ================= */
if (screen === 'done') {
  const { ctx, page } = await startPage(browser);
  const ok = await jumpTo(page, 2, 'panel-market', 1);
  console.log('  jump market ok =', ok);
  await page.locator('[data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(900);
  const d = await page.evaluate(() => {
    const done = document.querySelector('.phone-market-float .btn--navy');
    const stack = document.querySelector('.phone-float-stack');
    if (!done) return null;
    const r = done.getBoundingClientRect();
    const s = stack?.getBoundingClientRect();
    return { doneBottom: +r.bottom.toFixed(1), doneDistFromBottom: +(window.innerHeight - r.bottom).toFixed(1), stackH: s ? +s.height.toFixed(1) : null, stackY: s ? +s.y.toFixed(1) : null };
  });
  console.log(`  [done ${sizeKey}]`, JSON.stringify(d), '（目标：距屏底 ≥20px）');
  await ctx.close();
}

/* ================= S-4：市场导引句 × 金币条标签 ================= */
if (screen === 'tags') {
  const { ctx, page } = await startPage(browser);
  const ok = await jumpTo(page, 2, 'panel-market', 1);
  console.log('  jump market ok =', ok);
  await page.waitForTimeout(1000);
  const card = page.locator('.stall-hand .hand-item .card-view, .phone-float-stack .hand-item .card-view').first();
  if ((await card.count()) > 0) await card.dispatchEvent('click').catch(() => {});
  await page.waitForTimeout(700);
  const measureTags = () => page.evaluate(() => {
    const RR = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    const vis = (el) => {
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const guide = document.querySelector('.stall-guide');
    const tags = [...document.querySelectorAll('.coin-bar *')].filter((el) => el.children.length === 0 && (el.textContent ?? '').trim()).map((el) => ({ cls: el.className?.toString().slice(0, 30), text: el.textContent.trim().slice(0, 20), rect: RR(el), vis: vis(el) }));
    const handTag = document.querySelector('.hand-tag');
    const foot = document.querySelector('.panel-foot');
    const body = document.querySelector('.panel-body');
    const coinbar = document.querySelector('.coin-bar');
    return {
      guide: guide ? { text: guide.textContent.trim().slice(0, 44), rect: RR(guide), vis: vis(guide) } : null,
      handTag: handTag ? { text: handTag.textContent.trim(), rect: RR(handTag) } : null,
      foot: foot ? { rect: RR(foot), bg: getComputedStyle(foot).backgroundColor } : null,
      body: body ? { rect: RR(body), sh: body.scrollHeight, ch: body.clientHeight } : null,
      coinbar: coinbar ? { rect: RR(coinbar) } : null,
      tags,
    };
  });
  const report = (data, label) => {
    console.log(`  [${label}] guide:`, JSON.stringify(data.guide));
    console.log(`  [${label}] foot:`, JSON.stringify(data.foot), 'body:', JSON.stringify(data.body), 'coinbar:', JSON.stringify(data.coinbar));
    for (const t of data.tags) {
      if (!t.vis) { console.log(`  tag "${t.text}" HIDDEN (not rendered)`); continue; }
      const o = data.guide && data.guide.vis ? overlap(data.guide.rect, t.rect) : 0;
      const o2 = data.handTag ? overlap(data.handTag.rect, t.rect) : 0;
      console.log(`  tag "${t.text}" (${t.cls}) rect=${JSON.stringify(t.rect)} overlapGuide=${o}px² overlapHandTag=${o2}px²`);
    }
  };
  report(await measureTags(), 'unscrolled');
  // 滚动态：面板体滚到底（导引句滑向吸底 foot 的状态）
  await page.evaluate(() => {
    const body = document.querySelector('.popup-body') ?? document.querySelector('.popup');
    if (body) body.scrollTop = body.scrollHeight;
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = rail.scrollHeight;
  });
  await page.waitForTimeout(500);
  report(await measureTags(), 'scrolled');
  await shot(page, `r10e_r3fix_tags_${sizeKey}.png`);
  await ctx.close();
}

/* ================= S-1：卡名/标签对裁剪祖先的有效溢出 ================= */
if (screen === 'names') {
  const { ctx, page } = await startPage(browser);
  const NAME_FN = () => {
    const out = [];
    const clipW = (el, stopSel) => {
      // 沿祖先找最近的 overflow:hidden 裁剪者（横幅/底板/卡面），取其 clientWidth
      let node = el.parentElement;
      while (node && !node.matches(stopSel)) {
        const cs = getComputedStyle(node);
        if (cs.overflowX === 'hidden' || cs.overflow === 'hidden') return node.clientWidth;
        node = node.parentElement;
      }
      return el.clientWidth;
    };
    for (const card of document.querySelectorAll('.card-view')) {
      if (card.getClientRects().length === 0) continue;
      const cs = getComputedStyle(card);
      if (cs.visibility === 'hidden') continue;
      for (const sel of ['.card-view-name', '.card-view-tag']) {
        const el = card.querySelector(sel);
        if (!el || !el.textContent.trim()) continue;
        const cw = clipW(el, '.card-view');
        out.push({
          sel,
          text: el.textContent.trim().replace(/\u00AD/g, '¬').slice(0, 26),
          dW: el.scrollWidth - cw,
          fs: getComputedStyle(el).fontSize,
          ws: getComputedStyle(el).whiteSpace,
        });
      }
    }
    return out;
  };
  const stations = [
    [2, 'panel-market', 'market'],
    [7, 'panel-store', 'store'],
    [3, 'panel-partner', 'partner'],
    [5, 'panel-event', 'event'],
  ];
  for (const [idx, testid, label] of stations) {
    const ok = await jumpTo(page, idx, testid, 1);
    await page.waitForTimeout(900);
    const rows = await page.evaluate(NAME_FN);
    const bad = rows.filter((r) => r.dW > 0);
    console.log(`  [names ${sizeKey}/${label}] jump=${ok} cards-texts=${rows.length} clipped=${bad.length}`);
    for (const b of bad) console.log(`    CLIP ${b.sel} "${b.text}" dW=${b.dW} fs=${b.fs} ws=${b.ws}`);
  }
  await ctx.close();
}

/* ================= S-6：手机布局债 ================= */
if (screen === 'rail') {
  const { ctx, page } = await startPage(browser);
  const measure = async (label) => {
    const d = await page.evaluate(() => {
      const gs = document.querySelector('.game-screen');
      const rail = document.querySelector('.phone-rail');
      const cs = gs ? getComputedStyle(gs) : null;
      return {
        gameScreenH: gs ? gs.getBoundingClientRect().height : null,
        gameScreenComputedH: cs?.height ?? null,
        railSH: rail?.scrollHeight ?? null,
        railCH: rail?.clientHeight ?? null,
        railOverflow: rail ? rail.scrollHeight - rail.clientHeight : null,
        docH: document.documentElement.scrollHeight,
        bodyH: document.body.scrollHeight,
      };
    });
    console.log(`  [rail ${label}]`, JSON.stringify(d));
    return d;
  };
  await measure('base-no-popup');
  const ok = await jumpTo(page, 2, 'panel-market', 1);
  console.log('  jump market ok =', ok);
  await page.waitForTimeout(800);
  await measure('market-popup');
  await ctx.close();
}

await browser.close();
console.log('done');
