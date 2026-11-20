/** r10e-before2-shots.mjs — R1 切片 E「改前」补拍组（切片 D / d61918a 基线）。
 * Usage: node shots/r10e-before2-shots.mjs <phone|desktop-en|desktop-zh>
 * 前置：baseline worktree（~/workspace/maicai-d-baseline）已 build，
 *       其 vite preview 跑在 4174（BASE 可覆盖）。
 *
 * 目的：与改后组 shots/r10e_after_*（r10e-after-shots.mjs）同视口同口径对照
 * （ww 要求）。旧改前组 r10e_before_* 用旧驱动在 1440×900 / 844×390 拍，
 * 非同视口，本组替代之。
 * 口径（与改后组完全一致）：
 *  - phone：874×402（iPhone 17 Pro 横屏），与 tests/e2e/safearea.spec.ts
 *    相同的 --safe-* 注入（t20/r62/b20/l62）——D 里 --safe-* 变量同名，
 *    注入方式通用；
 *  - desktop-en / desktop-zh：1280×800，英文 + 中文模式对照；
 *  - 同 seed=1&fast=1、同进游戏路径、同站点（demo 跳站）、同语言。
 * 命名 shots/r10e_before2_<scene>_<en|zh>_<phone|desktop>.png，场景：
 *  board（E8 主场景：无 demo 的独立页，与改后 probe-e8 同 URL/同状态——
 *  进游戏后等 3D 棋盘 [data-testid="board3d"] 就绪再拍；对应改后
 *  r10e_e8_board_<desktop-1280x800|phone-874x402>.png）/
 *  market（市场站弹窗，首卡默认选中态）/
 *  hud（市场弹窗内点一次主按钮买下首卡后的同弹窗状态——与改后 hud 的
 *  拍法一致：改后驱动也是在市场态点 .popup action-primary 后拍；
 *  注：改后 hud 拍到的是去框浮卡形态，D 是白面板形态，这正是要对照的
 *  差异本身）/
 *  weather（事件站弹窗：天气转盘落定 + 已落定天气卡 + 未翻开的事件牌堆
 *  同框；独立新页跳站，避免前面站点的 bot 提议弹窗污染）/
 *  profile（仅 phone：点 .phone-bot 弹出的 BotCard 浮层——D 里查看 bot
 *  的唯一入口；桌面 D 的 .bot-card 是静态展示、无点击打开的证件卡，
 *  ProfileCard/spotlight 是 E 新增 UI，桌面无改前对应画面，不拍）。
 *
 * D 与 E 的 DOM 差异（本驱动的适配点）：
 *  - demo 跳站 testid 同名同编号（demo-station-N 为 1 起：2=市场、5=事件），
 *    panel-<stationId> 同名，jumpTo 逻辑基本沿用改后驱动；
 *  - waitPanel 的进站兜底点击改优先点 .board-enter 本体（D 的进站钮
 *    文案「Go to this stop」），避免误点 DOM 里靠前的其他 action-primary；
 *  - D 市场弹窗的 action-primary 是「买/篮子」钮（首卡默认选中时可用）；
 *    离站的「Done」钮不是 action-primary——本组 hud 不离站（见上），
 *    避免结束回合后 bot 在快进模式下发起拼单提议弹窗污染画面
 *    （首轮实拍教训：点 Done 后拍到的 hud 是 Friends Stop 提议弹窗）；
 *  - D 无 [data-testid="weather-card"]（E 的电影时刻大卡）：天气镜头改为
 *    等 [data-testid="weather-spinner"] 出现 + 转盘落定后拍；
 *  - D 无 .spotlight-veil / ProfileCard（见上 profile 说明）；
 *  - D 的 3D 棋盘在 SwiftShader 下加载慢且会反复挂起：BoardMount 以
 *    Board2D 作 Suspense fallback，挂起期 board3d 被隐藏成 0×0（仍在
 *    DOM，只查 count 会误判）。board 就绪判据 = board3d 非 0×0 可见
 *    且 section.board 不在场、连续 4 次采样成立（实拍教训：固定等
 *    4.5s、或只查 testid 存在，都拍到过 2D 兜底棋盘）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4174';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[2] ?? 'phone';
const LANG = MODE === 'desktop-zh' ? 'zh' : 'en';
const CTX =
  MODE === 'phone'
    ? { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }
    : { viewport: { width: 1280, height: 800 } };
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SIZE_TAG = MODE === 'phone' ? 'phone' : 'desktop';

async function shot(page, name) {
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  const file = `r10e_before2_${name}_${LANG}_${SIZE_TAG}.png`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(res.data, 'base64'));
  console.log(`  shot ${file}`);
}

async function enterGame(page, url) {
  await page.goto(url);
  if (MODE === 'phone') await page.addStyleTag({ content: SAFE_CSS });
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
}

async function waitPanel(page, testid, timeoutMs = 60_000) {
  const panel = page.locator(`[data-testid="${testid}"]`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if ((await panel.count()) > 0) return true;
    if ((await page.locator('.popup').count()) === 0) {
      const enter = page.locator('.board-enter').first();
      if ((await enter.count()) > 0) {
        await enter.dispatchEvent('click').catch(() => {});
      } else {
        const primary = page.locator('[data-testid="action-primary"]').first();
        if ((await primary.count()) > 0) await primary.dispatchEvent('click').catch(() => {});
      }
    }
    await page.waitForTimeout(300);
  }
  return false;
}

async function railTop(page) {
  if (MODE !== 'phone') return;
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
  }).catch(() => {});
  await page.waitForTimeout(350);
}

/** phone：把竖栏滚到弹窗顶与栏顶对齐。D 的手机弹窗在右竖栏内、前面还
 * 有「Your turn」状态卡，只 scrollTop=0 时弹窗主体（市场卡扇/天气
 * 转盘）会沉到 402px 折线以下（实拍教训）。 */
