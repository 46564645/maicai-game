/** Probe E1 补充：手机天气态 .weather-result / .moment-tap 补采（R1 团队反馈第 2 条）。
 * Usage: BASE=http://localhost:4173 node shots/probe-e1-phone-weather.mjs
 * 前置：vite preview 在 4173（dist = 当前构建）。
 *
 * 背景：probe-e1-contrast.mjs 两轮未采到手机 874×402 天气态的这两个元素。
 * 本脚本先诊断（元素 rect / 祖先链 / 裁剪祖先 / 命中测试 / .phone-rail 滚动状态），
 * 再用与原探针完全一致的口径采样：computed 前景色 + CDP 截图环带（4–16px）
 * 真实合成像素，worst(max) 与 p95 两口径，WCAG 公式。
 * 若元素在竖栏（.phone-rail，可滚动）折叠线以下，按孩子真实操作路径滚动竖栏
 * 使其入视后再采——不搬位、不改样式。采样函数与原探针逐字一致。
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const VW = 874;
const VH = 402;

/* ---------- 颜色工具（与原探针逐字一致） ---------- */
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

/* ---------- 页面内采样（与原探针逐字一致） ---------- */
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

/* ---------- 诊断（本补充脚本新增） ---------- */
const DIAG_FN = (sel) => {
  const rail = document.querySelector('.phone-rail');
  const railRect = rail ? rail.getBoundingClientRect() : null;
  const name = (n) => n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).join('.') : '');
  const els = [...document.querySelectorAll(sel)];
  return {
    rail: rail
      ? {
          scrollTop: rail.scrollTop,
          scrollHeight: rail.scrollHeight,
          clientHeight: rail.clientHeight,
          rect: { x: railRect.x, y: railRect.y, w: railRect.width, h: railRect.height },
        }
      : null,
    count: els.length,
    items: els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const chain = [];
      let n = el;
      while (n && n !== document.body && chain.length < 12) {
        chain.push(name(n));
        n = n.parentElement;
      }
      const clippers = [];
      n = el.parentElement;
      while (n && n !== document.body) {
        const acs = getComputedStyle(n);
        if (/(auto|scroll|hidden|clip)/.test(acs.overflowX) || /(auto|scroll|hidden|clip)/.test(acs.overflowY)) {
          const ar = n.getBoundingClientRect();
          clippers.push({
            node: name(n),
            overflow: `${acs.overflowX}/${acs.overflowY}`,
            rect: { x: Math.round(ar.x), y: Math.round(ar.y), w: Math.round(ar.width), h: Math.round(ar.height) },
            elOutside:
              r.bottom > ar.bottom + 0.5 || r.top < ar.top - 0.5 || r.right > ar.right + 0.5 || r.left < ar.left - 0.5,
          });
        }
        n = n.parentElement;
      }
      let hit = 'center-outside-viewport';
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      if (cx >= 0 && cx < window.innerWidth && cy >= 0 && cy < window.innerHeight) {
        const top = document.elementFromPoint(cx, cy);
        hit = !top ? 'none' : top === el || el.contains(top) ? 'self-or-child' : name(top);
      }
      return {
        i,
        text: (el.textContent ?? '').trim().slice(0, 40),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        color: cs.color,
        bg: cs.backgroundColor,
        inViewport:
          r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth,
        fullyInViewport: r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth,
        inRail: rail ? rail.contains(el) : null,
        // 元素相对竖栏可见区的位置：fullyVisible / above / below / partial
        vsRail:
          !rail || !railRect
            ? 'no-rail'
            : r.bottom <= railRect.y
              ? 'above-rail-view'
              : r.top >= railRect.y + railRect.height
                ? 'below-rail-view'
                : r.top >= railRect.y && r.bottom <= railRect.y + railRect.height
                  ? 'fully-in-rail-view'
                  : 'partial-in-rail-view',
        chain,
        clippers,
        hit,
      };
    }),
  };
};

