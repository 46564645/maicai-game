import { chromium } from '@playwright/test';
const SEED = Number(process.argv[2] ?? 1);
const browser = await chromium.launch({ args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang','en'); localStorage.setItem('maicai-icons-seen','1'); } catch {} });
const page = await ctx.newPage();
await page.goto(`http://localhost:4173/?board=3d&seed=${SEED}&fast=1&demo=1`, { waitUntil: 'load', timeout: 30000 });
await page.locator('[data-testid="action-primary"]').click({ timeout: 15000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20000 });
await page.waitForTimeout(1500);
for (let i=0;i<6;i++){ if ((await page.locator('.popup').count())===0) break; await page.locator('.popup [data-testid="action-primary"]').first().click().catch(()=>{}); await page.waitForTimeout(500); }
if ((await page.locator('[data-testid="demo-bar"]').count())===0) { await page.keyboard.press('d'); await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10000 }); }
await page.locator('[data-testid="demo-station-7"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.waitForTimeout(2500);
const names = await page.evaluate(() => [...document.querySelectorAll('.card-view-name')].map((n) => {
  const cs = getComputedStyle(n);
  return { name: n.textContent.trim(), fontPx: parseFloat(cs.fontSize), lines: Math.round(n.getBoundingClientRect().height / parseFloat(cs.lineHeight || 20)), clipped: n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1 };
}));
console.log(`STORE seed=${SEED}`, JSON.stringify(names));
if (names.some((n) => n.name === 'Marshmallow')) {
  await page.screenshot({ path: 'shots/r6_longname_1280.png', timeout: 120000 }).catch((e) => console.log('shot fail', e.message.slice(0, 40)));
  console.log('  marshmallow shot saved');
}
await browser.close();
