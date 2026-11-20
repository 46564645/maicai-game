/** Probe E1 补充 3：手机天气 spin 态 .weather-result 抢拍（时间戳 bracketing 版）。
 * Usage: BASE=http://localhost:4173 node shots/probe-e1-phone-spin2.mjs
 *
 * spin 相位固定 1500ms（weatherCardDelayMs），SwiftShader 下一次 CDP 截图
 * 就可能跨过相位边界。本版只做观测不做干预：
 *  - addInitScript 注入 MutationObserver，记录 .weather-spin 挂载/卸载的
 *    performance.now 时间戳（window.__spinLog），不改 DOM/样式/计时；
 *  - waitForFunction(rAF) 在转盘挂载后一两帧内触发检测（无轮询往返延迟）；
 *  - 预建 CDP 会话；STYLE_FN 取 rect 后立刻截图，截图前后各取一次
 *    performance.now（p0/p1）。认账条件：spin 区间 [s,e] 完整覆盖 [p0,p1]
 *    ——截图帧必然是 spin 态像素。环带采样口径与原探针逐字一致。
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const VW = 874;
const VH = 402;

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
const over = (fg, bg) => ({
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
const contrast = (c1, c2) => {
  const [l1, l2] = [relLum(c1), relLum(c2)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
};
const fmtC = (c) => (c ? `rgb(${c.r.toFixed(0)},${c.g.toFixed(0)},${c.b.toFixed(0)}${c.a < 1 ? `,a=${c.a.toFixed(2)}` : ''})` : 'none');

const STYLE_FN = (sel) => {
  const els = [...document.querySelectorAll(sel)];
  const el = els.find((e) => {
    const r = e.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.top < window.innerHeight &&
      r.right > 0 &&
      r.left < window.innerWidth
    );
  });
  if (!el) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const rail = document.querySelector('.phone-rail');
  return {
    sel,
    text: (el.textContent ?? '').trim().slice(0, 40),
    color: cs.color,
    bg: cs.backgroundColor,
    opacity: Number(cs.opacity),
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    railScrollTop: rail ? rail.scrollTop : null,
    railScrollHeight: rail ? rail.scrollHeight : null,
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
  const R = {
    x: cx0 * sx,
    y: cy0 * sy,
    w: Math.max(1, (cx1 - cx0) * sx),
    h: Math.max(1, (cy1 - cy0) * sy),
  };
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
  return (await panel.count()) > 0;
}

async function jumpTo(page, stationIdx, panelTestid) {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
    await page.waitForTimeout(700);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  return waitPanel(page, panelTestid);
}

/* ---------- 主流程 ---------- */
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript(() => {
  try {
    window.localStorage.setItem('maicai-lang', 'en');
  } catch { /* ignore */ }
  // 仅观测：记录 .weather-spin 挂载/卸载时刻，不改页面任何行为
  window.__spinLog = [];
  const obs = new MutationObserver(() => {
    const spin = !!document.querySelector('.weather-spin');
    const log = window.__spinLog;
    const last = log[log.length - 1];
    if (spin && (!last || last.type === 'end')) log.push({ type: 'start', t: Math.round(performance.now()) });
    if (!spin && last && last.type === 'start') log.push({ type: 'end', t: Math.round(performance.now()) });
  });
  const arm = () => {
    if (document.documentElement) obs.observe(document.documentElement, { childList: true, subtree: true });
    else setTimeout(arm, 10);
  };
  arm();
});
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(3000);

const cdp = await page.context().newCDPSession(page);

