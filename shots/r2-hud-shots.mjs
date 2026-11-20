/** r2-hud-shots.mjs — R2 HUD 批次验证截图（ProfileCard 新尺寸 / 市场浮签角标 / 提议浮签尝试）。
 * Usage: node shots/r2-hud-shots.mjs <profile|market|proposal>
 * 前置：npm run build 后 vite preview 在 4177。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4177';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[2] ?? 'profile';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

async function shot(page, file) {
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript(() => {
  try { window.localStorage.setItem('maicai-lang', 'en'); } catch { /* ignore */ }
});

if (MODE === 'proposal') {
  // 普通模式（非 fast/demo）：自动推进真人回合，守候提议浮签出现
  await page.goto(`${BASE}/?board=3d&seed=1`);
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  let caught = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 240_000 && !caught) {
    const st = await page.evaluate(() => ({
      pill: !!document.querySelector('[data-testid="await-proposal"]'),
      botThinking: !!document.querySelector('.bot-card--thinking'),
      bubble: !!document.querySelector('[data-testid="bubble-proposal"]'),
    })).catch(() => ({ pill: false, botThinking: false, bubble: false }));
    if (st.pill) {
      await shot(page, 'r10e_r2_proposal_desktop.png');
      const txt = await page.locator('[data-testid="await-proposal"] .board-await-text').textContent().catch(() => '');
      console.log(`  proposal pill text: ${txt}`);
      caught = true;
      break;
    }
    if (!st.botThinking && !st.bubble) {
      await page.evaluate(() => {
        const vis = (el) => el && el.getClientRects().length > 0;
        const primary = document.querySelector('[data-testid="action-primary"]:not([disabled])');
        if (vis(primary)) { primary.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
        const keyed = [...document.querySelectorAll('[data-key]:not([disabled])')].filter(vis);
        if (keyed.length) {
          const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      }).catch(() => {});
    }
    await page.waitForTimeout(120);
  }
  console.log(`  proposal: ${caught ? 'caught' : 'NOT triggered in 240s (seed=1)'}`);
  await browser.close();
  process.exit(0);
}

await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(3000);

if (MODE === 'profile') {
  await page.locator('.bot-card').first().click().catch(() => {});
  await page.waitForTimeout(800);
  const dims = await page.evaluate(() => {
    const pc = document.querySelector('.pc');
    if (!pc) return null;
    const r = pc.getBoundingClientRect();
    const badge = document.querySelector('.pc-badge');
    const val = document.querySelector('.pc-value');
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      badgeText: badge?.textContent ?? null,
      badgeScrollW: badge?.scrollWidth ?? null, badgeClientW: badge?.clientWidth ?? null,
      valueText: val?.textContent ?? null,
    };
  });
  console.log('  ProfileCard dims:', JSON.stringify(dims));
  await shot(page, 'r10e_r2_profile_desktop.png');
} else if (MODE === 'market') {
  await jumpTo(page, 2, 'panel-market', 1);
  await page.waitForTimeout(900);
  const head = await page.evaluate(() => {
    const h = document.querySelector('.popup-head');
    const badge = document.querySelector('.popup-coin-badge');
    return {
      title: h?.querySelector('.popup-title')?.textContent ?? null,
      badge: badge?.textContent?.trim() ?? null,
      goalPresent: !!h?.querySelector('.popup-goal'),
    };
  });
  console.log('  market head:', JSON.stringify(head));
  await shot(page, 'r10e_r2_market_pill_desktop.png');
}

await browser.close();
console.log('done');