const CTX_FN = () => {
  const out = {};
  for (const sel of ['.phone-turn', '.popup-head', '.popup', '.weather-moment', '.weather-spin', '.moment-card']) {
    const el = document.querySelector(sel);
    if (!el) {
      out[sel] = null;
      continue;
    }
    const r = el.getBoundingClientRect();
    out[sel] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }
  return out;
};

/** 滚动竖栏使目标元素进入竖栏可见区（孩子真实路径：竖栏是页面内唯一滚动容器，滑动它即可）。
 *  返回滚动前后 scrollTop 与元素新 rect。 */
const SCROLL_REVEAL_FN = (sel) => {
  const rail = document.querySelector('.phone-rail');
  const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length > 0);
  if (!rail || !el) return null;
  const before = rail.scrollTop;
  const rr = rail.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const elCenter = r.y + r.height / 2;
  const railCenter = rr.y + rr.height / 2;
  const delta = elCenter - railCenter;
  rail.scrollTop = Math.max(0, Math.min(rail.scrollHeight - rail.clientHeight, before + delta));
  const r2 = el.getBoundingClientRect();
  return {
    scrollTopBefore: Math.round(before),
    scrollTopAfter: Math.round(rail.scrollTop),
    rectAfter: { x: Math.round(r2.x), y: Math.round(r2.y), w: Math.round(r2.width), h: Math.round(r2.height) },
  };
};

/* ---------- 驱动（同原探针口径） ---------- */
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

const phaseOf = (page) =>
  page
    .evaluate(() => {
      const wm = document.querySelector('.weather-moment');
      if (!wm) return 'none';
      return wm.querySelector('.moment-card') ? 'card' : 'spin';
    })
    .catch(() => 'none');

/** 对一个元素采样（原探针口径），返回行数组或 null（未命中） */
async function sampleOne(page, sel, label) {
  const st = await page.evaluate(STYLE_FN, sel).catch(() => null);
  if (!st) return null;
  const b64 = await screenshotB64(page);
  const ring = await page.evaluate(RING_FN, { b64, rect: st.rect, vw: VW, vh: VH }).catch(() => null);
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
      element: sel,
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

function printDiag(tag, diag) {
  console.log(`  [诊断 ${tag}] count=${diag.count} rail=${diag.rail ? `scrollTop=${diag.rail.scrollTop}/${diag.rail.scrollHeight} clientH=${diag.rail.clientHeight} rect=${JSON.stringify(diag.rail.rect)}` : 'none'}`);
  for (const it of diag.items) {
    console.log(
      `    #${it.i} "${it.text}" rect=${JSON.stringify(it.rect)} display=${it.display} vis=${it.visibility} op=${it.opacity} inVP=${it.inViewport} fullVP=${it.fullyInViewport} inRail=${it.inRail} vsRail=${it.vsRail} hit=${it.hit}`,
    );
    console.log(`      chain: ${it.chain.join(' < ')}`);
    for (const c of it.clippers) console.log(`      clipper: ${c.node} overflow=${c.overflow} rect=${JSON.stringify(c.rect)} elOutside=${c.elOutside}`);
  }
}

/* ---------- 主流程：手机视口，事件站天气 spin → card ---------- */
const allRows = [];
const notes = [];
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, hasTouch: true, isMobile: true });
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

let spinDone = false;
let cardDone = false;

