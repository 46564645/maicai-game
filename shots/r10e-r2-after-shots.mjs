/** r10e-r2-after-shots.mjs — 团队第 2 轮改后全套重拍（覆盖 r10e_after_*）。
 * Usage: node shots/r10e-r2-after-shots.mjs <phone|desktop-en|desktop-zh>
 *        ONLY=market,hud,weather,profile,marketbought,botspot 可选子集
 * 前置：npm run build 后 vite preview 在 4173。
 *
 * 与 r10e-after-shots.mjs 的差异（按 R2 新 UI + 本机软渲染实况适配）：
 *  - market：等摊位卡入镜后拍主图，核对浮签/×N 角标/缺菜图标/定稿句；
 *    手机额外核对卡在 .phone-market-float 浮层内（R2-1 portal）。
 *  - marketbought：独立新页买一张，等「Bought ✓」角标出现再拍——
 *    买卡后本页截图通道易被 SwiftShader 拖死，隔离到单独页面，
 *    不污染其他场景（实测两轮都在买卡后 capture 挂起）。
 *  - weather：轮询 [data-testid="weather-moment"] 相位，weather-card
 *    在场才拍（card 态）；绝不在棋盘态（Go to this stop）出图。
 *  - profile：核对 .pc 实测宽度（R2-3 桌面 ≥280，目标 288）并记录。
 *  - 截图主通道 page.screenshot（60s 超时），失败再退 CDP 通道。
 * 每张图的核对结果写 shots/r10e_r2_shots_log.json（按模式分键）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[2] ?? 'phone';
const LANG = MODE === 'desktop-zh' ? 'zh' : 'en';
const ONLY = (process.env.ONLY ?? 'market,hud,weather,profile,marketbought,botspot')
  .split(',')
  .map((s) => s.trim());
const CTX =
  MODE === 'phone'
    ? { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }
    : { viewport: { width: 1280, height: 800 } };
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SIZE_TAG = MODE === 'phone' ? 'phone' : 'desktop';

const log = {};
const LOGFILE = path.join(OUT, 'r10e_r2_shots_log.json');
try {
  Object.assign(log, JSON.parse(fs.readFileSync(LOGFILE, 'utf8')));
} catch { /* first run */ }
if (!log[MODE]) log[MODE] = {};
function note(key, value) {
  log[MODE][key] = value;
  console.log(`  [${key}] ${JSON.stringify(value)}`);
  fs.writeFileSync(LOGFILE, JSON.stringify(log, null, 2));
}

async function shot(page, name) {
  const file = `r10e_after_${name}_${LANG}_${SIZE_TAG}.png`;
  const full = path.join(OUT, file);
  // 三种捕获通道轮换：pw 截图（会等字体，天气卡态易挂）→ CDP fromSurface
  // → CDP 非 fromSurface；本机 SwiftShader 捕获成本抖动极大（2–80s+）
  const methods = [
    async () => {
      await page.screenshot({ path: full, timeout: 60_000 });
      return 'pw';
    },
    async () => {
      const cdp = await page.context().newCDPSession(page);
      const res = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('capture timeout 60s')), 60_000)),
      ]);
      fs.writeFileSync(full, Buffer.from(res.data, 'base64'));
      return 'cdp-surface';
    },
    async () => {
      const cdp = await page.context().newCDPSession(page);
      const res = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('capture timeout 60s')), 60_000)),
      ]);
      fs.writeFileSync(full, Buffer.from(res.data, 'base64'));
      return 'cdp-nosurface';
    },
  ];
  for (let round = 1; round <= 2; round++) {
    for (const m of methods) {
      try {
        const tag = await m();
        console.log(`  shot ${file} (${tag}, round ${round})`);
        return file;
      } catch (e) {
        console.log(`  shot ${file} attempt failed: ${String(e).slice(0, 100)}`);
      }
    }
    await page.waitForTimeout(5000).catch(() => {});
  }
  console.log(`  !! shot ${file} FAILED after retries`);
  return null;
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
  return false;
}

async function railTop(page) {
  if (MODE !== 'phone') return;
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
  });
  await page.waitForTimeout(350);
}

async function jumpTo(page, stationIdx, panelTestid, lap = null) {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
    await page.waitForTimeout(700);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  if (lap !== null) await page.locator(`[data-testid="demo-lap-${lap}"]`).dispatchEvent('click');
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  return waitPanel(page, panelTestid);
}

