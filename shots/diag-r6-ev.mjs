import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang','en'); localStorage.setItem('maicai-icons-seen','1'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30000 });
await page.locator('[data-testid="action-primary"]').click({ timeout: 15000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20000 });
await page.waitForTimeout(1500);
for (let i=0;i<6;i++){ if ((await page.locator('.popup').count())===0) break; await page.locator('.popup [data-testid="action-primary"]').first().click().catch(()=>{}); await page.waitForTimeout(500); }
if ((await page.locator('[data-testid="demo-bar"]').count())===0) { await page.keyboard.press('d'); await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10000 }); }
await page.locator('[data-testid="demo-station-5"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.waitForTimeout(4000);
const info = await page.evaluate(() => ({
  popup: document.querySelector('.popup')?.getAttribute('data-testid'),
  moment: !!document.querySelector('[data-testid="weather-moment"]'),
  weatherCard: !!document.querySelector('[data-testid="weather-card"]'),
  story: document.querySelector('.event-story .card-view-name')?.textContent?.trim() ?? null,
  panelText: document.querySelector('.popup')?.textContent?.trim()?.replace(/\s+/g,' ').slice(0,120),
}));
console.log(JSON.stringify(info));
await page.screenshot({ path: 'shots/r6_event_diag.png', timeout: 60000 }).catch((e) => console.log('shot fail', e.message.slice(0,50)));
await browser.close();
