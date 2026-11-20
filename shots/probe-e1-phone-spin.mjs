/** Probe E1 补充 2：手机天气 spin 态 .weather-result 抢拍补采。
 * Usage: BASE=http://localhost:4173 node shots/probe-e1-phone-spin.mjs
 *
 * spin 相位只有约 1.5s（SwiftShader 下每个 evaluate/CDP 调用都很慢），
 * 常规顺序（诊断→railTop→采样）必错过。本脚本在相位出现的第一时间
 * 原子抢拍：STYLE_FN 取样式+rect → CDP 截图 → 立即复查相位仍为 spin 才认账；
 * 环带采样用抢拍到的像素在相位翻转后离线算，口径与原探针逐字一致
 * （computed 前景 + rect 外 4–16px 环带真实像素，worst/p95，WCAG 公式）。
 * 不做 railTop（原探针正是 railTop 把结果行顶出折叠线才漏采）；若元素在
 * 当前滚动位置下不在视口内，按孩子真实路径滚动竖栏后在同一相位内重试。
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
  return { scrollTopBefore: Math.round(before), scrollTopAfter: Math.round(rail.scrollTop) };
};

/* ---------- 主流程 ---------- */
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

let captured = null;
for (let attempt = 1; attempt <= 4 && !captured; attempt++) {
  console.log(`\n===== spin 抢拍尝试 ${attempt} =====`);
  const ok = await jumpTo(page, 5, 'panel-event');
  console.log(`  事件站: ${ok ? '已打开' : '未打开'}`);
  if (!ok) continue;
  const t0 = Date.now();
  let acted = false;
  while (Date.now() - t0 < 90_000 && !captured) {
    const phase = await phaseOf(page);
    if (phase === 'spin') {
      // —— 抢拍：样式+rect → 截图 → 复查相位 ——
      let st = await page.evaluate(STYLE_FN, '.weather-result').catch(() => null);
      let scrolled = null;
      if (!st) {
        scrolled = await page.evaluate(SCROLL_REVEAL_FN, '.weather-result').catch(() => null);
        st = await page.evaluate(STYLE_FN, '.weather-result').catch(() => null);
      }
      if (!st) {
        console.log('  spin 中 .weather-result 仍不在视口（罕见），等下一轮');
        await page.waitForTimeout(150);
        continue;
      }
      const b64 = await screenshotB64(page);
      const after = await phaseOf(page);
      if (after !== 'spin') {
        console.log(`  抢拍后相位已变（${after}），作废`);
        break; // 本次事件站的 spin 已过，下一尝试重新跳站
      }
      captured = { st, b64, scrolled, attempt };
      console.log(`  抢拍成功: "${st.text}" rect=${JSON.stringify(st.rect)} railScrollTop=${st.railScrollTop}/${st.railScrollHeight}${scrolled ? ` scrolled=${JSON.stringify(scrolled)}` : ''}`);
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
      // card 相位且未抢到 spin：本次作罢
      if (!acted) console.log('  spin 窗口已过（先到 card）');
      break;
    }
  }
}
await ctx.close();

if (captured) {
  // 环带采样在新页面离线算（像素来自抢拍截图，只需一个空白页解码）
  const ctx2 = await browser.newContext({ viewport: { width: VW, height: VH } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const ring = await page2.evaluate(RING_FN, { b64: captured.b64, rect: captured.st.rect, vw: VW, vh: VH }).catch(() => null);
  await ctx2.close();
  const { st } = captured;
  const fg = parseColor(st.color);
  const ownBg = parseColor(st.bg);
  console.log('\n===== E1 补采：手机 874×402 天气 spin .weather-result =====');
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
  console.log('\n spin 抢拍 4 次均未成功');
}
await browser.close();
