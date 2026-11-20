/** Probe E1 补充 7：手机天气 spin 态 .weather-result 采样（screencast 帧流版）。
 * Usage: BASE=http://localhost:4173 node shots/probe-e1-phone-spin7.mjs
 *
 * 前版结论：Page.captureScreenshot 在本机（SwiftShader）有 ~4.1s（预热后）
 * 至 ~30s（未预热）的固定成本，spin 窗口只有 1.5s，按需捕获不可能落窗。
 * 本版改用 Page.startScreencast：合成器为转盘动画持续产帧并推送，每帧带
 * 呈现时间戳（metadata.timestamp，epoch 秒）。认账条件：
 *  1) 帧时间戳严格落在 MutationObserver 记录的 spin 区间内
 *     （经 performance.timeOrigin 换算到 epoch 毫秒）；
 *  2) 帧内容自证：指针 .weather-pointer 主题色像素 + 结果行墨色文字像素
 *     在帧内命中（同 v4 ANALYZE_FN）。
 * 环带采样口径与原探针一致（全视口帧，坐标零平移）。观测注入不改页面行为。
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const VW = 874;
const VH = 402;
const FULLCLIP = { x: 0, y: 0, width: VW, height: VH };

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

/* 与 v4 ANALYZE_FN 相同：环带（原口径）+ 自证计数；clip 传全视口即零平移 */
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
await page.goto(`${BASE}/?board=2d&seed=1&fast=1&demo=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(3000);

const timeOrigin = await page.evaluate(() => performance.timeOrigin);
console.log(`  timeOrigin=${timeOrigin}`);
const cdp = await page.context().newCDPSession(page);

/* —— 预热（让捕获/渲染管线进入稳态） —— */
console.log('===== 预热访问事件站 =====');
await jumpTo(page, 5, 'panel-event');
{
  const t0 = Date.now();
  let warmed = false;
  while (Date.now() - t0 < 120_000 && !warmed) {
    const ph = await phaseOf(page);
    if (ph === 'card') {
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

/* —— screencast 抢帧 —— */
const frames = []; // {tsMs(epoch), data}
cdp.on('Page.screencastFrame', (ev) => {
  frames.push({ tsMs: Math.round(ev.metadata.timestamp * 1000), data: ev.data, sessionId: ev.sessionId });
  if (frames.length > 60) frames.splice(0, frames.length - 60);
  cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
});

let result = null;
let control = null;
for (let attempt = 1; attempt <= 4 && !result; attempt++) {
  console.log(`\n===== spin screencast 尝试 ${attempt} =====`);
  frames.length = 0;
  await cdp.send('Page.startScreencast', { format: 'png', maxWidth: VW, maxHeight: VH, everyNthFrame: 1 }).catch((e) => console.log('  startScreencast 失败:', String(e)));
  const ok = await jumpTo(page, 5, 'panel-event');
  console.log(`  事件站: ${ok ? '已打开' : '未打开'}`);
  if (!ok) {
    await cdp.send('Page.stopScreencast').catch(() => {});
    continue;
  }
  const t0 = Date.now();
  let prep = null;
  let interval = null;
  while (Date.now() - t0 < 90_000) {
    const ph = await phaseOf(page);
    if (ph === 'spin' && !prep) {
      prep = await page.evaluate(PREP_FN, '.weather-result').catch(() => null);
      console.log(`  PREP: ${prep ? `"${prep.text}" rect=${JSON.stringify(prep.rect)} scrollTop=${prep.railScrollTop}` : '未拿到'}`);
    }
    if (ph === 'card' || (ph === 'none' && prep)) {
      // spin 已结束：取区间
      const log = await page.evaluate(() => window.__spinLog).catch(() => []);
      const starts = log.filter((e) => e.type === 'start');
      const s = starts[starts.length - 1]?.t;
      const e = log.find((x) => x.type === 'end' && s !== undefined && x.t > s)?.t;
      if (s !== undefined && e !== undefined) interval = { s, e };
      break;
    }
    if (ph === 'none') {
      await advanceOnce(page);
      await page.waitForTimeout(200);
    } else {
      await page.waitForTimeout(120);
    }
  }
  await cdp.send('Page.stopScreencast').catch(() => {});
  console.log(`  本轮帧数=${frames.length} spin 区间=${JSON.stringify(interval)}`);
  /* —— 对照采样：同轮 card 相位 .moment-tap（2D），与 3D 实测 16.4 对照 —— */
  if (!control && (await phaseOf(page)) === 'card') {
    const cp = await page.evaluate(PREP_FN, '.moment-tap').catch(() => null);
    if (cp) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
      const cfg = parseColor(cp.color);
      const can = await page
        .evaluate(ANALYZE_FN, {
          b64: shot.data,
          rect: cp.rect,
          clip: FULLCLIP,
          pointerRect: null,
          pointerRGB: null,
          fgRGB: { r: cfg.r, g: cfg.g, b: cfg.b },
        })
        .catch(() => null);
      if (can && can.ring) {
        control = { prep: cp, ring: can.ring };
        console.log(`  对照 .moment-tap[2D] 已采: rect=${JSON.stringify(cp.rect)} scrolled=${JSON.stringify(cp.scrolled)}`);
      }
    }
  }
  if (!interval || !prep) continue;
  const lo = timeOrigin + interval.s;
  const hi = timeOrigin + interval.e;
  const inWin = frames.filter((f) => f.tsMs > lo && f.tsMs < hi);
  console.log(`  落窗帧=${inWin.length}（窗口 epoch ${lo}..${hi}；帧时间戳 ${frames.map((f) => f.tsMs).slice(-8).join(',')}）`);
  if (inWin.length === 0) continue;
  // 取窗口正中间的一帧分析
  const pick = inWin[Math.floor(inWin.length / 2)];
  const fg = parseColor(prep.color);
  const ptrRGB = prep.pointer ? parseColor(prep.pointer.color) : null;
  const ctx2 = await browser.newContext({ viewport: { width: VW, height: VH } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const an = await page2
    .evaluate(ANALYZE_FN, {
      b64: pick.data,
      rect: prep.rect,
      clip: FULLCLIP,
      pointerRect: prep.pointer?.rect ?? null,
      pointerRGB: ptrRGB ? { r: ptrRGB.r, g: ptrRGB.g, b: ptrRGB.b } : null,
      fgRGB: { r: fg.r, g: fg.g, b: fg.b },
    })
    .catch((err) => {
      console.log('  分析失败:', String(err));
      return null;
    });
  await ctx2.close();
  console.log(`  帧自证: inkHits=${an?.inkHits} ptrHits=${an?.ptrHits} img=${an?.imgW}x${an?.imgH} frameTs=${pick.tsMs}`);
  if (an && an.inkHits >= 40 && an.ptrHits >= 5 && an.ring) {
    result = { prep, an, pick, interval, attempt };
    console.log('  认账：时间戳落窗 + 内容自证通过');
  } else {
    console.log('  自证未通过，作废');
  }
}
await ctx.close();

if (result) {
  const { prep: st, an } = result;
  const fg = parseColor(st.color);
  const ownBg = parseColor(st.bg);
  const ring = an.ring;
  console.log('\n===== E1 补采：手机 874×402 天气 spin .weather-result =====');
  console.log(
    `  证据链: spin 区间=[${result.interval.s},${result.interval.e}]ms(perf)；帧时间戳 epoch=${result.pick.tsMs}（窗内）；自证 ink=${an.inkHits} ptr=${an.ptrHits}；railScrollTop=${st.railScrollTop}/${st.railScrollHeight} scrolled=${JSON.stringify(st.scrolled)}`,
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
} else {
  console.log('\n spin screencast 4 次均未拿到可认账帧');
}
if (control) {
  const st = control.prep;
  const fg = parseColor(st.color);
  const ownBg = parseColor(st.bg);
  console.log('\n===== 对照：手机 874×402 天气 card .moment-tap [board=2d]（3D 实测为 16.4/16.4） =====');
  for (const [tag, px] of [['worst(max)', control.ring.max], ['p95', control.ring.p95]]) {
    let effBg = { ...px, a: 1 };
    if (ownBg && ownBg.a > 0) effBg = over(ownBg, effBg);
    let effFg = fg;
    if (st.opacity < 1) effFg = over({ ...fg, a: fg.a * st.opacity }, effBg);
    const c = Number(contrast(effFg, effBg).toFixed(2));
    const flag = c >= 4.5 ? 'PASS' : '🔴FAIL';
    console.log(
      `${flag} ${c}:1 | phone-874x402 B-天气card [board=2d 对照] | .moment-tap "${st.text}" | rect=${JSON.stringify({ x: Math.round(st.rect.x), y: Math.round(st.rect.y), w: Math.round(st.rect.w), h: Math.round(st.rect.h) })} fg=${fmtC(fg)} ownBg=${fmtC(ownBg)} ring=${fmtC({ ...px, a: 1 })}(n=${control.ring.n}) effBg=${fmtC(effBg)} | ${tag} | scrolled=${JSON.stringify(st.scrolled)}`,
    );
  }
}
await browser.close();
