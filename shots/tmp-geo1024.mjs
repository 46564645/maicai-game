import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('maicai-lang', 'en'));
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.keyboard.press('d');
await page.waitForTimeout(400);
await page.locator('[data-testid="demo-lap-1"]').dispatchEvent('click').catch(() => {});
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click').catch(() => {});
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click').catch(() => {});
await page.waitForTimeout(2500);
const d = await page.evaluate(() => {
  const RR = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { y: +r.y.toFixed(1), h: +r.height.toFixed(1), bottom: +r.bottom.toFixed(1) }; };
  return {
    popup: RR(document.querySelector('.popup')),
    body: RR(document.querySelector('.panel-body')),
    foot: RR(document.querySelector('.panel-foot')),
    guide: RR(document.querySelector('.stall-guide')),
    coinbar: RR(document.querySelector('.coin-bar')),
    seg: RR(document.querySelector('.cb-seg')),
    num: RR(document.querySelector('.cb-num')),
    label: RR(document.querySelector('.cb-label')),
    bodyScroll: document.querySelector('.panel-body') ? { sh: document.querySelector('.panel-body').scrollHeight, ch: document.querySelector('.panel-body').clientHeight } : null,
    popupScroll: document.querySelector('.popup') ? { sh: document.querySelector('.popup').scrollHeight, ch: document.querySelector('.popup').clientHeight } : null,
  };
});
console.log(JSON.stringify(d, null, 1));
await browser.close();
