/** Probe E1 补充 5：手机天气 spin 态 .weather-result 抢拍（fromSurface + 帧自证版）。
 * Usage: BASE=http://localhost:4173 node shots/probe-e1-phone-spin4.mjs
 *
 * 前三版教训：spin 窗口 1500ms；fromSurface:false 在 spin 动画期间等一帧
 * 新画面要 ~30s（SwiftShader 软件合成），bracketing 必然失败。
 * 本版改 fromSurface:true —— 取合成器「已呈现的最后一帧」，不等待新帧，
 * 调用本身毫秒级；有效性靠两重证据：
 *  1) DOM bracketing：MutationObserver 记录的 spin 区间完整覆盖
 *     [PREP 时刻, 截图返回后时刻]（同 v2/v3）；
 *  2) 帧内容自证：解码抢拍帧，验证 (a) 静态指针 .weather-pointer（▼，
 *     主题色、不旋转、card 相位不存在）rect 内命中足够多主题色像素；
 *     (b) .weather-result rect 内命中足够多墨色文字像素。
 *     若帧是 spin 挂载前的陈旧帧（上一面板），(a)(b) 都不会命中。
 * 环带采样公式/口径与原探针一致（clip 坐标平移）。观测注入不改页面行为。
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
  const ptr = document.querySelector('.weather-pointer');
  const pr = ptr ? ptr.getBoundingClientRect() : null;
  return {
    sel,
    text: (el.textContent ?? '').trim().slice(0, 40),
    color: cs.color,
    bg: cs.backgroundColor,
    opacity: Number(cs.opacity),
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    pointer: ptr
      ? { rect: { x: pr.x, y: pr.y, w: pr.width, h: pr.height }, color: getComputedStyle(ptr).color }
      : null,
    railScrollTop: rail ? rail.scrollTop : null,
    railScrollHeight: rail ? rail.scrollHeight : null,
    scrolled,
    now: Math.round(performance.now()),
  };
};

/** 一次解码完成：环带采样（原口径）+ 帧自证（指针主题色像素 / 结果行墨色像素计数） */
const ANALYZE_FN = async ({ b64, rect, clip, pointerRect, pointerRGB, fgRGB }) => {
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
  const toImg = (rc) => ({
    x: (rc.x - clip.x) * sx,
    y: (rc.y - clip.y) * sy,
    w: Math.max(1, rc.w * sx),
    h: Math.max(1, rc.h * sy),
  });
  const R = toImg(rect);
  const lum = (r, g, b) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  // —— 环带（与原探针一致：rect 外 4–16px） ——
  const pts = [];
  const x0 = Math.max(0, Math.floor(R.x - 16 * sx));
  const x1 = Math.min(cv.width - 1, Math.ceil(R.x + R.w + 16 * sx));
  const y0 = Math.max(0, Math.floor(R.y - 16 * sy));
  const y1 = Math.min(cv.height - 1, Math.ceil(R.y + R.h + 16 * sy));
  const data = cx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1).data;
  const pxAt = (X, Y) => {
    const i = ((Y - y0) * (x1 - x0 + 1) + (X - x0)) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      const inX = x >= R.x - 4 * sx && x <= R.x + R.w + 4 * sx;
      const inY = y >= R.y - 4 * sy && y <= R.y + R.h + 4 * sy;
      if (inX && inY) continue;
      const [r, g, b] = pxAt(x, y);
      pts.push({ r, g, b, L: lum(r, g, b) });
    }
  }
  let ring = null;
  if (pts.length) {
    pts.sort((a, b2) => a.L - b2.L);
    const p95 = pts[Math.min(pts.length - 1, Math.floor(pts.length * 0.95))];
    const max = pts[pts.length - 1];
    ring = { n: pts.length, p95: { r: p95.r, g: p95.g, b: p95.b }, max: { r: max.r, g: max.g, b: max.b } };
  }
  // —— 自证 1：结果行 rect 内墨色文字像素 ——
  let inkHits = 0;
  const ix0 = Math.max(0, Math.floor(R.x));
  const ix1 = Math.min(cv.width - 1, Math.ceil(R.x + R.w));
  const iy0 = Math.max(0, Math.floor(R.y));
  const iy1 = Math.min(cv.height - 1, Math.ceil(R.y + R.h));
  const full = cx.getImageData(0, 0, cv.width, cv.height).data;
  const fp = (X, Y) => {
    const i = (Y * cv.width + X) * 4;
    return [full[i], full[i + 1], full[i + 2]];
  };
  for (let y = iy0; y <= iy1; y++) {
    for (let x = ix0; x <= ix1; x++) {
      const [r, g, b] = fp(x, y);
      if (Math.abs(r - fgRGB.r) + Math.abs(g - fgRGB.g) + Math.abs(b - fgRGB.b) < 90) inkHits++;
    }
  }
  // —— 自证 2：指针 rect 内主题色像素 ——
  let ptrHits = -1;
  if (pointerRect && pointerRGB) {
    ptrHits = 0;
    const P = toImg(pointerRect);
    const px0 = Math.max(0, Math.floor(P.x));
    const px1 = Math.min(cv.width - 1, Math.ceil(P.x + P.w));
    const py0 = Math.max(0, Math.floor(P.y));
    const py1 = Math.min(cv.height - 1, Math.ceil(P.y + P.h));
    for (let y = py0; y <= py1; y++) {
      for (let x = px0; x <= px1; x++) {
        const [r, g, b] = fp(x, y);
        if (Math.abs(r - pointerRGB.r) + Math.abs(g - pointerRGB.g) + Math.abs(b - pointerRGB.b) < 90) ptrHits++;
      }
    }
  }
  return { ring, inkHits, ptrHits, imgW: cv.width, imgH: cv.height };
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

