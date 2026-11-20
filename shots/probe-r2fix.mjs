/** probe-r2fix.mjs — ww 第 2 轮截图验收修复（r2fix）的量测探针。
 * Usage:
 *   node shots/probe-r2fix.mjs market-phone     手机市场：卡扇/chrome/气泡/导引/按钮矩形 + 重叠量测
 *   node shots/probe-r2fix.mjs weather-phone    手机天气：结果卡浮层归属/站名浮签入镜/棋盘压暗 + 对比度比值（环带口径，同 probe-e1-contrast）
 *   node shots/probe-r2fix.mjs market-desktop   桌面市场：选中卡名签 vs .popup-body 裁切量测
 *   node shots/probe-r2fix.mjs reflect-desktop|reflect-phone  感想页：五卡标签可读性量测（+ --open 拍选中展开态）
 * 前置：npm run build 后 vite preview 在 4173。
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

async function shot(page, file) {
  const full = path.join(OUT, file);
  const methods = [
    async () => { await page.screenshot({ path: full, timeout: 60_000 }); return 'pw'; },
    async () => {
      const cdp = await page.context().newCDPSession(page);
      const res = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('cap 60s')), 60_000)),
      ]);
      fs.writeFileSync(full, Buffer.from(res.data, 'base64'));
      return 'cdp-surface';
    },
    async () => {
      const cdp = await page.context().newCDPSession(page);
      const res = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('cap 60s')), 60_000)),
      ]);
      fs.writeFileSync(full, Buffer.from(res.data, 'base64'));
      return 'cdp-nosurface';
    },
  ];
  for (let round = 1; round <= 2; round++) {
    for (const m of methods) {
      try {
        const tag = await m();
        console.log(`  shot ${file} (${tag}, round ${round})`);
        return true;
      } catch (e) {
        console.log(`  shot ${file} failed: ${String(e).slice(0, 80)}`);
      }
    }
    await page.waitForTimeout(4000).catch(() => {});
  }
  return false;
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

async function startPage(browser, { phone, lang = 'en' }) {
  const ctx = phone
    ? await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true })
    : await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await page.addInitScript((l) => {
    try {
      window.localStorage.setItem('maicai-lang', l);
    } catch { /* ignore */ }
  }, lang);
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  if (phone) await page.addStyleTag({ content: SAFE_CSS });
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(3000);
  return { ctx, page };
}

const RECTS_FN = (sels) => {
  const out = {};
  for (const [key, sel] of Object.entries(sels)) {
    const els = [...document.querySelectorAll(sel)];
    out[key] = els.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        x: Math.round(r.x * 10) / 10,
        y: Math.round(r.y * 10) / 10,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        right: Math.round(r.right * 10) / 10,
        bottom: Math.round(r.bottom * 10) / 10,
        display: cs.display,
        visibility: cs.visibility,
        text: (el.textContent ?? '').trim().slice(0, 44),
      };
    });
  }
  return out;
};

function overlap(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
  return Math.round(x * y * 10) / 10;
}

/* ---------- 对比度（环带口径，复制自 probe-e1-contrast） ---------- */
function parseColor(s) {
  if (!s) return null;
  s = s.trim();
  let m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3) return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  m = s.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    return { r: Number(m[1]) * 255, g: Number(m[2]) * 255, b: Number(m[3]) * 255, a };
  }
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  return null;
}
const overC = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});
function relLum({ r, g, b }) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrastOf = (c1, c2) => {
  const [l1, l2] = [relLum(c1), relLum(c2)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
};
const fmtC = (c) => (c ? `rgb(${c.r.toFixed(0)},${c.g.toFixed(0)},${c.b.toFixed(0)}${c.a < 1 ? `,a=${c.a.toFixed(2)}` : ''})` : 'none');

const STYLE_FN = (sel) => {
  const els = [...document.querySelectorAll(sel)];
  const el = els.find((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  });
  if (!el) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    sel,
    text: (el.textContent ?? '').trim().slice(0, 40),
    color: cs.color,
    bg: cs.backgroundColor,
    opacity: Number(cs.opacity),
    fontSize: cs.fontSize,
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
  };
};

