/** Probe E1: 浮层文字对比度实测（R1 定稿 E1）。
 * Usage: BASE=http://localhost:4173 node shots/probe-e1-contrast.mjs
 * 前置：npm run build 后 vite preview 在 4173。
 *
 * 方法（每个视口 × 两态）：
 *  - 态 A 普通站点弹窗（市场站，压暗层 = --color-backdrop 本体 0.42）
 *  - 态 B 事件站天气时刻，spin 与 card 两相位都采（R2-11 起天气时刻
 *    已取消稀释、与态 A 同一 --color-backdrop 压暗；历史上此处曾被
 *    :has(.weather-moment) 稀释到 42%，是当时的最坏态）
 * 对每个浮层文字元素（.popup-head / .panel-text / .weather-result /
 * .moment-tap 等实际出现者）：
 *  1. getComputedStyle 取前景色、元素自身背景色（color-mix 已由浏览器
 *     解析为带 alpha 的色）、元素 opacity；
 *  2. CDP 截图（fromSurface:false，SwiftShader 安全口径，同 r10b-shots），
 *     在页面内用 canvas 解码，采样元素 rect 外 4–16px 环带内的棋盘像素
 *     （截图里已是「棋盘经压暗层+模糊合成后」的实际像素），取最亮像素
 *     与 95 分位亮度像素；
 *  3. 有效底色 = 元素自身半透明底 over 环带像素；有效前景 = 前景色按
 *     opacity over 有效底色；按 WCAG 相对亮度公式算对比度。
 * 另附解析下限：棋盘最亮参考 #FFE9A8（转盘晴天扇区）分别经
 * 正常压暗（alpha .42）与天气稀释压暗（alpha .42×.42=.1764）合成，
 * 再 over 浮签底（ink 60%）/ 浮丸底（surface 84%），与各自前景算比值。
 * 本探针只报数，不改 CSS。
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

/* ---------- 颜色工具（Node 侧，解析 + WCAG） ---------- */
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

/* ---------- 页面内采样 ---------- */
/** 取元素样式与 rect（第一个可见命中） */
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
  return {
    sel,
    text: (el.textContent ?? '').trim().slice(0, 40),
    color: cs.color,
    bg: cs.backgroundColor,
    opacity: Number(cs.opacity),
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
  };
};

/** 把截图 base64 贴回页面解码，采样 rect 外环带像素：返回最亮与 p95 亮度像素 */
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
      if (inX && inY) continue; // 只取 4–16px 环带（避开元素本体与边缘抗锯齿）
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

async function screenshotB64(page) {
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  return res.data;
}

/* ---------- 驱动（同 r10b-shots 口径） ---------- */
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

async function railTop(page) {
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
  });
  await page.waitForTimeout(350);
}

const TARGETS = ['.popup-head', '.popup-head .popup-aside', '.panel-text', '.panel-subtitle', '.weather-result', '.moment-tap', '.event-story-tap', '.popup-tag', '.popup-goal'];

async function sampleState(page, vw, vh, label, wanted) {
  const rows = [];
  const styles = [];
  for (const sel of TARGETS) {
    if (wanted && !wanted.includes(sel)) continue;
    const st = await page.evaluate(STYLE_FN, sel).catch(() => null);
    if (st) styles.push(st);
  }
  if (styles.length === 0) {
    console.log(`  [${label}] 无可采浮层元素`);
    return rows;
  }
  const b64 = await screenshotB64(page);
  for (const st of styles) {
    const ring = await page.evaluate(RING_FN, { b64, rect: st.rect, vw, vh }).catch(() => null);
    const fg = parseColor(st.color);
    const ownBg = parseColor(st.bg);
    for (const [tag, px] of ring ? [['worst(max)', ring.max], ['p95', ring.p95]] : [['no-ring', null]]) {
      let effBg = px ? { ...px, a: 1 } : null;
      if (effBg && ownBg && ownBg.a > 0) effBg = over(ownBg, effBg);
      let effFg = fg;
      if (effBg && fg && st.opacity < 1) effFg = over({ ...fg, a: fg.a * st.opacity }, effBg);
      rows.push({
        state: label,
        element: st.sel,
        text: st.text,
        fg: fmtC(fg),
        ownBg: fmtC(ownBg),
        ringPx: px ? fmtC({ ...px, a: 1 }) : 'n/a',
        effBg: fmtC(effBg),
        basis: tag,
        contrast: effBg && effFg ? Number(contrast(effFg, effBg).toFixed(2)) : null,
      });
    }
  }
  return rows;
}