let captured = null;
for (let attempt = 1; attempt <= 5 && !captured; attempt++) {
  console.log(`\n===== spin 抢拍 v4 尝试 ${attempt} =====`);
  const ok = await jumpTo(page, 5, 'panel-event');
  console.log(`  事件站: ${ok ? '已打开' : '未打开'}`);
  if (!ok) continue;
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000 && !captured) {
    const phase = await phaseOf(page);
    if (phase === 'spin') {
      const prep = await page.evaluate(PREP_FN, '.weather-result').catch(() => null);
      if (!prep) {
        console.log('  PREP 未拿到元素（窗口内重试）');
        continue;
      }
      const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: CLIP });
      const tail = await page.evaluate(() => ({
        p1: Math.round(performance.now()),
        log: window.__spinLog,
        stillSpin: !!document.querySelector('.weather-spin'),
      }));
      const starts = tail.log.filter((e) => e.type === 'start');
      const s = starts[starts.length - 1]?.t;
      const e = tail.log.find((x) => x.type === 'end' && s !== undefined && x.t > s)?.t ?? (tail.stillSpin ? Infinity : undefined);
      console.log(
        `  spin=[${s},${e}] prep@${prep.now} p1=${tail.p1} scrolled=${JSON.stringify(prep.scrolled)} rect=${JSON.stringify(prep.rect)}`,
      );
      if (s !== undefined && e !== undefined && s <= prep.now && e >= tail.p1) {
        captured = { prep, b64: res.data, bracket: [s, e, prep.now, tail.p1], attempt };
        console.log('  bracketing 通过，待帧自证');
      } else {
        console.log('  bracketing 未覆盖，作废');
        break;
      }
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
      break;
    }
  }
}
await ctx.close();

if (captured) {
  const st = captured.prep;
  const fg = parseColor(st.color);
  const ownBg = parseColor(st.bg);
  const ptrRGB = st.pointer ? parseColor(st.pointer.color) : null;
  const ctx2 = await browser.newContext({ viewport: { width: VW, height: VH } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const an = await page2
    .evaluate(ANALYZE_FN, {
      b64: captured.b64,
      rect: st.rect,
      clip: CLIP,
      pointerRect: st.pointer?.rect ?? null,
      pointerRGB: ptrRGB ? { r: ptrRGB.r, g: ptrRGB.g, b: ptrRGB.b } : null,
      fgRGB: { r: fg.r, g: fg.g, b: fg.b },
    })
    .catch((err) => {
      console.log('  分析失败:', String(err));
      return null;
    });
  await ctx2.close();
  console.log(`\n  帧自证: inkHits=${an?.inkHits} ptrHits=${an?.ptrHits} img=${an?.imgW}x${an?.imgH}`);
  const certOk = an && an.inkHits >= 40 && an.ptrHits >= 5;
  console.log(`  自证结论: ${certOk ? '通过（帧内确有指针主题色与结果行墨色文字）' : '未通过——该帧不可认账'}`);
  if (certOk && an.ring) {
    const ring = an.ring;
    console.log('\n===== E1 补采：手机 874×402 天气 spin .weather-result =====');
    console.log(
      `  bracketing: spin=[${captured.bracket[0]},${captured.bracket[1]}]ms 覆盖 [prep ${captured.bracket[2]}, p1 ${captured.bracket[3]}]ms；fromSurface 已呈现帧 + 内容自证 ink=${an.inkHits} ptr=${an.ptrHits}；railScrollTop=${st.railScrollTop}/${st.railScrollHeight} scrolled=${JSON.stringify(st.scrolled)}`,
    );
    for (const [tag, px] of [['worst(max)', ring.max], ['p95', ring.p95]]) {
      let effBg = { ...px, a: 1 };
      if (ownBg && ownBg.a > 0) effBg = over(ownBg, effBg);
      let effFg = fg;
      if (st.opacity < 1) effFg = over({ ...fg, a: fg.a * st.opacity }, effBg);
      const c = Number(contrast(effFg, effBg).toFixed(2));
      const flag = c >= 4.5 ? 'PASS' : '🔴FAIL';
      console.log(
        `${flag} ${c}:1 | phone-874x402 B-天气spin | .weather-result "${st.text}" | rect=${JSON.stringify({ x: Math.round(st.rect.x), y: Math.round(st.rect.y), w: Math.round(st.rect.w), h: Math.round(st.rect.h) })} fg=${fmtC(fg)} ownBg=${fmtC(ownBg)} ring=${fmtC({ ...px, a: 1 })}(n=${ring.n}) effBg=${fmtC(effBg)} | ${tag}`,
      );
    }
  }
} else {
  console.log('\n spin 抢拍 v4 5 次均未通过 bracketing');
}
await browser.close();
