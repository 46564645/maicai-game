import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4174/?board=2d&seed=1&fast=1&demo=1');
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.waitForTimeout(2000);
  const t0 = Date.now();
  await page.screenshot({ path: '/tmp/probe_2d.png', timeout: 60_000 });
  console.log('2D board screenshot ok in', ((Date.now()-t0)/1000).toFixed(1), 's');
  await ctx.close();
} finally { await browser.close(); }