const RING_FN = async ({ b64, rect, vw, vh }) => {
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = `data:image/png;base64,${b64}`;
  });
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const sx = img.naturalWidth / vw;
  const sy = img.naturalHeight / vh;
  const cx0 = Math.max(0, rect.x);
  const cy0 = Math.max(0, rect.y);
  const cx1 = Math.min(vw, rect.x + rect.w);
  const cy1 = Math.min(vh, rect.y + rect.h);
  const R = { x: cx0 * sx, y: cy0 * sy, w: Math.max(1, (cx1 - cx0) * sx), h: Math.max(1, (cy1 - cy0) * sy) };
  const lum = (r, g, b) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const pts = [];
  const x0 = Math.max(0, Math.floor(R.x - 16 * sx));
  const x1 = Math.min(cv.width - 1, Math.ceil(R.x + R.w + 16 * sx));
  const y0 = Math.max(0, Math.floor(R.y - 16 * sy));
  const y1 = Math.min(cv.height - 1, Math.ceil(R.y + R.h + 16 * sy));
  const data = cx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1).data;
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      const inX = x >= R.x - 4 * sx && x <= R.x + R.w + 4 * sx;
      const inY = y >= R.y - 4 * sy && y <= R.y + R.h + 4 * sy;
      if (inX && inY) continue;
      const i = ((y - y0) * (x1 - x0 + 1) + (x - x0)) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      pts.push({ r, g, b, L: lum(r, g, b) });
    }
  }
  if (pts.length === 0) return null;
  pts.sort((a, b2) => a.L - b2.L);
  const p95 = pts[Math.min(pts.length - 1, Math.floor(pts.length * 0.95))];
  const max = pts[pts.length - 1];
  return { n: pts.length, p95: { r: p95.r, g: p95.g, b: p95.b }, max: { r: max.r, g: max.g, b: max.b } };
};

async function contrastRows(page, vw, vh, sels) {
  const styles = [];
  for (const sel of sels) {
    const st = await page.evaluate(STYLE_FN, sel).catch(() => null);
    if (st) styles.push(st);
    else console.log(`  [contrast] 未找到 ${sel}`);
  }
  if (!styles.length) return [];
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  const rows = [];
  for (const st of styles) {
    const ring = await page.evaluate(RING_FN, { b64: res.data, rect: st.rect, vw, vh }).catch(() => null);
    const fg = parseColor(st.color);
    const ownBg = parseColor(st.bg);
    for (const [tag, px] of ring ? [['worst(max)', ring.max], ['p95', ring.p95]] : [['no-ring', null]]) {
      let effBg = px ? { ...px, a: 1 } : null;
      if (effBg && ownBg && ownBg.a > 0) effBg = overC(ownBg, effBg);
      let effFg = fg;
      if (effBg && fg && st.opacity < 1) effFg = overC({ ...fg, a: fg.a * st.opacity }, effBg);
      rows.push({
        element: st.sel,
        text: st.text,
        basis: tag,
        fg: fmtC(fg),
        ownBg: fmtC(ownBg),
        ringPx: px ? fmtC({ ...px, a: 1 }) : 'n/a',
        contrastRatio: effBg && effFg ? Number(contrastOf(effFg, effBg).toFixed(2)) : null,
      });
    }
  }
  return rows;
}

/* ================= 主流程 ================= */
const browser = await chromium.launch({ args: GL_ARGS });

