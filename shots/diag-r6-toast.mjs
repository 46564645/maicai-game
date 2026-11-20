import { chromium } from '@playwright/test';
const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL });
const ctx = await browser.newContext({ viewport: { width: 874, height: 402 } });
await ctx.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30_000 });
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  const scrollers = [...document.querySelectorAll('*')].filter((e) => e.scrollTop > 0).map((e) => `${e.className.split(' ')[0]}:${e.scrollTop}`);
  const chain = [];
  let n = document.querySelector('.toast-stack');
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    chain.push(`${n.className.split(' ')[0]}[tf=${cs.transform !== 'none'} pos=${cs.position}]`);
    n = n.parentElement;
  }
  return {
    scrollY: window.scrollY,
    scrollers,
    topbar: document.querySelector('.game-topbar') ? r(document.querySelector('.game-topbar')) : null,
    toggle: document.querySelector('[data-testid="lang-toggle"]') ? r(document.querySelector('[data-testid="lang-toggle"]')) : null,
    toastStack: document.querySelector('.toast-stack') ? r(document.querySelector('.toast-stack')) : null,
    chain: chain.join(' < '),
    shellH: document.querySelector('.app-shell')?.getBoundingClientRect().height,
    bodyScrollH: document.body.scrollHeight,
  };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: 'shots/r6_diag_desktop874.png' });
await browser.close();
