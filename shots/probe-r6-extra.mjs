/**
 * probe-r6-extra.mjs — R6 item 1 supplementary coverage for stations the
 * main tour can't reach naively: event (weather moment card + revealed
 * story card), weather station, parent fan, draw station. Same name rules.
 * Usage: node shots/probe-r6-extra.mjs <667|874|1024|1280|1440>
 */
import { chromium } from '@playwright/test';

const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const BASE = 'http://localhost:4173';
const SIZES = { 667: [667, 375], 874: [874, 402], 1024: [1024, 768], 1280: [1280, 800], 1440: [1440, 900] };
const key = process.argv[2] ?? '1280';
const [W, H] = SIZES[key];
const phone = key === '874' || key === '667';

const SCAN = () => {
  const out = [];
  for (const el of document.querySelectorAll('.card-view-name')) {
    if (el.getClientRects().length === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const raw = el.textContent ?? '';
    const fs = parseFloat(cs.fontSize);
    const lh = parseFloat(cs.lineHeight);
    const lineH = Number.isFinite(lh) && lh > 0 ? lh : fs * 1.2;
    const lines = Math.max(1, Math.round(el.scrollHeight / lineH));
    const card = el.closest('.card-view');
    out.push({
      text: raw.trim().slice(0, 34),
      shy: raw.includes('­'),
      fs, lines,
      dW: el.scrollWidth - el.clientWidth,
      cardClip: card ? card.scrollHeight - card.clientHeight : 0,
    });
  }
  return out;
};

let badTotal = 0;
function report(label, rows) {
  const bad = rows.filter((r) => r.shy || r.dW > 1 || r.lines > 3 || r.fs < 14 || r.cardClip > 1);
  badTotal += bad.length;
  console.log(`[${key}/${label}] names=${rows.length} bad=${bad.length} :: ${rows.map((r) => `${r.text}(${r.fs}px,${r.lines}L)`).join(' | ')}`);
  for (const b of bad) console.log(`  BAD "${b.text}" shy=${b.shy} fs=${b.fs} lines=${b.lines} dW=${b.dW} clip=${b.cardClip}`);
}

const browser = await chromium.launch({ args: GL });

async function freshPage(seed = 1) {
  const ctx = phone
    ? await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true })
    : await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?board=3d&seed=${seed}&fast=1&demo=1`, { waitUntil: 'load', timeout: 30_000 });
  if (phone && key === '874') {
    await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(() => {});
  }
  await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
  await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
  await page.waitForTimeout(2000);
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  return { ctx, page };
}

async function jump(page, n) {
  await page.locator(`[data-testid="demo-station-${n}"]`).dispatchEvent('click').catch(() => {});
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click').catch(() => {});
  await page.keyboard.press('d').catch(() => {});
  await page.waitForTimeout(1000);
}

/* — event: weather moment card, then deck reveal → story card — */
{
  const { ctx, page } = await freshPage(1);
  await jump(page, 5);
  await page.locator('[data-testid="weather-card"]').waitFor({ timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(600);
  report('event-weather-moment', await page.evaluate(SCAN));
  await page.locator('[data-testid="weather-card"]').dispatchEvent('click').catch(() => {});
  await page.waitForTimeout(1200);
  /* deck draw: the Deck carries testid action-primary inside the panel */
  await page.locator('.popup [data-testid="action-primary"]').first().dispatchEvent('click').catch(() => {});
  await page.waitForTimeout(1400);
  report('event-story', await page.evaluate(SCAN));
  await ctx.close();
}

/* — weather station — */
{
  const { ctx, page } = await freshPage(1);
  await jump(page, 6);
  await page.locator('[data-testid="weather-card"]').waitFor({ timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(600);
  report('weather-station', await page.evaluate(SCAN));
  await ctx.close();
}

/* — parent station fan — */
{
  const { ctx, page } = await freshPage(1);
  await jump(page, 4);
  await page.waitForTimeout(800);
  report('parent', await page.evaluate(SCAN));
  await ctx.close();
}

/* — draw station — */
{
  const { ctx, page } = await freshPage(1);
  await jump(page, 1);
  await page.waitForTimeout(800);
  report('draw', await page.evaluate(SCAN));
  /* reveal a recipe card if a deck is offered */
  await page.locator('.popup [data-testid="action-primary"]').first().dispatchEvent('click').catch(() => {});
  await page.waitForTimeout(1200);
  report('draw-revealed', await page.evaluate(SCAN));
  await ctx.close();
}

console.log(`EXTRA TOTAL bad=${badTotal}`);
await browser.close();