if (MODE === 'market-phone') {
  const { ctx, page } = await startPage(browser, { phone: true });
  await jumpTo(page, 2, 'panel-market', 1);
  await page.locator('[data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(1200);
  const data = await page.evaluate(RECTS_FN, {
    lap: '.phone-lap',
    bots: '.phone-bot',
    bubbles: '.think-bubble--phone',
    cards: '.phone-market-float [data-testid^="action-stall-"]',
    tag: '.phone-market-float .hand-tag',
    guide: '.phone-market-float .stall-guide',
    float: '.phone-market-float',
    stack: '.phone-float-stack',
    fanBlock: '.phone-market-float .stall-fan-block',
    hand: '.phone-market-float .stall-hand',
    head: '.phone-rail .popup-head',
    basket: '.phone-market-float [data-testid="action-primary"]',
    hold: '.phone-market-float .drop-zone--hold',
    skip: '.phone-market-float .drop-row > .btn',
    done: '.phone-market-float .btn--navy',
    fabs: '.phone-quick',
    toast: '.toast-stack .toast, .toast',
  });
  const rail = await page.evaluate(() => {
    const r = document.querySelector('.phone-rail');
    return { scrollTop: r?.scrollTop, scrollHeight: r?.scrollHeight, clientHeight: r?.clientHeight };
  });
  console.log(JSON.stringify({ rail, ...data }, null, 1));
  // 重叠量测：chrome（圈数片/头像片/气泡）× 每张卡；导引句下缘边距；按钮入镜
  const cards = data.cards ?? [];
  const chromes = [...(data.lap ?? []), ...(data.bots ?? []), ...(data.bubbles ?? [])];
  let worst = 0;
  const pairs = [];
  for (const c of chromes) {
    if (c.display === 'none' || c.visibility === 'hidden') continue;
    for (const [i, card] of cards.entries()) {
      const o = overlap(c, card);
      if (o > 0) pairs.push({ chrome: c.text || c.display, cardIdx: i, overlapPx2: o });
      worst = Math.max(worst, o);
    }
  }
  console.log('  [overlap chrome×cards] worst =', worst, 'px² pairs =', JSON.stringify(pairs));
  const guide = data.guide?.[0];
  if (guide) console.log(`  [guide] bottom=${guide.bottom} → 距画面下缘 ${Math.round((402 - guide.bottom) * 10) / 10}px（安全区下 20px）`);
  for (const k of ['stack', 'fanBlock', 'hand', 'basket', 'hold', 'skip', 'done']) {
    const b = data[k]?.[0];
    if (b) console.log(`  [${k}] y=${b.y} h=${b.h} bottom=${b.bottom}`);
    else console.log(`  [${k}] 未找到`);
  }
  for (const [i, c] of (data.cards ?? []).entries()) {
    console.log(`  [card${i}] x=${c.x} y=${c.y} w=${c.w} h=${c.h} bottom=${c.bottom} "${c.text.slice(0, 18)}"`);
  }
  // 竖栏在 scrollTop=0 时：弹窗头与状态行完整入镜、Done 不在栏内（已进浮层）
  const railCheck = await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    const prev = rail.scrollTop;
    rail.scrollTop = 0;
    const head = document.querySelector('.phone-rail .popup-head')?.getBoundingClientRect();
    const foot = document.querySelector('.phone-rail .panel-foot')?.getBoundingClientRect();
    const out = {
      headInFrame: head ? head.y >= 0 && head.bottom <= 402 : null,
      headRect: head ? { y: Math.round(head.y), bottom: Math.round(head.bottom) } : null,
      footBottom: foot ? Math.round(foot.bottom) : null,
      railScrollHeight: rail.scrollHeight,
    };
    rail.scrollTop = prev;
    return out;
  });
  console.log('  [rail@scrollTop0]', JSON.stringify(railCheck));
  const tag = data.tag?.[0];
  if (tag) console.log(`  [hand-tag] ${JSON.stringify(tag)}`);
  // 等提示条（2.5s 自动消失）退场再拍验收帧，免得它压住投放区
  const tToast = Date.now();
  while (Date.now() - tToast < 12_000) {
    const n = await page.evaluate(() => document.querySelectorAll('.toast').length).catch(() => 0);
    if (n === 0) break;
    await page.waitForTimeout(400);
  }
  await shot(page, process.env.SHOT ?? 'r10e_r2fix_market_phone.png');
  await ctx.close();
}

