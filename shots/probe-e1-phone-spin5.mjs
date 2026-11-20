/** Probe E1 补充 6：手机天气 spin 态 .weather-result 抢拍（预热版）。
 * Usage: BASE=http://localhost:4173 node shots/probe-e1-phone-spin5.mjs
 *
 * 前版数据：spin 区间实测 1.4–2.3s；PREP 在 spin 开始后 ~0.1–0.8s 返回；
 * 但其后 captureScreenshot+尾 evaluate 恒定耗时 ~20–34s（页面时钟），
 * bracketing 必失败。主线程并未堵死（spin 定时器按时翻相位），停滞在
 * 合成/捕获侧——疑似首次进入天气场景的 SwiftShader 着色器编译阻塞帧
 * 生产。本版先完整访问一次事件站（spin→card→点掉）预热场景与着色器，
 * 再回跳抢拍；逐段记录 Node 侧耗时（PREP / capture / tail）以便定位。
 * 认账标准不变：MutationObserver spin 区间完整覆盖 [PREP 时刻, p1]；
 * 环带口径与原探针一致（clip 坐标平移）。
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const VW = 874;
const VH = 402;
const CLIP = { x: 596, y: 0, width: 278, height: 402, scale: 1 };

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

const PREP_FN = (sel) => {
  const rail = document.querySelector('.phone-rail');
  const inVP = (r) =>
    r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  let el = [...document.querySelectorAll(sel)].find((e) => inVP(e.getBoundingClientRect()));
  let scrolled = null;
  if (!el) {
    const cand = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length > 0);
    if (cand && rail) {
      const before = rail.scrollTop;
      const rr = rail.getBoundingClientRect();
      const r = cand.getBoundingClientRect();
      const delta = r.y + r.height / 2 - (rr.y + rr.height / 2);
      rail.scrollTop = Math.max(0, Math.min(rail.scrollHeight - rail.clientHeight, before + delta));
      scrolled = { before: Math.round(before), after: Math.round(rail.scrollTop) };
      if (inVP(cand.getBoundingClientRect())) el = cand;
    }
  }
  if (!el) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    sel,
    text: (el.textContent ?? '').trim().slice(0, 40),
    color: cs.color,
    bg: cs.backgroundColor,
    opacity: Number(cs.opacity),
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    railScrollTop: rail ? rail.scrollTop : null,
    railScrollHeight: rail ? rail.scrollHeight : null,
    scrolled,
    now: Math.round(performance.now()),
  };
};

const RING_CLIP_FN = async ({ b64, rect, clip }) => {
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
  const sx = img.naturalWidth / clip.width;
  const sy = img.naturalHeight / clip.height;
  const R = {
    x: (rect.x - clip.x) * sx,
    y: (rect.y - clip.y) * sy,
    w: Math.max(1, rect.w * sx),
    h: Math.max(1, rect.h * sy),
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

const phaseOf = (page) =>
  page
    .evaluate(() => {
      const wm = document.querySelector('.weather-moment');
      if (!wm) return 'none';
      return wm.querySelector('.moment-card') ? 'card' : 'spin';
    })
    .catch(() => 'none');

const advanceOnce = (page) =>
  page
    .evaluate(() => {
      const vis = (el) => el && el.getClientRects().length > 0;
      const inPopup = document.querySelector('.popup [data-testid="action-primary"]:not([disabled])');
      if (vis(inPopup)) {
        inPopup.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return;
      }
      const enter = document.querySelector('.board-enter, [data-testid="action-primary"]:not([disabled])');
      if (vis(enter)) enter.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    })
    .catch(() => {});

/* ---------- 主流程 ---------- */
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript(() => {
  try {
    window.localStorage.setItem('maicai-lang', 'en');
  } catch { /* ignore */ }
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

/* —— 预热：完整走一遍事件站天气时刻（spin→card→点掉），并测一次 card 相位截图耗时 —— */
console.log('===== 预热访问事件站 =====');
await jumpTo(page, 5, 'panel-event');
{
  const t0 = Date.now();
  let warmed = false;
  while (Date.now() - t0 < 120_000 && !warmed) {
    const ph = await phaseOf(page);
    if (ph === 'card') {
      const c0 = Date.now();
      await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, clip: CLIP });
      console.log(`  预热：card 相位 clip 截图耗时 ${Date.now() - c0}ms`);
      // 点掉天气卡
      await page.locator('[data-testid="weather-card"]').dispatchEvent('click').catch(() => {});
      warmed = true;
    } else if (ph === 'none') {
      await advanceOnce(page);
      await page.waitForTimeout(250);
    } else {
      await page.waitForTimeout(150);
    }
  }
  console.log(`  预热完成=${warmed}`);
}

