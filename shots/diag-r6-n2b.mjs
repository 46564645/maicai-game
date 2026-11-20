import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang','en'); localStorage.setItem('maicai-icons-seen','1'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30000 });
await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(()=>{});
await page.locator('[data-testid="action-primary"]').click({ timeout: 15000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20000 });
await page.waitForTimeout(1500);
for (let i=0;i<6;i++){ if ((await page.locator('.popup').count())===0) break; await page.locator('.popup [data-testid="action-primary"]').first().click().catch(()=>{}); await page.waitForTimeout(500); }
if ((await page.locator('[data-testid="demo-bar"]').count())===0) { await page.keyboard.press('d'); await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10000 }); }
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.waitForTimeout(2000);
const out = await page.evaluate(() => {
  const R = (el) => { if(!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), text: el.textContent.trim().replace(/\s+/g,' ').slice(0,44), cls: el.className.toString().slice(0,40) }; };
  const rail = document.querySelector('.phone-rail');
  return { railScrollTop: rail?.scrollTop, toggle: R(document.querySelector('.phone-rail .lang-toggle')), turn: R(document.querySelector('.phone-turn')), turnKids: [...document.querySelectorAll('.phone-turn > *')].map(R) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
