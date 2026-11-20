// Post-merge (⑦) probe: find elements causing rail horizontal overflow in panel-store.
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
const reported = new Set();
for (let i = 0; i < 400; i++) {
  if ((await page.getByTestId('action-replay').count()) > 0) break;
  await stepOnce(page);
  await page.waitForTimeout(120);
  const m = await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    const panel = document.querySelector('[data-testid^="panel-"]');
    if (!rail || !panel) return null;
    const hOver = rail.scrollWidth - rail.clientWidth;
    if (hOver <= 0) return null;
    const bad = [...rail.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth + 2)
      .sort((a, b) => (b.scrollWidth - b.clientWidth) - (a.scrollWidth - a.clientWidth)).slice(0, 6)
      .map((e) => `${e.tagName}.${String(e.className).split(' ').slice(0, 3).join('.')} cw=${e.clientWidth} sw=${e.scrollWidth} txt=${(e.textContent || '').trim().slice(0, 40)}`);
    return { panel: panel.getAttribute("data-testid"), hOver, bad };
  });
  if (m && !reported.has(m.panel + m.hOver)) { reported.add(m.panel + m.hOver); console.log(JSON.stringify(m, null, 1)); }
}
await browser.close();
