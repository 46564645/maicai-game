/** probe-r2-checks.mjs — R2 补充核对：伙伴站站名丸标题溢出 + PendingChip 共存态。
 * Usage: node shots/probe-r2-checks.mjs （前置 vite preview 4173） */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

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

const HEAD_DUMP = () => {
  const R = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom), sw: el.scrollWidth, cw: el.clientWidth };
  };
  const title = document.querySelector('.phone-rail .popup-title');
  return {
    head: R(document.querySelector('.phone-rail .popup-head')),
    title: title ? { ...R(title), text: title.textContent } : null,
    goal: R(document.querySelector('.phone-rail .popup-goal')),
  };
};

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch { /* ignore */ } });
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.addStyleTag({ content: SAFE_CSS });
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(3000);

/* —— A：市场站触发 PendingChip（选卡 → 点篮子投放区 → 1.5s 窗口内量 rect） —— */
await jumpTo(page, 2, 'panel-market', 1);
await page.evaluate(() => { const rail = document.querySelector('.phone-rail'); if (rail) rail.scrollTop = 0; });
await page.waitForTimeout(600);
await page.locator('[data-testid^="action-stall-"]').first().click();
await page.waitForTimeout(300);
const basket = page.locator('.phone-rail .drop-zone--basket');
await basket.click();
const chipDump = await page.evaluate(() => {
  const R = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
  };
  const chip = document.querySelector('.pending-chip');
  const chips = Array.from(document.querySelectorAll('.phone-bot')).map(R);
  const inter = (a, b) => {
    if (!a || !b) return 0;
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
    return Math.round(x * y);
  };
  const chipR = R(chip);
  return {
    pendingChip: chipR ? { ...chipR, text: chip.textContent.trim() } : null,
    chipVsBots: chips.map((c) => inter(chipR, c)),
    railScrollTop: document.querySelector('.phone-rail')?.scrollTop,
  };
});
console.log('PENDING:', JSON.stringify(chipDump));
const cdp = await page.context().newCDPSession(page);
const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
fs.writeFileSync(path.join(OUT, 'r10e_r2_phone_pending.png'), Buffer.from(res.data, 'base64'));
console.log('shot r10e_r2_phone_pending.png');

/* —— B：伙伴站站名丸 —— */
await page.waitForTimeout(1800); // 等后悔窗口结束、买下生效
await jumpTo(page, 3, 'panel-partner', 1);
await page.evaluate(() => { const rail = document.querySelector('.phone-rail'); if (rail) rail.scrollTop = 0; });
await page.waitForTimeout(600);
console.log('PARTNER HEAD:', JSON.stringify(await page.evaluate(HEAD_DUMP)));
await browser.close();