if (MODE === 'gemtest') {
  const { ctx, page } = await startPage(browser, { phone: false });
  await jumpTo(page, 2, 'panel-market', 1);
  await page.locator('[data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(1000);
  const res = await page.evaluate(() => {
    const gem = document.querySelector('.stall-hand .card-view-gem');
    if (!gem) return 'no gem';
    const cs = getComputedStyle(gem);
    const base = { sh: gem.scrollHeight, ch: gem.clientHeight, fs: cs.fontSize, lh: cs.lineHeight, display: cs.display };
    const trials = {};
    const tryStyle = (name, styles) => {
      const saved = {};
      for (const [k, v] of Object.entries(styles)) { saved[k] = gem.style[k]; gem.style[k] = v; }
      trials[name] = { sh: gem.scrollHeight, ch: gem.clientHeight };
      for (const [k, v] of Object.entries(saved)) gem.style[k] = v;
    };
    tryStyle('lh-16px', { lineHeight: '16px' });
    tryStyle('fs-15px', { fontSize: '15px' });
    tryStyle('fs-14px', { fontSize: '14px' });
    tryStyle('grid', { display: 'grid', placeItems: 'center' });
    return { base, trials };
  });
  console.log(JSON.stringify(res, null, 1));
  await ctx.close();
}

/* ww 追加口径②：安全区内卡名/价格/金币数字完整可见（逐卡量测）、
   Buy 与 Done 高度逐个 ≥48px、市场页文字溢出 scrollWidth−clientWidth
   逐处 = 0px（具名元素逐报 + 浮层/竖栏全量扫溢出兜底） */
if (MODE === 'market-phone-detail') {
  const { ctx, page } = await startPage(browser, { phone: true });
  await jumpTo(page, 2, 'panel-market', 1);
  await page.locator('[data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(800);
  // 选中第一张卡，进入带价格/算式的购买态再量
  const firstCard = page.locator('.phone-market-float [data-testid^="action-stall-"]').first();
  if ((await firstCard.count()) > 0) await firstCard.click().catch(() => {});
  await page.waitForTimeout(700);
  const detail = await page.evaluate(() => {
    const R = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    const inFrame = (r) => !!r && r.x >= 0 && r.y >= 0 && r.right <= 874 && r.bottom <= 402;
    const ov = (el) => el ? { dW: el.scrollWidth - el.clientWidth, dH: el.scrollHeight - el.clientHeight } : null;
    const cards = [...document.querySelectorAll('.phone-market-float [data-testid^="action-stall-"]')].map((c) => {
      const name = c.querySelector('.card-view-name');
      const gem = c.querySelector('.card-view-gem');
      const tag = c.querySelector('.card-view-tag');
      return {
        card: R(c),
        name: { text: name?.textContent?.trim(), rect: R(name), inFrame: inFrame(R(name)), ov: ov(name) },
        price: { text: gem?.textContent?.trim(), rect: R(gem), inFrame: inFrame(R(gem)) },
        tag: { text: tag?.textContent?.trim(), rect: R(tag), inFrame: inFrame(R(tag)), ov: ov(tag) },
      };
    });
    const buy = document.querySelector('.phone-market-float [data-testid="action-primary"]');
    const done = document.querySelector('.phone-market-float .btn--navy');
    const hold = document.querySelector('.phone-market-float .drop-zone--hold');
    const skip = document.querySelector('.phone-market-float .drop-row > .btn');
    const math = document.querySelector('.phone-market-float .cb-math--inrow');
    const guide = document.querySelector('.phone-market-float .stall-guide');
    const tag1 = document.querySelector('.phone-market-float .hand-tag');
    const title = document.querySelector('.phone-rail .popup-title');
    const cbNums = [...document.querySelectorAll('.phone-rail .cb-num')].map((n) => ({ text: n.textContent?.trim(), rect: R(n), inFrame: inFrame(R(n)), ov: ov(n) }));
    const named = {
      title: { text: title?.textContent?.trim(), ov: ov(title) },
      guide: { text: guide?.textContent?.trim(), ov: ov(guide) },
      handTag: { text: tag1?.textContent?.trim(), ov: ov(tag1) },
      buy: { text: buy?.textContent?.trim(), ov: ov(buy) },
      hold: { text: hold?.textContent?.trim(), ov: ov(hold) },
      skip: { text: skip?.textContent?.trim(), ov: ov(skip) },
      done: { text: done?.textContent?.trim(), ov: ov(done) },
      math: { text: math?.textContent?.trim(), ov: ov(math) },
    };
    // 全量扫溢出兜底：浮层 + 竖栏弹窗内所有元素（排除滚动容器本体）
    const sweep = [];
    for (const el of document.querySelectorAll('.phone-market-float *, .phone-rail .popup *')) {
      const dW = el.scrollWidth - el.clientWidth;
      const dH = el.scrollHeight - el.clientHeight;
      if ((dW > 0 || dH > 0) && el.children.length === 0 || (dW > 1 || dH > 1)) {
        const cs = getComputedStyle(el);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') continue;
        if (dW > 0 || dH > 0) sweep.push({ cls: el.className?.toString().slice(0, 40), text: el.textContent?.trim().slice(0, 30), dW, dH });
      }
    }
    return {
      cards,
      buyRect: R(buy), doneRect: R(done),
      mathRect: R(math), mathInFrame: inFrame(R(math)),
      cbNums, named,
      sweepCount: sweep.length, sweep: sweep.slice(0, 20),
    };
  });
  console.log(JSON.stringify(detail, null, 1));
  await ctx.close();
}

if (MODE === 'weather-phone') {
  const { ctx, page } = await startPage(browser, { phone: true });
  await jumpTo(page, 5, 'panel-event', 1);
  let phase = 'none';
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000) {
    phase = await page.evaluate(() => {
      const vis = (el) => !!el && el.getClientRects().length > 0;
      if (vis(document.querySelector('[data-testid="weather-card"]'))) return 'card';
      if (vis(document.querySelector('[data-testid="weather-spinner"]'))) return 'spin';
      if (vis(document.querySelector('[data-testid="weather-moment"]'))) return 'moment-no-card';
      return 'none';
    });
    if (phase === 'card') break;
    await page.waitForTimeout(250);
  }
  console.log('  phase =', phase);
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
  });
  await page.waitForTimeout(400);
  const data = await page.evaluate(RECTS_FN, {
    moment: '[data-testid="weather-moment"]',
    card: '[data-testid="weather-card"]',
    head: '.phone-rail .popup-head',
    title: '.phone-rail .popup-title',
    floatLayer: '.phone-weather-float',
    marketFloat: '.phone-market-float',
  });
  const host = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="weather-moment"]');
    if (!m) return null;
    return {
      inWeatherFloat: !!m.closest('.phone-weather-float'),
      inRail: !!m.closest('.phone-rail'),
      floatBg: (() => {
        const f = document.querySelector('.phone-weather-float');
        return f ? getComputedStyle(f).backgroundColor : null;
      })(),
    };
  });
  console.log(JSON.stringify({ host, ...data }, null, 1));
  const rows = await contrastRows(page, 874, 402, [
    '.moment-card .card-view-name',
    '.moment-tap',
  ]);
  for (const r of rows) {
    console.log(`  [对比度比值] ${r.element} "${r.text}" | ${r.basis} | fg=${r.fg} ownBg=${r.ownBg} ring=${r.ringPx} | 对比度比值 = ${r.contrastRatio}:1`);
  }
  await shot(page, process.env.SHOT ?? 'r10e_r2fix_weather_result_phone.png');
  await ctx.close();
}