let captured = null;
for (let attempt = 1; attempt <= 4 && !captured; attempt++) {
  console.log(`\n===== spin 抢拍 v2 尝试 ${attempt} =====`);
  // 预挂 waitForFunction：转盘一挂载就触发（在 jump 之前挂，避免错过）
  const spinSeen = page
    .waitForFunction(() => !!document.querySelector('.weather-spin'), null, { polling: 'raf', timeout: 90_000 })
    .then(() => true)
    .catch(() => false);
  const ok = await jumpTo(page, 5, 'panel-event');
  console.log(`  事件站: ${ok ? '已打开' : '未打开'}`);
  if (!ok) continue;
  // 事件站打开后可能还卡在前置步（ACK/牌堆）：边推进边等 spin 出现
  const advancer = (async () => {
    for (let i = 0; i < 40; i++) {
      const seen = await Promise.race([spinSeen, page.waitForTimeout(250).then(() => null)]);
      if (seen) return true;
      await page
        .evaluate(() => {
          const vis = (el) => el && el.getClientRects().length > 0;
          const wm = document.querySelector('.weather-moment');
          if (wm) return;
          const inPopup = document.querySelector('.popup [data-testid="action-primary"]:not([disabled])');
          if (vis(inPopup)) {
            inPopup.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return;
          }
          const enter = document.querySelector('.board-enter, [data-testid="action-primary"]:not([disabled])');
          if (vis(enter)) enter.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        })
        .catch(() => {});
    }
    return false;
  })();
  const got = await advancer;
  if (!got) {
    console.log('  未等到 spin 出现');
    continue;
  }
  // —— 抢拍：STYLE → p0 → 截图 → p1+log ——
  const st = await page.evaluate(STYLE_FN, '.weather-result').catch(() => null);
  if (!st) {
    console.log('  spin 已触发但 .weather-result 不在视口（需滚动），本轮放弃（诊断见前轮）');
    continue;
  }
  const p0 = await page.evaluate(() => Math.round(performance.now()));
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  const tail = await page.evaluate(() => ({
    p1: Math.round(performance.now()),
    log: window.__spinLog,
    stillSpin: !!document.querySelector('.weather-spin'),
  }));
  const starts = tail.log.filter((e) => e.type === 'start');
  const s = starts[starts.length - 1]?.t;
  const e = tail.log.find((x) => x.type === 'end' && s !== undefined && x.t > s)?.t ?? (tail.stillSpin ? Infinity : undefined);
  console.log(`  spin 区间=[${s}, ${e}] 截图窗口=[${p0}, ${tail.p1}] stillSpin=${tail.stillSpin}`);
  if (s !== undefined && e !== undefined && s <= p0 && e >= tail.p1) {
    captured = { st, b64: res.data, window: [s, e, p0, tail.p1], attempt };
    console.log(`  抢拍认账: "${st.text}" rect=${JSON.stringify(st.rect)} railScrollTop=${st.railScrollTop}/${st.railScrollHeight}`);
  } else {
    console.log('  截图窗口未被 spin 区间完整覆盖，作废');
  }
}
await ctx.close();

if (captured) {
  const ctx2 = await browser.newContext({ viewport: { width: VW, height: VH } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const ring = await page2.evaluate(RING_FN, { b64: captured.b64, rect: captured.st.rect, vw: VW, vh: VH }).catch(() => null);
  await ctx2.close();
  const { st } = captured;
  const fg = parseColor(st.color);
  const ownBg = parseColor(st.bg);
  console.log('\n===== E1 补采：手机 874×402 天气 spin .weather-result =====');
  console.log(`  bracketing: spin=[${captured.window[0]},${captured.window[1]}]ms 截图调用=[${captured.window[2]},${captured.window[3]}]ms（performance.now）`);
  for (const [tag, px] of ring ? [['worst(max)', ring.max], ['p95', ring.p95]] : [['no-ring', null]]) {
    let effBg = px ? { ...px, a: 1 } : null;
    if (effBg && ownBg && ownBg.a > 0) effBg = over(ownBg, effBg);
    let effFg = fg;
    if (effBg && fg && st.opacity < 1) effFg = over({ ...fg, a: fg.a * st.opacity }, effBg);
    const c = effBg && effFg ? Number(contrast(effFg, effBg).toFixed(2)) : null;
    const flag = c === null ? '  ? ' : c >= 4.5 ? 'PASS' : '🔴FAIL';
    console.log(
      `${flag} ${c ?? 'n/a'}:1 | phone-874x402 B-天气spin | .weather-result "${st.text}" | rect=${JSON.stringify({ x: Math.round(st.rect.x), y: Math.round(st.rect.y), w: Math.round(st.rect.w), h: Math.round(st.rect.h) })} fg=${fmtC(fg)} ownBg=${fmtC(ownBg)} ring=${px ? fmtC({ ...px, a: 1 }) : 'n/a'}(n=${ring ? ring.n : 0}) effBg=${fmtC(effBg)} | ${tag} | railScrollTop=${st.railScrollTop}`,
    );
  }
} else {
  console.log('\n spin 抢拍 v2 4 次均未成功');
}
await browser.close();
