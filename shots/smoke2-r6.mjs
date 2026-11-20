import { chromium } from 'playwright';
const BASE = 'http://localhost:4173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem('maicai-lang', 'en'));
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 200)); });
await page.goto(BASE + '/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30000 });
for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => ({
    canvas: document.querySelectorAll('canvas').length,
    splash: !!document.querySelector('[data-testid="loading-splash"], .loading-splash, .splash'),
    testids: [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')).filter((t) => !t.startsWith('demo-')).slice(0, 10).join(','),
    bodyClass: document.body.className.slice(0, 80),
  }));
  console.log(`t=${(i + 1) * 3}s`, JSON.stringify(info));
}
await browser.close();
console.log('SMOKE2 DONE');
