/** r10e-after-shots.mjs — R1 切片 E 改后截图组。
 * Usage: node shots/r10e-after-shots.mjs <phone|desktop-en|desktop-zh>
 * 前置：npm run build 后 vite preview 在 4173。
 *
 * 口径（对齐 R1 定稿固定验收截图）：
 *  - phone：874×402（iPhone 17 Pro 横屏），用与 tests/e2e/safearea.spec.ts
 *    完全相同的 --safe-* 注入（t20/r62/b20/l62）；
 *  - desktop-en / desktop-zh：1280×800，英文正式验收 + 中文模式对照
 *    （查中文换行/字号/按钮宽度，ww 补充项）。
 * 命名 shots/r10e_after_<scene>_<en|zh>_<phone|desktop>.png，覆盖：
 *  hud（棋盘 HUD 总览）/ market（市场站）/ weather（天气时刻大卡）/
 *  profile（ProfileCard，manual 点开）/ botspot（仅 desktop-en：
 *  普通模式 bot 回合的角落小卡高光 .bot-card--spot，E3 新形态）。
 * 改前对照 = shots/r10e_before_*_zh_{desktop,phone}.png（r10e-shots
 * 在基线构建上拍，视口为其驱动自带 1440×900 / 844×390，仅作画面
 * 对照、非同视口像素对照，报告里注明）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
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
  const file = `r10e_after_${name}_${LANG}_${SIZE_TAG}.png`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(res.data, 'base64'));
  console.log(`  shot ${file}`);
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

const browser = await chromium.launch({ args: GL_ARGS });
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

/* —— market + hud：先到市场站拍市场，再关弹窗拍 HUD 总览 —— */
if (process.env.BOTSPOT_ONLY === '1') {
  await page.close();
} else {
await jumpTo(page, 2, 'panel-market', 1);
await railTop(page);
await page.waitForTimeout(900);
await shot(page, 'market');
await page.locator('.popup [data-testid="action-primary"]').last().click().catch(() => {});
await page.waitForTimeout(900);
await shot(page, 'hud');

/* —— weather：事件站天气时刻大卡 —— */
await jumpTo(page, 5, 'panel-event', 1);
await page.locator('[data-testid="weather-card"]').waitFor({ timeout: 6_000 }).catch(() => null);
await railTop(page);
await shot(page, 'weather');

/* —— profile：点 bot 徽章（手机点 phone-bot）manual 打开 ProfileCard —— */
await page.locator('[data-testid="weather-card"]').click().catch(() => {});
await page.waitForTimeout(600);
const medal =
  MODE === 'phone' ? page.locator('.phone-bot').first() : page.locator('.bot-card').first();
await medal.click().catch(() => {});
await page.waitForTimeout(700);
const veil = (await page.locator('.spotlight-veil').count()) > 0;
console.log(`  ProfileCard veil: ${veil ? 'open' : 'NOT open'}`);
await shot(page, 'profile');
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(300);
} // end BOTSPOT_ONLY else

/* —— botspot：仅 desktop-en，普通模式新开一局等 bot 角落高光 —— */
if (MODE === 'desktop-en') {
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => console.log('  pageerror(p2):', String(e)));
  await p2.goto(`${BASE}/?board=3d&seed=1`);
  await p2.locator('[data-testid="action-primary"]').dispatchEvent('click');
  await p2.locator('[data-testid^="action-char-"]').first().dispatchEvent('click');
  await p2.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await p2.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  // 真人即时推进（stepOnce 规则），轮询等 .bot-card--spot 出现立刻拍
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
  console.log(`  botspot: ${caught ? 'caught' : 'NOT caught in 180s'}`);
  await p2.close();
}

await browser.close();
console.log('done');
