/** Probe E1 补充 8：手机天气 spin .weather-result —— board=2d 等价路径采样。
 * Usage: BASE=http://localhost:4173 node shots/probe-e1-phone-spin8.mjs
 *
 * 为什么可用 2D 模式采这个元素（源码核实，见 hud.css / phone.css）：
 *  - 手机形态判定只看视口与触摸（usePhoneMode），与棋盘 2D/3D 无关，
 *    弹窗 DOM 与竖栏布局两模式完全一致；
 *  - .weather-result 及其 4–16px 环带整体位于 .phone-rail 内，竖栏底是
 *    不透明 color-mix（--color-bg 92% + surface，无透明分量），棋盘像素
 *    不透出；天气洗色 ::before 在竖栏内 display:none，.board::after 洗色
 *    只盖棋盘元素；spin 期间 weather--* 布景类尚未挂（点掉大卡后才挂）；
 *  - 元素本体、转盘、指针都是纯 DOM/CSS，两模式渲染一致。
 * 3D 模式采不到的原因是测量环境：SwiftShader 下天气场景帧生产停滞
 * （captureScreenshot 预热后仍 ~4.1s、screencast 在 spin 区间零帧），
 * 与本元素像素无关。本脚本同时复采 card 相位 .moment-tap 作为对照：
 * 它已在 3D 模式实测 16.4/16.4（ring 255,251,246）——若 2D 复采同值，
 * 即实证「竖栏内元素环带像素与棋盘模式无关」。
 * 采样口径与原探针逐字一致：STYLE_FN + CDP 全屏截图 + RING_FN 环带。
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

async function screenshotB64(page) {
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  return res.data;
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

const SCROLL_REVEAL_FN = (sel) => {
  const rail = document.querySelector('.phone-rail');
  const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length > 0);
  if (!rail || !el) return null;
  const before = rail.scrollTop;
  const rr = rail.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const delta = r.y + r.height / 2 - (rr.y + rr.height / 2);
  rail.scrollTop = Math.max(0, Math.min(rail.scrollHeight - rail.clientHeight, before + delta));
  const r2 = el.getBoundingClientRect();
  return {
    scrollTopBefore: Math.round(before),
    scrollTopAfter: Math.round(rail.scrollTop),
    rectAfter: { x: Math.round(r2.x), y: Math.round(r2.y), w: Math.round(r2.width), h: Math.round(r2.height) },
  };
};

function rowsFrom(st, ring, label) {
  const fg = parseColor(st.color);
  const ownBg = parseColor(st.bg);
  const rows = [];
  for (const [tag, px] of ring ? [['worst(max)', ring.max], ['p95', ring.p95]] : [['no-ring', null]]) {
    let effBg = px ? { ...px, a: 1 } : null;
    if (effBg && ownBg && ownBg.a > 0) effBg = over(ownBg, effBg);
    let effFg = fg;
    if (effBg && fg && st.opacity < 1) effFg = over({ ...fg, a: fg.a * st.opacity }, effBg);
    rows.push({
      state: label,
      element: st.sel,
      text: st.text,
      rect: { x: Math.round(st.rect.x), y: Math.round(st.rect.y), w: Math.round(st.rect.w), h: Math.round(st.rect.h) },
      fg: fmtC(fg),
      ownBg: fmtC(ownBg),
      ringPx: px ? fmtC({ ...px, a: 1 }) : 'n/a',
      ringN: ring ? ring.n : 0,
      effBg: fmtC(effBg),
      basis: tag,
      contrast: effBg && effFg ? Number(contrast(effFg, effBg).toFixed(2)) : null,
    });
  }
  return rows;
}

/* ---------- 主流程：board=2d，手机视口 ---------- */
const allRows = [];
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript(() => {
  try {
    window.localStorage.setItem('maicai-lang', 'en');
  } catch { /* ignore */ }
});
await page.goto(`${BASE}/?board=2d&seed=1&fast=1&demo=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(2500);

let spinDone = false;
let cardDone = false;
for (let attempt = 1; attempt <= 3 && !(spinDone && cardDone); attempt++) {
  console.log(`\n===== 2D 尝试 ${attempt}：跳事件站 =====`);
  const ok = await jumpTo(page, 5, 'panel-event');
  console.log(`  事件站: ${ok ? '已打开' : '未打开'}`);
  if (!ok) continue;
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000 && !(spinDone && cardDone)) {
    const phase = await phaseOf(page);
    if (phase === 'spin' && !spinDone) {
      const n0 = Date.now();
      let st = await page.evaluate(STYLE_FN, '.weather-result').catch(() => null);
      let scrolled = null;
      if (!st) {
        scrolled = await page.evaluate(SCROLL_REVEAL_FN, '.weather-result').catch(() => null);
        console.log(`  spin: STYLE 未命中，滚动竖栏揭示 ${JSON.stringify(scrolled)}`);
        st = await page.evaluate(STYLE_FN, '.weather-result').catch(() => null);
      }
      if (!st) {
        console.log('  spin: 滚动后仍未命中');
        break;
      }
      const b64 = await screenshotB64(page);
      const n1 = Date.now();
      const after = await phaseOf(page);
      console.log(`  spin: 截图腿耗时 ${n1 - n0}ms，截后相位=${after} railScrollTop=${st.railScrollTop}`);
      if (after !== 'spin') {
        console.log('  spin: 截图期间相位已翻，作废重试');
        break;
      }
      const ring = await page.evaluate(RING_FN, { b64, rect: st.rect, vw: VW, vh: VH }).catch(() => null);
      allRows.push(...rowsFrom(st, ring, `phone-874x402 B-天气spin [board=2d]${scrolled ? ' (滚动竖栏后)' : ''}`));
      spinDone = true;
      console.log('  spin 采样完成');
    } else if (phase === 'card' && !cardDone) {
      let st = await page.evaluate(STYLE_FN, '.moment-tap').catch(() => null);
      let scrolled = null;
      if (!st) {
        scrolled = await page.evaluate(SCROLL_REVEAL_FN, '.moment-tap').catch(() => null);
        console.log(`  card: STYLE 未命中，滚动竖栏揭示 ${JSON.stringify(scrolled)}`);
        await page.waitForTimeout(300);
        st = await page.evaluate(STYLE_FN, '.moment-tap').catch(() => null);
      }
      if (!st) {
        console.log('  card: 仍未命中');
        break;
      }
      const b64 = await screenshotB64(page);
      const ring = await page.evaluate(RING_FN, { b64, rect: st.rect, vw: VW, vh: VH }).catch(() => null);
      allRows.push(...rowsFrom(st, ring, `phone-874x402 B-天气card [board=2d 对照]${scrolled ? ' (滚动竖栏后)' : ''}`));
      cardDone = true;
      console.log('  card 对照采样完成');
    } else if (phase === 'none') {
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
      await page.waitForTimeout(200);
    } else {
      await page.waitForTimeout(120);
    }
  }
  console.log(`  尝试 ${attempt} 结束: spin=${spinDone} card=${cardDone}`);
}
await ctx.close();
await browser.close();

console.log('\n===== E1 补采（board=2d 等价路径）：手机 874×402 天气 spin .weather-result + card 对照 =====');
for (const r of allRows) {
  const flag = r.contrast === null ? '  ? ' : r.contrast >= 4.5 ? 'PASS' : '🔴FAIL';
  console.log(
    `${flag} ${r.contrast ?? 'n/a'}:1 | ${r.state} | ${r.element} "${r.text}" | rect=${JSON.stringify(r.rect)} fg=${r.fg} ownBg=${r.ownBg} ring=${r.ringPx}(n=${r.ringN}) effBg=${r.effBg} | ${r.basis}`,
  );
}
console.log(`\nspin 采到=${spinDone} card 对照采到=${cardDone}`);
