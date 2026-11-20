// Dump .panel-selected-line metrics whenever a selected block is visible.
import { chromium } from 'playwright-core';
const url = process.env.URL ?? 'http://localhost:5199/?seed=1&fast=1';
const VW = Number(process.env.VW ?? 874), VH = Number(process.env.VH ?? 402);
const SAFE = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, hasTouch: true, isMobile: VW < 900 });
await page.goto(url);
await page.addStyleTag({ content: SAFE });
async function stepOnce() {
  const did = await page.evaluate(() => {
    const vis = (el) => el.getClientRects().length > 0 && !el.disabled;
    const p = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
    if (p) { p.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 1; }
    const els = [...document.querySelectorAll('[data-key]')].filter(vis);
    if (els.length) { els.reduce((a, b) => (Number(b.dataset.key) > Number(a.dataset.key) ? b : a)).dispatchEvent(new MouseEvent('click', { bubbles: true })); return 1; }
    return 0;
  });
  if (!did) await page.waitForTimeout(200);
}
const seen = new Set();
for (let i = 0; i < 400; i++) {
  if ((await page.getByTestId('action-replay').count()) > 0) break;
  await stepOnce(page);
  await page.waitForTimeout(120);
  const rows = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid^="panel-"]');
    const rail = document.querySelector('.phone-rail');
    return [...document.querySelectorAll('.panel-selected-line')].filter((e) => e.getClientRects().length).map((e) => ({
      panel: panel?.getAttribute('data-testid'),
      railOver: rail ? rail.scrollWidth - rail.clientWidth : null,
      cw: e.clientWidth, sw: e.scrollWidth, fs: getComputedStyle(e).fontSize,
      txt: (e.textContent || '').trim().slice(0, 44),
    }));
  });
  for (const r of rows) {
    const k = r.panel + '|' + r.txt;
    if (!seen.has(k)) { seen.add(k); console.log(JSON.stringify(r)); }
  }
}
await browser.close();