/* ---------- 解析下限（#FFE9A8 参考） ---------- */
function analytic() {
  const board = parseColor('#FFE9A8');
  const backdrop = { r: 46, g: 34, b: 20, a: 0.42 };
  const ink = parseColor('#1E1E2A');
  const surface = parseColor('#FFFFFF');
  const out = [];
  /* R2-11 后口径：天气时刻已与普通弹窗同层压暗（无稀释行）；
     浮签底为 R1-E1 修正后的 ink 75% */
  for (const [name, bdA] of [['正常压暗 .42（天气时刻同此口径）', 0.42]]) {
    const boardEff = over({ ...backdrop, a: bdA }, board);
    const pillBg = over({ ...ink, a: 0.75 }, boardEff);
    const noteBg = over({ ...surface, a: 0.84 }, boardEff);
    out.push({ combo: `浮签 白字/${name}`, fg: fmtC(surface), effBg: fmtC(pillBg), contrast: Number(contrast(surface, pillBg).toFixed(2)) });
    out.push({ combo: `浮丸 墨字/${name}`, fg: fmtC(ink), effBg: fmtC(noteBg), contrast: Number(contrast(ink, noteBg).toFixed(2)) });
  }
  return out;
}

/* ---------- 主流程 ---------- */
const allRows = [];
const browser = await chromium.launch({ args: GL_ARGS });
for (const [name, ctxOpts, vw, vh] of [
  ['desktop-1280x800', { viewport: { width: 1280, height: 800 } }, 1280, 800],
  ['phone-874x402', { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }, 874, 402],
]) {
  console.log(`\n===== ${name} =====`);
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('maicai-lang', 'en');
    } catch { /* ignore */ }
  });
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(3000);

  // —— 态 A：普通站点弹窗（市场站；E1_ONLY=B 时跳过，省 SwiftShader 时间） ——
  const okA = process.env.E1_ONLY === 'B' ? false : await jumpTo(page, 2, 'panel-market');
  console.log(`  态A 市场站弹窗: ${okA ? '已打开' : '未打开（记录缺失）'}`);
  if (okA) {
    await page.waitForTimeout(600);
    await railTop(page);
    allRows.push(...(await sampleState(page, vw, vh, `${name} A-普通弹窗(市场)`, null)));
  }

  // —— 态 B：事件站天气时刻（spin → card） ——
  const okB = await jumpTo(page, 5, 'panel-event');
  console.log(`  态B 事件站: ${okB ? '已打开' : '未打开（记录缺失）'}`);
  if (okB) {
    let spun = false;
    let carded = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 120_000 && !(spun && carded)) {
      const phase = await page
        .evaluate(() => {
          const wm = document.querySelector('.weather-moment');
          if (!wm) return 'none';
          return wm.querySelector('.moment-card') ? 'card' : 'spin';
        })
        .catch(() => 'none');
      if (phase === 'spin' && !spun) {
        spun = true;
        await railTop(page);
        allRows.push(...(await sampleState(page, vw, vh, `${name} B-天气spin`, ['.popup-head', '.weather-result', '.panel-text'])));
      } else if (phase === 'card' && !carded) {
        carded = true;
        await railTop(page);
        allRows.push(...(await sampleState(page, vw, vh, `${name} B-天气card`, ['.popup-head', '.moment-tap', '.panel-text'])));
      } else if (phase === 'none') {
        // 还卡在 ACK/牌堆等前置步（AutoPanel 主按钮或 board-enter）→ 补点推进
        await page
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
        await page.waitForTimeout(250);
      } else {
        await page.waitForTimeout(120);
      }
    }
    console.log(`  态B 采样: spin=${spun} card=${carded}`);
  }
  await ctx.close();
}
await browser.close();

console.log('\n===== E1 实测表（worst = 环带最亮像素 / p95 = 95 分位亮度像素） =====');
for (const r of allRows) {
  const flag = r.contrast === null ? '  ? ' : r.contrast >= 4.5 ? 'PASS' : '🔴FAIL';
  console.log(
    `${flag} ${r.contrast ?? 'n/a'}:1 | ${r.state} | ${r.element} "${r.text}" | fg=${r.fg} ownBg=${r.ownBg} ring=${r.ringPx} effBg=${r.effBg} | ${r.basis}`,
  );
}
console.log('\n===== 解析下限（棋盘参考 #FFE9A8 晴天扇区） =====');
for (const r of analytic()) {
  const flag = r.contrast >= 4.5 ? 'PASS' : '🔴FAIL';
  console.log(`${flag} ${r.contrast}:1 | ${r.combo} | fg=${r.fg} effBg=${r.effBg}`);
}
