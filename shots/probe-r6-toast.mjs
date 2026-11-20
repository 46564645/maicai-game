/**
 * probe-r6-toast.mjs — R6 toast regression: catch visible toasts while
 * auto-playing, measure toast rect vs every visible lang-toggle rect,
 * report overlap area; screenshot the worst overlap.
 * Usage: node shots/probe-r6-toast.mjs <w> <h> <phone|desktop> [seconds] [seed]
 */
import { chromium } from '@playwright/test';

const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const BASE = 'http://localhost:4173';
const W = Number(process.argv[2] ?? 874);
const H = Number(process.argv[3] ?? 402);
const MODE = process.argv[4] ?? 'phone';
const SECS = Number(process.argv[5] ?? 90);
const SEED = Number(process.argv[6] ?? 1);

const browser = await chromium.launch({ args: GL });
const ctx = MODE === 'phone'
  ? await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true })
  : await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
const page = await ctx.newPage();
await page.goto(`${BASE}/?board=3d&seed=${SEED}&fast=1&demo=1`, { waitUntil: 'load', timeout: 30_000 });
if (MODE === 'phone' && W === 874) {
  await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(() => {});
}
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(1500);

const MEASURE = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  const toast = [...document.querySelectorAll('.toast')].find(vis);
  if (!toast) return null;
  const tr = toast.getBoundingClientRect();
  const toggles = [...document.querySelectorAll('[data-testid="lang-toggle"]')].filter(vis).map((t) => {
    const r = t.getBoundingClientRect();
    const ox = Math.max(0, Math.min(tr.right, r.right) - Math.max(tr.left, r.left));
    const oy = Math.max(0, Math.min(tr.bottom, r.bottom) - Math.max(tr.top, r.top));
    return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], overlap: Math.round(ox * oy) };
  });
  return {
    text: toast.textContent?.trim().slice(0, 60) ?? '',
    toastRect: [Math.round(tr.left), Math.round(tr.top), Math.round(tr.width), Math.round(tr.height)],
    toastZ: getComputedStyle(toast.closest('.toast-stack') ?? toast).zIndex,
    toggles,
  };
};

const advance = () => page.evaluate(() => {
  const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
  const no = document.querySelector('[data-testid="proposal-no"]');
  if (vis(no)) { no.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
  const primary = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
  if (primary) { primary.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
  const keyed = [...document.querySelectorAll('[data-key]')].filter(vis);
  if (keyed.length) keyed[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
}).catch(() => {});

const seen = new Map();
let worst = null;
const t0 = Date.now();
let lastAdvance = 0;
while (Date.now() - t0 < SECS * 1000) {
  const m = await page.evaluate(MEASURE).catch(() => null);
  if (m) {
    const key = m.text + '|' + m.toastRect.join(',');
    if (!seen.has(key)) {
      seen.set(key, m);
      console.log('TOAST:', JSON.stringify(m));
    }
    const maxOv = Math.max(0, ...m.toggles.map((t) => t.overlap));
    if (maxOv > 0 && (!worst || maxOv > worst.maxOv)) {
      worst = { ...m, maxOv };
      await page.screenshot({ path: `shots/r6_toast_overlap_${W}_${MODE}.png` }).catch(() => {});
      console.log('  ^^ OVERLAP', maxOv, 'px² — screenshot saved');
    }
  }
  if (Date.now() - lastAdvance > 1200) {
    const thinking = await page.locator('.bot-card--thinking, .phone-bot--on').count().catch(() => 0);
    if (!thinking) await advance();
    lastAdvance = Date.now();
  }
  await page.waitForTimeout(150);
}
console.log(`DONE ${W}x${H} ${MODE}: ${seen.size} distinct toast sightings; worst overlap = ${worst ? worst.maxOv + ' px² ("' + worst.text + '")' : 'none'}`);
await browser.close();
