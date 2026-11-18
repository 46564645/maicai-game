/** r8-rects-only.mjs — 只量几何不截图：补缺/修正 r8_rects_<tag>.json 的 free rect。
 * overlay 只在「进入这一站」提示态可见；fast/demo 下站点面板随时弹出把它
 * display:none，所以轮询到 overlay 真可见的瞬间立刻同帧量取（r8-capture
 * 的 race 修不掉就补这里）。
 * Usage: BASE=... node shots/r8-rects-only.mjs <tag> <name...>
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] ?? 'r10a';
const NAMES = process.argv.slice(3);
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const CASES = {
  'desktop-1024x768': [1024, 768],
  'desktop-1280x800': [1280, 800],
  'desktop-1440x900': [1440, 900],
  'desktop-1600x1000': [1600, 1000],
  'desktop-1920x1080': [1920, 1080],
};

const browser = await chromium.launch({ args: GL_ARGS });
const rectsFile = path.join(OUT, `r8_rects_${TAG}.json`);
const all = fs.existsSync(rectsFile) ? JSON.parse(fs.readFileSync(rectsFile, 'utf8')) : {};

const MEASURE = `(() => {
  const R = (el) => el ? el.getBoundingClientRect().toJSON() : null;
  const q = (s) => document.querySelector(s);
  const gl = q('.game-left'), gr = q('.game-right');
  const tb = q('.game-topbar'), ov = q('.board3d-overlay'), gb = q('.game-bottom');
  const ovr = R(ov), gbr = R(gb);
  if (!ovr || ovr.height === 0) return null;
  const left = R(gl) ? R(gl).x + R(gl).width : 0;
  const right = R(gr) ? R(gr).x : window.innerWidth;
  const top = R(tb) ? R(tb).y + R(tb).height : 0;
  const bottom = ovr.y;
  return { free: { x: left, y: top, w: right - left, h: bottom - top },
           bottomBar: gbr, overlay: ovr };
})()`;

for (const name of NAMES) {
  const [w, h] = CASES[name];
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  // 不开 fast/demo：真人回合的「进入这一站」提示会一直停着等点，overlay
  // 一旦可见就保持可见——等到再量，确定性无 race。
  await page.goto(`${BASE}/?board=3d&seed=1`);
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  let m = null;
  for (let i = 0; i < 300 && !m; i++) {
    m = await page.evaluate(MEASURE);
    if (!m) await page.waitForTimeout(400);
  }
  if (!m) throw new Error(`${name}: overlay never visible`);
  all[name] = { ...(all[name] ?? {}), ...m };
  console.log(name, 'free=', JSON.stringify(m.free), 'bottomBar.h=', m.bottomBar?.height);
  fs.writeFileSync(rectsFile, JSON.stringify(all, null, 2));
  await ctx.close();
}
await browser.close();
console.log('merged ->', rectsFile);