async function railAlignPopup(page) {
  if (MODE !== 'phone') return;
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    const pop = rail ? rail.querySelector('.popup') : null;
    if (rail && pop) {
      rail.scrollTop += pop.getBoundingClientRect().top - rail.getBoundingClientRect().top - 8;
    }
  }).catch(() => {});
  await page.waitForTimeout(400);
}

async function jumpTo(page, stationIdx, panelTestid, lap = null) {
  for (let i = 0; i < 3; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page
      .locator('.popup [data-testid="action-primary"]')
      .first()
      .dispatchEvent('click')
      .catch(() => {});
    await page.waitForTimeout(400);
  }
  // 等演示条真正可用（lap 片出现为准）：?demo=1 自动打开与手动 'd' 开合
  // 存在竞态（zh 跑实测：bar 在但 lap 片未就绪/被误关），重试开合直到
  // lap 片可见。
  const lapChip = page.locator(`[data-testid="demo-lap-${lap ?? 1}"]`);
  for (let i = 0; i < 4 && (await lapChip.count()) === 0; i++) {
    await page.keyboard.press('d');
    await page.waitForTimeout(1200);
  }
  await lapChip.waitFor({ timeout: 15_000 });
  if (lap !== null) await page.locator(`[data-testid="demo-lap-${lap}"]`).dispatchEvent('click');
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  return waitPanel(page, panelTestid);
}

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext(CTX);
await ctx.addInitScript((lang) => {
  try {
    window.localStorage.setItem('maicai-lang', lang);
  } catch { /* ignore */ }
}, LANG);

/* —— board：独立无 demo 页（与改后 probe-e8 同 URL），等 3D 就绪 —— */
if (process.env.SKIP_BOARD === '1') {
  console.log('  board skipped (SKIP_BOARD=1)');
} else {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('  pageerror(board):', String(e)));
  await enterGame(p, `${BASE}/?board=3d&seed=1&fast=1`);
  // 就绪判据：board3d 可见（非 0×0）且 Board2D 兜底不在场，连续 4 次采样
  // 成立才算稳。D 的 BoardMount 在 GLTF 挂起时以 Board2D 作 Suspense
  // fallback，期间 board3d 被 React 隐藏成 0×0 但仍在 DOM——只查 count
  // 会误判（首轮第二跑实测：t=2.5s 全尺寸 → 5–7.5s 塌成 0×0+2D 在场
  // → 10s 恢复 3D，截图恰落在 2D 窗口）。
  let ready = false;
  let streak = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 150_000) {
    const vis = await p.evaluate(() => {
      const el = document.querySelector('[data-testid="board3d"]');
      const r = el ? el.getBoundingClientRect() : null;
      return (
        !!r && r.width > 100 && r.height > 100 &&
        document.querySelectorAll('section.board').length === 0
      );
    }).catch(() => false);
    streak = vis ? streak + 1 : 0;
    if (streak >= 4) { ready = true; break; }
    await p.waitForTimeout(700);
  }
  console.log(`  board3d stable-visible: ${ready} (${Math.round((Date.now() - t0) / 1000)}s)`);
  await shot(p, 'board');
  await p.close();
}