async function startPage(browser) {
  const ctx = await browser.newContext(CTX);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await page.addInitScript((lang) => {
    try {
      window.localStorage.setItem('maicai-lang', lang);
    } catch { /* ignore */ }
  }, LANG);
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  if (MODE === 'phone') await page.addStyleTag({ content: SAFE_CSS });
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(3000);
  return { ctx, page };
}

const browser = await chromium.launch({ args: GL_ARGS });

/* ===== 主页面：market → hud → weather → profile ===== */
const mainScenes = ['market', 'hud', 'weather', 'profile'].filter((s) => ONLY.includes(s));
if (mainScenes.length > 0) {
  const { ctx, page } = await startPage(browser);

  if (ONLY.includes('market') || ONLY.includes('hud')) {
    await jumpTo(page, 2, 'panel-market', 1);
    await page.locator('[data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
    await railTop(page);
    await page.waitForTimeout(900);
    if (ONLY.includes('market')) {
      const marketCheck = await page.evaluate(() => {
        const head = document.querySelector('.popup-head');
        const badge = document.querySelector('.popup-coin-badge');
        const cards = [...document.querySelectorAll('[data-testid^="action-stall-"]')];
        const guide = document.querySelector('.stall-guide');
        return {
          headText: head?.textContent?.trim() ?? null,
          badgeText: badge?.textContent?.trim() ?? null,
          stallCards: cards.length,
          stallCardNames: cards.map((c) => c.getAttribute('aria-label') ?? c.textContent?.trim().slice(0, 40)),
          floatCards: document.querySelectorAll('.phone-market-float [data-testid^="action-stall-"]').length,
          guideText: guide?.textContent?.trim() ?? null,
          guideIcons: document.querySelectorAll('.stall-guide-icons > *').length,
          buysLeftTextGone: !document.querySelector('.panel-buysleft'),
        };
      });
      note('market', marketCheck);
      await shot(page, 'market');
    }
    if (ONLY.includes('hud')) {
      // 关弹窗要点带 data-primary 的钮（市场站 action-primary 是买入篮，
      // 未选卡/买后为 disabled，点它关不掉；Done 钮带 data-primary）
      for (let i = 0; i < 6; i++) {
        if ((await page.locator('.popup').count()) === 0) break;
        const clicked = await page.evaluate(() => {
          const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
          const sel =
            document.querySelector('.popup [data-primary="true"]:not([disabled])') ??
            document.querySelector('.popup [data-testid="action-primary"]:not([disabled])');
          if (vis(sel)) {
            sel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return true;
          }
          const keyed = [...document.querySelectorAll('.popup [data-key]:not([disabled])')].filter(vis);
          if (keyed.length) {
            const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return true;
          }
          return false;
        }).catch(() => false);
        if (!clicked) break;
        await page.waitForTimeout(800);
      }
      await page.waitForTimeout(600);
      note('hud', { popupGone: (await page.locator('.popup').count()) === 0 });
      await shot(page, 'hud');
    }
  }

  if (ONLY.includes('weather')) {
    await jumpTo(page, 5, 'panel-event', 1);
    let weatherPhase = 'none';
    const t0 = Date.now();
    while (Date.now() - t0 < 90_000) {
      weatherPhase = await page.evaluate(() => {
        const vis = (el) => !!el && el.getClientRects().length > 0;
        if (vis(document.querySelector('[data-testid="weather-card"]'))) return 'card';
        if (vis(document.querySelector('[data-testid="weather-spinner"]'))) return 'spin';
        if (vis(document.querySelector('[data-testid="weather-moment"]'))) return 'moment-no-card';
        return 'none';
      });
      if (weatherPhase === 'card') break;
      await page.waitForTimeout(250);
    }
    note('weather', { phase: weatherPhase });
    if (weatherPhase === 'card' || weatherPhase === 'spin') {
      await railTop(page);
      await shot(page, 'weather');
    } else {
      console.log(`  !! weather 未等到标注场景（phase=${weatherPhase}），不出图`);
    }
  }

  if (ONLY.includes('profile')) {
    // 先关掉可能在场的天气卡（dispatchEvent 直达，避免真实点击被遮挡层
    // 拦截后静默失败——R2 首轮 profile 就栽在这里），确认消失再点徽章
    await page.locator('[data-testid="weather-card"]').dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(800);
    const medal =
      MODE === 'phone' ? page.locator('.phone-bot').first() : page.locator('.bot-card').first();
    await medal.dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(1600);
    const profileCheck = await page.evaluate(() => {
      const veil = document.querySelector('.spotlight-veil');
      const pc = veil?.querySelector('.pc') ?? document.querySelector('.pc');
      const r = pc?.getBoundingClientRect();
      return {
        veilOpen: !!veil,
        weatherCardGone: !document.querySelector('[data-testid="weather-card"]'),
        pcRectW: r ? Math.round(r.width) : null,
        pcRectH: r ? Math.round(r.height) : null,
        pcOffsetW: pc ? pc.offsetWidth : null,
        pcOffsetH: pc ? pc.offsetHeight : null,
      };
    });
    note('profile', profileCheck);
    await shot(page, 'profile');
    await page.keyboard.press('Escape').catch(() => {});
  }
  await ctx.close();
}

/* ===== marketbought：独立页隔离 ===== */
if (ONLY.includes('marketbought')) {
  const { ctx, page } = await startPage(browser);
  await jumpTo(page, 2, 'panel-market', 1);
  await page.locator('[data-testid^="action-stall-"]').first().waitFor({ timeout: 20_000 }).catch(() => null);
  await railTop(page);
  let boughtOk = false;
  try {
    const card = page.locator('[data-testid^="action-stall-"]:not([disabled])').first();
    await card.click({ timeout: 15_000 });
    await page.waitForTimeout(500);
    const basket = page.locator('[data-testid="panel-market"] [data-testid="action-primary"]:not([disabled])').first();
    if ((await basket.count()) > 0) {
      await basket.click({ timeout: 15_000 });
      // 后悔窗名义 1.5s，但软渲染下页面计时被卡顿拉长——给 90s
      const t0 = Date.now();
      while (Date.now() - t0 < 90_000) {
        const n = await page.locator('.card-view-bought').count();
        const chip = await page.locator('.pending-chip').count();
        if (n > 0 && chip === 0) { boughtOk = true; break; }
        await page.waitForTimeout(300);
      }
    }
  } catch (e) {
    console.log('  marketbought attempt error:', String(e));
  }
  note('marketbought', { badgeFound: boughtOk });
  if (boughtOk) {
    await railTop(page);
    await page.waitForTimeout(500);
    await shot(page, 'marketbought');
  }
  await ctx.close();
}

/* ===== botspot：仅 desktop-en，独立页（沿用旧脚本） ===== */
if (ONLY.includes('botspot') && MODE === 'desktop-en') {
  const { ctx, page: p2 } = await (async () => {
    const c = await browser.newContext(CTX);
    const p = await c.newPage();
    p.on('pageerror', (e) => console.log('  pageerror(p2):', String(e)));
    await p.addInitScript((lang) => {
      try {
        window.localStorage.setItem('maicai-lang', lang);
      } catch { /* ignore */ }
    }, LANG);
    await p.goto(`${BASE}/?board=3d&seed=1`);
    await p.locator('[data-testid="action-primary"]').dispatchEvent('click');
    await p.locator('[data-testid^="action-char-"]').first().dispatchEvent('click');
    await p.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
    await p.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
    return { ctx: c, page: p };
  })();
  let caught = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 180_000 && !caught) {
    const state = await p2
      .evaluate(() => ({
        spot: !!document.querySelector('.bot-card--spot'),
        botThinking: !!document.querySelector('.bot-card--thinking'),
      }))
      .catch(() => ({ spot: false, botThinking: false }));
    if (state.spot) {
      await shot(p2, 'botspot');
      caught = true;
      break;
    }
    if (!state.botThinking) {
      await p2
        .evaluate(() => {
          const vis = (el) => el && el.getClientRects().length > 0;
          const primary = document.querySelector('[data-testid="action-primary"]:not([disabled])');
          if (vis(primary)) {
            primary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return;
          }
          const keyed = [...document.querySelectorAll('[data-key]:not([disabled])')].filter(vis);
          if (keyed.length) {
            const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        })
        .catch(() => {});
    }
    await p2.waitForTimeout(90);
  }
  note('botspot', { caught });
  await ctx.close();
}

await browser.close();
console.log('done');
