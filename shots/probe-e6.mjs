/** Probe E6: DOM 里永远只有一份可交互主按钮（R1 定稿 E6）。
 * Usage: BASE=http://localhost:4173 node shots/probe-e6.mjs [label]
 * 前置：先 npm run build，再起静态服务（npx vite preview --port 4173）。
 *
 * 采样口径（分开统计，报告里不要混）：
 *  - board 份：棋盘 overlay / 2D 棋盘中心里的 action-primary（本探针的主角，
 *    E6 根因 = BoardMount 外层 Suspense fallback 与 Board3D 同渲 children，
 *    GLTF 挂起时一份被 display:none 藏成 0×0、另一份是 fallback，DOM 双份）
 *  - popup 份：StationPopup 里的 action-primary；PopupOutlet 退场时会把
 *    上一份弹窗多留 ~170ms 淡出，站间切换瞬间可能与新弹窗同名共存——
 *    那是退场克隆，单独统计，不算 E6 违规。
 *  - zero：getBoundingClientRect 为 0×0 的份数（board 份里出现即违规）。
 *
 * 采样时点：进游戏加载期轮询（抓 Suspense 窗口）→ intro 主按钮出现 →
 * 进站（弹窗开）→ 站间切换数次 → 整页重载（强制 3D 重挂载）再轮询。
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const LABEL = process.argv[2] ?? 'e6';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const SAMPLE_FN = () => {
  const all = [...document.querySelectorAll('[data-testid="action-primary"]')];
  const cls = (el) => {
    const r = el.getBoundingClientRect();
    return {
      zero: r.width === 0 && r.height === 0,
      inPopup: !!el.closest('.popup'),
      inBoard: !!el.closest('.board, .board3d-overlay, .board-center'),
      visible: r.width > 0 && r.height > 0,
    };
  };
  const rows = all.map(cls);
  return {
    total: rows.length,
    zeroTotal: rows.filter((r) => r.zero).length,
    board: rows.filter((r) => r.inBoard).length,
    boardZero: rows.filter((r) => r.inBoard && r.zero).length,
    popup: rows.filter((r) => r.inPopup).length,
    popupZero: rows.filter((r) => r.inPopup && r.zero).length,
    other: rows.filter((r) => !r.inPopup && !r.inBoard).length,
  };
};

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));

const report = [];
const snap = async (label) => {
  const s = await page.evaluate(SAMPLE_FN).catch(() => null);
  report.push({ label, ...s });
  console.log(`[${LABEL}] ${label}:`, JSON.stringify(s));
  return s;
};

/** 轮询一段时间，记录 board 份与 0×0 的最大值（抓挂起窗口的瞬时双份） */
const pollMax = async (label, ms) => {
  const t0 = Date.now();
  let max = { total: 0, zeroTotal: 0, board: 0, boardZero: 0, popup: 0, popupZero: 0, other: 0 };
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(SAMPLE_FN).catch(() => null);
    if (s) {
      for (const k of Object.keys(max)) max[k] = Math.max(max[k], s[k] ?? 0);
    }
    await page.waitForTimeout(200);
  }
  report.push({ label: `${label} (max over ${ms}ms)`, ...max });
  console.log(`[${LABEL}] ${label} max:`, JSON.stringify(max));
  return max;
};

// —— 1) 进游戏：开局两步（开始 → 选角）后到游戏屏，加载期轮询抓双份 ——
await page.goto(`${BASE}/?board=3d&seed=1&demo=1`);
await page.locator('[data-testid="action-primary"]').first().click().catch(() => {});
await page.locator('[data-testid^="action-char-"]').first().click().catch(() => {});
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 30_000 });
await pollMax('load-into-game', 6000);
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(2500);
await snap('intro-primary-visible');

// —— 2) 进站：点 intro 主按钮 → 站点弹窗开（board 份应消失，popup 份 1） ——
await page.locator('.board3d-overlay [data-testid="action-primary"], .board-center [data-testid="action-primary"]')
  .first().click().catch(() => {});
await page.waitForTimeout(1200);
await snap('station-popup-open');

// —— 3) 站间切换：连点弹窗主按钮数次，退场克隆窗口单独看 popup 份 ——
for (let i = 0; i < 3; i++) {
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await snap(`after-popup-click-${i + 1}-instant`);
  await page.waitForTimeout(900);
  await snap(`after-popup-click-${i + 1}-settled`);
}

// —— 4) 强制 3D 重挂载：整页重载到同一局（board 参数不变），加载期再轮询 ——
// 注：SwiftShader 下整页 load 事件可 >30s（首跑实测超时），只等
// domcontentloaded，采样本身对慢加载免疫（evaluate 失败即跳过）。
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch((e) => {
  console.log('  reload navigation slow (continuing):', String(e).split('\n')[0]);
});
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 30_000 }).catch(() => null);
await pollMax('after-reload', 6000);
await snap('after-reload-settled');

// —— 5) board 参数切换：3d → 2d → 3d 各采一次 ——
await page.goto(`${BASE}/?board=2d&seed=1&demo=1`);
await page.waitForTimeout(1500);
await snap('board-2d-param');
await page.goto(`${BASE}/?board=3d&seed=1&demo=1`);
await pollMax('back-to-3d', 5000);
await snap('back-to-3d-settled');

console.log(`=== ${LABEL} summary ===`);
for (const r of report) console.log(JSON.stringify(r));
await browser.close();