for (let attempt = 1; attempt <= 3 && !(spinDone && cardDone); attempt++) {
  console.log(`\n===== 尝试 ${attempt}：跳事件站 =====`);
  const ok = await jumpTo(page, 5, 'panel-event');
  console.log(`  事件站: ${ok ? '已打开' : '未打开'}`);
  if (!ok) continue;
  const t0 = Date.now();
  let diagSpinDone = attempt > 1 && spinDone;
  let diagCardDone = attempt > 1 && cardDone;
  while (Date.now() - t0 < 120_000 && !(spinDone && cardDone)) {
    const phase = await phaseOf(page);
    if (phase === 'spin' && !spinDone) {
      console.log('  --- spin 相位 ---');
      console.log('  上下文 rect:', JSON.stringify(await page.evaluate(CTX_FN)));
      const dRes = await page.evaluate(DIAG_FN, '.weather-result');
      printDiag('spin .weather-result', dRes);
      const dTap = await page.evaluate(DIAG_FN, '.moment-tap');
      printDiag('spin .moment-tap', dTap);
      // 先按原探针口径（railTop 后）直接采
      await railTop(page);
      let rows = (await phaseOf(page)) === 'spin' ? await sampleOne(page, '.weather-result', 'phone-874x402 B-天气spin (railTop=0)') : null;
      if (!rows) {
        // 未命中 → 滚动竖栏（孩子真实路径）后补采
        const sc = await page.evaluate(SCROLL_REVEAL_FN, '.weather-result').catch(() => null);
        console.log(`  滚动竖栏揭示 .weather-result: ${JSON.stringify(sc)}`);
        if (sc) notes.push(`spin: .weather-result 在 scrollTop=0 时未命中，滚动竖栏 ${sc.scrollTopBefore}→${sc.scrollTopAfter}px 后入视采样`);
        await page.waitForTimeout(350);
        if ((await phaseOf(page)) === 'spin') rows = await sampleOne(page, '.weather-result', 'phone-874x402 B-天气spin (滚动竖栏后)');
      }
      if (rows && (await phaseOf(page)) === 'spin') {
        allRows.push(...rows);
        spinDone = true;
        console.log('  spin 采样完成');
      } else if (rows) {
        notes.push('spin: 采样期间相位已翻到 card，该次采样作废并重试');
        console.log('  spin 采样期间相位已翻转，作废重试');
      } else {
        console.log('  spin 采样仍未命中');
      }
      diagSpinDone = true;
    } else if (phase === 'card' && !cardDone) {
      console.log('  --- card 相位 ---');
      console.log('  上下文 rect:', JSON.stringify(await page.evaluate(CTX_FN)));
      const dTap = await page.evaluate(DIAG_FN, '.moment-tap');
      printDiag('card .moment-tap', dTap);
      const dRes = await page.evaluate(DIAG_FN, '.weather-result');
      printDiag('card .weather-result', dRes);
      await railTop(page);
      let rows = await sampleOne(page, '.moment-tap', 'phone-874x402 B-天气card (railTop=0)');
      if (!rows) {
        const sc = await page.evaluate(SCROLL_REVEAL_FN, '.moment-tap').catch(() => null);
        console.log(`  滚动竖栏揭示 .moment-tap: ${JSON.stringify(sc)}`);
        if (sc) notes.push(`card: .moment-tap 在 scrollTop=0 时未命中，滚动竖栏 ${sc.scrollTopBefore}→${sc.scrollTopAfter}px 后入视采样`);
        await page.waitForTimeout(350);
        rows = await sampleOne(page, '.moment-tap', 'phone-874x402 B-天气card (滚动竖栏后)');
      }
      if (rows) {
        allRows.push(...rows);
        cardDone = true;
        console.log('  card 采样完成');
      } else {
        console.log('  card 采样仍未命中');
      }
      diagCardDone = true;
      // card 已采完则点掉天气卡收尾，避免空转
      if (spinDone) break;
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
      await page.waitForTimeout(250);
    } else {
      await page.waitForTimeout(120);
    }
  }
  console.log(`  尝试 ${attempt} 结束: spin=${spinDone} card=${cardDone}`);
}
await ctx.close();
await browser.close();

console.log('\n===== E1 补采实测表（手机 874×402 天气态） =====');
for (const r of allRows) {
  const flag = r.contrast === null ? '  ? ' : r.contrast >= 4.5 ? 'PASS' : '🔴FAIL';
  console.log(
    `${flag} ${r.contrast ?? 'n/a'}:1 | ${r.state} | ${r.element} "${r.text}" | rect=${JSON.stringify(r.rect)} fg=${r.fg} ownBg=${r.ownBg} ring=${r.ringPx}(n=${r.ringN}) effBg=${r.effBg} | ${r.basis}`,
  );
}
if (notes.length) {
  console.log('\n===== 采样说明 =====');
  for (const n of notes) console.log(`  - ${n}`);
}
console.log(`\nspin 采到=${spinDone} card 采到=${cardDone}`);