/* —— 抢拍 —— */
let captured = null;
for (let attempt = 1; attempt <= 5 && !captured; attempt++) {
  console.log(`\n===== spin 抢拍 v5 尝试 ${attempt} =====`);
  const ok = await jumpTo(page, 5, 'panel-event');
  console.log(`  事件站: ${ok ? '已打开' : '未打开'}`);
  if (!ok) continue;
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000 && !captured) {
    const phase = await phaseOf(page);
    if (phase === 'spin') {
      const n0 = Date.now();
      const prep = await page.evaluate(PREP_FN, '.weather-result').catch(() => null);
      const n1 = Date.now();
      if (!prep) {
        console.log('  PREP 未拿到元素（窗口内重试）');
        continue;
      }
      const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, clip: CLIP });
      const n2 = Date.now();
      const tail = await page.evaluate(() => ({
        p1: Math.round(performance.now()),
        log: window.__spinLog,
        stillSpin: !!document.querySelector('.weather-spin'),
      }));
      const n3 = Date.now();
      const starts = tail.log.filter((e) => e.type === 'start');
      const s = starts[starts.length - 1]?.t;
      const e = tail.log.find((x) => x.type === 'end' && s !== undefined && x.t > s)?.t ?? (tail.stillSpin ? Infinity : undefined);
      console.log(
        `  spin=[${s},${e}] prep@${prep.now} p1=${tail.p1} | Node 段耗时 prep=${n1 - n0}ms capture=${n2 - n1}ms tail=${n3 - n2}ms | scrolled=${JSON.stringify(prep.scrolled)} rect=${JSON.stringify(prep.rect)}`,
      );
      if (s !== undefined && e !== undefined && s <= prep.now && e >= tail.p1) {
        captured = { prep, b64: res.data, bracket: [s, e, prep.now, tail.p1], attempt };
        console.log('  抢拍认账');
      } else {
        console.log('  bracketing 未覆盖，作废');
        break;
      }
    } else if (phase === 'none') {
      await advanceOnce(page);
      await page.waitForTimeout(200);
    } else {
      break;
    }
  }
}
await ctx.close();

if (captured) {
  const st = captured.prep;
  const fg = parseColor(st.color);
  const ownBg = parseColor(st.bg);
  const ctx2 = await browser.newContext({ viewport: { width: VW, height: VH } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const ring = await page2.evaluate(RING_CLIP_FN, { b64: captured.b64, rect: st.rect, clip: CLIP }).catch(() => null);
  await ctx2.close();
  console.log('\n===== E1 补采：手机 874×402 天气 spin .weather-result =====');
  console.log(
    `  bracketing: spin=[${captured.bracket[0]},${captured.bracket[1]}]ms 覆盖 [prep ${captured.bracket[2]}, p1 ${captured.bracket[3]}]ms（performance.now）；railScrollTop=${st.railScrollTop}/${st.railScrollHeight} scrolled=${JSON.stringify(st.scrolled)}`,
  );
  for (const [tag, px] of ring ? [['worst(max)', ring.max], ['p95', ring.p95]] : [['no-ring', null]]) {
    let effBg = px ? { ...px, a: 1 } : null;
    if (effBg && ownBg && ownBg.a > 0) effBg = over(ownBg, effBg);
    let effFg = fg;
    if (effBg && fg && st.opacity < 1) effFg = over({ ...fg, a: fg.a * st.opacity }, effBg);
    const c = effBg && effFg ? Number(contrast(effFg, effBg).toFixed(2)) : null;
    const flag = c === null ? '  ? ' : c >= 4.5 ? 'PASS' : '🔴FAIL';
    console.log(
      `${flag} ${c ?? 'n/a'}:1 | phone-874x402 B-天气spin | .weather-result "${st.text}" | rect=${JSON.stringify({ x: Math.round(st.rect.x), y: Math.round(st.rect.y), w: Math.round(st.rect.w), h: Math.round(st.rect.h) })} fg=${fmtC(fg)} ownBg=${fmtC(ownBg)} ring=${px ? fmtC({ ...px, a: 1 }) : 'n/a'}(n=${ring ? ring.n : 0}) effBg=${fmtC(effBg)} | ${tag}`,
    );
  }
} else {
  console.log('\n spin 抢拍 v5 5 次均未成功');
}
await browser.close();
