/** probe-r2-cook.mjs — 开饭页（cook/feast）+ 感想页（reflection）双尺寸
 * 截图与英文主按钮溢出量测（ww 追加项），兼补拍干净的 HUD 棋盘图。
 * Usage:
 *   node shots/probe-r2-cook.mjs cook-desktop
 *   node shots/probe-r2-cook.mjs cook-phone
 *   node shots/probe-r2-cook.mjs hud <en|zh> <desktop|phone>
 * 前置：vite preview 4173。
 * cook 驱动：fast 模式整局推进（通用推进 = 可见未禁用 action-primary
 * 优先，否则最大 data-key；提议浮签在场点 proposal-no 应答；天气卡
 * 走 data-key 通路）。到 screen-feast 先量测+拍 cook，再推进到
 * screen-reflection 量测+拍 reflect。量测口径：页面上所有
 * [data-testid="action-primary"] 与 [data-primary="true"] 按钮的
 * scrollWidth - clientWidth，逐个记录（文本+数值）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const MODE = process.argv[2];

async function shot(page, file) {
  const full = path.join(OUT, file);
  const methods = [
    async () => { await page.screenshot({ path: full, timeout: 60_000 }); return 'pw'; },
    async () => {
      const cdp = await page.context().newCDPSession(page);
      const res = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('cap 60s')), 60_000)),
      ]);
      fs.writeFileSync(full, Buffer.from(res.data, 'base64'));
      return 'cdp-surface';
    },
    async () => {
      const cdp = await page.context().newCDPSession(page);
      const res = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('cap 60s')), 60_000)),
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
        return true;
      } catch (e) {
        console.log(`  shot ${file} failed: ${String(e).slice(0, 80)}`);
      }
    }
    await page.waitForTimeout(4000).catch(() => {});
  }
  return false;
}

const MEASURE_FN = () => {
  const els = [...document.querySelectorAll('[data-testid="action-primary"], [data-primary="true"]')];
  return els
    .filter((el) => el.getClientRects().length > 0)
    .map((el) => ({
      testid: el.getAttribute('data-testid'),
      text: (el.textContent ?? '').trim().slice(0, 60),
      overflow: el.scrollWidth - el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
};

const STATE_FN = () => ({
  feast: !!document.querySelector('[data-testid="screen-feast"]'),
  reflection: !!document.querySelector('[data-testid="screen-reflection"]'),
  game: !!document.querySelector('[data-testid="screen-game"]'),
  pill: !!document.querySelector('[data-testid="await-proposal"]'),
  bubble: !!document.querySelector('[data-testid="bubble-proposal"]'),
  botThinking: !!document.querySelector('.bot-card--thinking'),
  prog: document.querySelector('.prog')?.getAttribute('aria-label') ?? null,
  title: document.querySelector('[data-testid="screen-feast"] h1, [data-testid="screen-feast"] h2')?.textContent?.trim() ?? null,
});

async function advance(page) {
  await page
    .evaluate(() => {
      const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
      // 提议浮签在场：点 No 应答（不替孩子决定交换，只为推进整局）
      const no = document.querySelector('[data-testid="proposal-no"]');
      if (vis(no)) {
        no.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'proposal-no';
      }
      const primary = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
      if (primary) {
        primary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'primary';
      }
      const keyed = [...document.querySelectorAll('[data-key]')].filter(vis);
      if (keyed.length) {
        const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'keyed';
      }
      return 'none';
    })
    .catch(() => null);
}

async function startGame(page, { phone, lang }) {
  await page.addInitScript((l) => {
    try {
      window.localStorage.setItem('maicai-lang', l);
    } catch { /* ignore */ }
  }, lang);
  if (phone) {
    await page.addInitScript((css) => {
      const inject = () => {
        const st = document.createElement('style');
        st.textContent = css;
        document.documentElement.appendChild(st);
      };
      if (document.documentElement) inject();
      else document.addEventListener('DOMContentLoaded', inject);
    }, SAFE_CSS);
  }
  await page.goto(`${BASE}/?demo=1&fast=1&board=3d&seed=1`);
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
}

const browser = await chromium.launch({ args: GL_ARGS });

if (MODE === 'hud') {
  const lang = process.argv[3] ?? 'en';
  const form = process.argv[4] ?? 'desktop';
  const phone = form === 'phone';
  const ctx = phone
    ? await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true })
    : await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await startGame(page, { phone, lang });
  await page.waitForTimeout(1500);
  // 关演示条，露出干净棋盘 HUD
  const closeBtn = page.locator('[data-testid="demo-close"]');
  if ((await closeBtn.count()) > 0) await closeBtn.dispatchEvent('click').catch(() => {});
  else await page.keyboard.press('d');
  await page.waitForTimeout(3500);
  console.log('  demo bar present:', (await page.locator('[data-testid="demo-bar"]').count()) > 0);
  await shot(page, `r10e_after_hud_${lang}_${form}.png`);
  await browser.close();
} else if (MODE === 'cook-desktop' || MODE === 'cook-phone') {
  const phone = MODE === 'cook-phone';
  const ctx = phone
    ? await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true })
    : await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await startGame(page, { phone, lang: 'en' });
  const form = phone ? 'phone' : 'desktop';
  const result = { form, feast: null, reflection: null };
  const t0 = Date.now();
  const LIMIT = 1_500_000;
  let phase = 'to-feast';
  let lastAdvance = 0;
  while (Date.now() - t0 < LIMIT) {
    const s = await page.evaluate(STATE_FN).catch(() => null);
    if (!s) {
      await page.waitForTimeout(200);
      continue;
    }
    if (phase === 'to-feast' && s.feast) {
      await page.waitForTimeout(1500);
      const m = await page.evaluate(MEASURE_FN).catch(() => []);
      result.feast = { title: s.title, buttons: m };
      console.log(`  [feast] title="${s.title}" buttons=${JSON.stringify(m)}`);
      // 拍前藏演示条 + 把主按钮滚入画面
      await page.locator('[data-testid="demo-close"]').dispatchEvent('click').catch(() => {});
      await page.evaluate(() => {
        document.querySelector('[data-testid="action-primary"]')?.scrollIntoView({ block: 'end' });
      }).catch(() => {});
      await page.waitForTimeout(800);
      await shot(page, `r10e_after_cook_en_${form}.png`);
      phase = 'to-reflection';
      continue;
    }
    if (phase === 'to-reflection' && s.reflection) {
      await page.waitForTimeout(1500);
      const m = await page.evaluate(MEASURE_FN).catch(() => []);
      result.reflection = { buttons: m };
      console.log(`  [reflection] buttons=${JSON.stringify(m)}`);
      await page.locator('[data-testid="demo-close"]').dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(800);
      await shot(page, `r10e_after_reflect_en_${form}.png`);
      break;
    }
    if (s.botThinking && !s.pill) {
      await page.waitForTimeout(200);
      continue;
    }
    const now = Date.now();
    if (now - lastAdvance < 250) {
      await page.waitForTimeout(100);
      continue;
    }
    lastAdvance = now;
    await advance(page);
    await page.waitForTimeout(150);
  }
  console.log(`  done phase=${phase} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  fs.writeFileSync(path.join(OUT, `r2-cook-${form}.json`), JSON.stringify(result, null, 2));
  await browser.close();
}
