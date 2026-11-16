import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4174/?board=3d&seed=1&fast=1&demo=1');
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 20000 }).catch(() => null);
  console.log('board3d canvas:', await page.locator('[data-testid="board3d"] canvas').count());
  await page.keyboard.press('d');
  await page.locator('.board3d-reset').click().catch(() => null);
  await page.waitForTimeout(4500);
  const cdp = await ctx.newCDPSession(page);
  const t0 = Date.now();
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  const fs = await import('node:fs');
  fs.writeFileSync('/tmp/probe_cdp_rm.png', Buffer.from(shot.data, 'base64'));
  console.log('CDP fromSurface:false ok in', ((Date.now()-t0)/1000).toFixed(1), 's');
  await ctx.close();
} finally { await browser.close(); }