if (process.env.ONLY === 'board') {
  await browser.close();
  console.log('done (board only)');
  process.exit(0);
}

/* —— 主页面：profile(phone) → market → hud —— */
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await enterGame(page, `${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.waitForTimeout(3000);

if (MODE === 'phone') {
  // 主页面 ?demo=1 会自动打开演示条，先关掉再拍 profile（实拍教训：
  // 演示条会压在 BotCard 浮层后面入镜，改后组无此物）
  if ((await page.locator('[data-testid="demo-bar"]').count()) > 0) {
    await page.keyboard.press('d');
    await page.waitForTimeout(600);
    console.log(`  demo bar closed for profile: ${(await page.locator('[data-testid="demo-bar"]').count()) === 0}`);
  }
  await page.locator('.phone-bot').first().click().catch(() => {});
  await page.waitForTimeout(700);
  const pop = (await page.locator('.phone-bot-pop').count()) > 0;
  console.log(`  phone bot popover: ${pop ? 'open' : 'NOT open'}`);
  if (pop) await shot(page, 'profile');
  // 再点收起并验证真关掉（单次点击偶发被重渲吞掉，浮层会残留进后续
  // market/hud 镜头——实拍教训）
  for (let i = 0; i < 3 && (await page.locator('.phone-bot-pop').count()) > 0; i++) {
    await page.locator('.phone-bot').first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
  console.log(`  phone bot popover closed: ${(await page.locator('.phone-bot-pop').count()) === 0}`);
}

await jumpTo(page, 2, 'panel-market', 1);
await railTop(page);
await railAlignPopup(page);
await page.waitForTimeout(900);
await shot(page, 'market');

/* hud：与改后驱动同动作——点弹窗内最后一个 action-primary（D=买下首卡，
   含 ~1.5s 后悔窗，等其落地后拍同弹窗更新态） */
await page
  .locator('.popup [data-testid="action-primary"]')
  .last()
  .click({ timeout: 5_000 })
  .catch((e) => console.log('  hud click failed:', String(e).split('\n')[0]));
await page.waitForTimeout(2200);
console.log(`  hud state: popup open = ${(await page.locator('.popup').count()) > 0}`);
await railTop(page);
await railAlignPopup(page);
await shot(page, 'hud');

if (MODE !== 'phone') {
  // 桌面：试探点击 .bot-card，确认 D 无打开态（预期无 ProfileCard 等价物）
  await page.locator('.bot-card').first().click().catch(() => {});
  await page.waitForTimeout(700);
  const veil = (await page.locator('.spotlight-veil').count()) > 0;
  console.log(`  desktop bot-card click: spotlight-veil ${veil ? 'OPEN (unexpected)' : 'none — D has no ProfileCard equivalent, profile shot skipped'}`);
}
await page.close();

/* —— weather：独立新页（避免 bot 提议弹窗污染），跳事件站 —— */
{
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('  pageerror(weather):', String(e)));
  await enterGame(p, `${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await p.waitForTimeout(1500);
  const ok = await jumpTo(p, 5, 'panel-event', 1);
  console.log(`  panel-event reached: ${ok}`);
  await p.locator('[data-testid="weather-spinner"]').waitFor({ timeout: 10_000 }).catch(() => null);
  await p.waitForTimeout(1600);
  const wcard = (await p.locator('[data-testid="event-weather"]').count()) > 0;
  console.log(`  landed weather card [event-weather]: ${wcard ? 'present' : 'absent'}`);
  await railTop(p);
  await railAlignPopup(p);
  await shot(p, 'weather');
  await p.close();
}

await browser.close();
console.log('done');