if (MODE === 'market-desktop') {
  const { ctx, page } = await startPage(browser, { phone: false });
  await jumpTo(page, 2, 'panel-market', 1);
  await page.locator('[data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(1200);
  const data = await page.evaluate(RECTS_FN, {
    tag: '.stall-hand .hand-tag',
    popupBody: '.popup-body',
    hand: '.stall-hand',
    head: '.popup-head',
    fanBlock: '.stall-fan-block',
    guide: '.stall-guide',
    foot: '.panel-foot',
    coinbar: '.panel-foot .coin-bar',
    selected: '.panel-foot .panel-selected',
    droprow: '.panel-foot .drop-row',
    done: '.panel-foot .btn--navy',
    keyhelp: '.panel-foot .panel-keyhelp',
    popup: '.popup',
  });
  const scrollInfo = await page.evaluate(() => {
    const b = document.querySelector('.popup-body');
    return { scrollHeight: b?.scrollHeight, clientHeight: b?.clientHeight, scrollTop: b?.scrollTop };
  });
  console.log('  [popup-body scroll]', JSON.stringify(scrollInfo));
  console.log(JSON.stringify(data, null, 1));
  const tag = data.tag?.[0];
  const body = data.popupBody?.[0];
  if (tag && body) {
    console.log(`  [tag-clip] tag.y=${tag.y} popupBody.y=${body.y} → 名签顶边高出滚动容器 ${Math.round((body.y - tag.y) * 10) / 10}px（>0 = 被裁）`);
  }
  await shot(page, process.env.SHOT ?? 'r10e_r2fix_market_desktop.png');
  await ctx.close();
}

if (MODE === 'reflect-desktop' || MODE === 'reflect-phone') {
  const phone = MODE === 'reflect-phone';
  const form = phone ? 'phone' : 'desktop';
  const { ctx, page } = await startPage(browser, { phone });
  // 整局推进（同 probe-r2-cook 的 advance 口径）
  const STATE_FN = () => ({
    reflection: !!document.querySelector('[data-testid="screen-reflection"]'),
    pill: !!document.querySelector('[data-testid="await-proposal"]'),
    botThinking: !!document.querySelector('.bot-card--thinking, .phone-bot--on'),
  });
  const advance = () =>
    page
      .evaluate(() => {
        const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
        const no = document.querySelector('[data-testid="proposal-no"]');
        if (vis(no)) {
          no.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return;
        }
        const primary = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
        if (primary) {
          primary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return;
        }
        const keyed = [...document.querySelectorAll('[data-key]')].filter(vis);
        if (keyed.length) {
          const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      })
      .catch(() => {});
  const t0 = Date.now();
  let reached = false;
  let lastAdvance = 0;
  while (Date.now() - t0 < 1_200_000) {
    const s = await page.evaluate(STATE_FN).catch(() => null);
    if (s?.reflection) {
      // 等真人选项在场
      const hasOpts = await page.locator('.reflection-options .hand-item').count().catch(() => 0);
      if (hasOpts >= 5) {
        reached = true;
        break;
      }
    }
    if (s && !s.botThinking) {
      const now = Date.now();
      if (now - lastAdvance >= 250) {
        lastAdvance = now;
        await advance();
      }
    }
    await page.waitForTimeout(150);
  }
  console.log('  reflection reached =', reached, `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  if (reached) {
    // 关演示条再拍验收帧（同 r10e 截图口径：演示条不是产品 UI）
    const closeBtn = page.locator('[data-testid="demo-close"]');
    if ((await closeBtn.count()) > 0) await closeBtn.dispatchEvent('click').catch(() => {});
    else if ((await page.locator('[data-testid="demo-bar"]').count()) > 0) await page.keyboard.press('d');
    await page.waitForTimeout(1200);
    const NAMES_FN = () => {
      const items = [...document.querySelectorAll('.reflection-options .hand-item')];
      return items.map((it) => {
        const nameEl = it.querySelector('.card-view-name');
        const card = it.querySelector('.card-view');
        const r = card?.getBoundingClientRect();
        const nr = nameEl?.getBoundingClientRect();
        const cs = nameEl ? getComputedStyle(nameEl) : null;
        return {
          label: nameEl?.textContent?.trim() ?? null,
          nameDisplay: cs?.display ?? null,
          nameRect: nr ? { x: Math.round(nr.x), y: Math.round(nr.y), w: Math.round(nr.width), h: Math.round(nr.height) } : null,
          cardRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) } : null,
        };
      });
    };
    const names = await page.evaluate(NAMES_FN);
    console.log(JSON.stringify(names, null, 1));
    // 推进循环的最后一次点击会让首卡保持聚焦 + 鼠标悬停（名签浮出）
    // ——拍基线帧前先移开鼠标并失焦，回到无人触碰的静止态；
    // 展开态由随后的真实点击产生
    await page.mouse.move(8, 8);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.waitForTimeout(600);
    // 相邻卡重叠量测
    const rects = names.map((n) => n.cardRect).filter(Boolean);
    let worstOverlap = 0;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) worstOverlap = Math.max(worstOverlap, overlap(rects[i], rects[j]));
    }
    console.log('  [cards pairwise overlap] worst =', worstOverlap, 'px²');
    await shot(page, `r10e_r2fix_reflect_${form}.png`);
    if (process.env.OPEN === '1') {
      // 点第一张卡一次 → 选中展开态（再点同卡才是提交，这里不点第二次）
      await page.locator('.reflection-options .hand-item .card-view').first().dispatchEvent('click');
      await page.waitForTimeout(900);
      const openState = await page.evaluate(() => {
        const ro = document.querySelector('.reflection-picked');
        const sel = document.querySelector('.reflection-options .hand-item--sel');
        const tag = sel?.querySelector('.hand-tag');
        return {
          readout: ro ? { text: ro.textContent?.trim(), rect: (() => { const r = ro.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() } : null,
          selTag: tag ? tag.textContent?.trim() : null,
          stillOptions: document.querySelectorAll('.reflection-options .hand-item').length,
          saidCount: document.querySelectorAll('.reflection-card').length,
        };
      });
      console.log('  [open state]', JSON.stringify(openState));
      await shot(page, `r10e_r2fix_reflect_open_${form}.png`);
    }
  }
  await ctx.close();
}

if (MODE === 'rail-market') {
  const { ctx, page } = await startPage(browser, { phone: true });
  await jumpTo(page, 2, 'panel-market', 1);
  await page.locator('[data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(1000);
  await page.evaluate(() => { document.querySelector('.phone-rail').scrollTop = 0; });
  await page.waitForTimeout(400);
  const dump = await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    const rows = [];
    const walk = (el, depth, p) => {
      const r = el.getBoundingClientRect();
      rows.push({ p, y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom), text: (el.textContent ?? '').trim().slice(0, 30) });
      if (depth < 3) [...el.children].forEach((c, i) => walk(c, depth + 1, `${p}>${(c.className?.toString() ?? c.tagName).slice(0, 26)}[${i}]`));
    };
    [...rail.children].forEach((c, i) => walk(c, 0, `rail>${(c.className?.toString() ?? c.tagName).slice(0, 28)}[${i}]`));
    return { scrollHeight: rail.scrollHeight, clientHeight: rail.clientHeight, rows };
  });
  console.log('rail scrollHeight', dump.scrollHeight, 'clientHeight', dump.clientHeight);
  for (const r of dump.rows) console.log(`${r.y}\t${r.h}\t${r.bottom}\t${r.p}\t"${r.text}"`);
  await ctx.close();
}

await browser.close();
console.log('done');
