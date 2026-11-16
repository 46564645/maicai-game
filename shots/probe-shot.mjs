import { chromium } from '@playwright/test';
const BASE = 'http://localhost:4174';
const GL_ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL_ARGS });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0,200)));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 20000 }).catch(() => null);
  const mounted = await page.locator('[data-testid="board3d"] canvas').count();
  console.log('board3d canvas:', mounted, 'fitD:', JSON.stringify(await page.evaluate(() => window.__fitD)));
  await page.keyboard.press('d');
  await page.locator('.board3d-reset').click().catch(() => null);
  await page.waitForTimeout(4500);
  const t0 = Date.now();
  await page.screenshot({ path: '/tmp/probe_scene_4s.png', timeout: 120_000 });
  console.log('shot1 ok in', ((Date.now()-t0)/1000).toFixed(1), 's');
  await ctx.close();
} finally { await browser.close(); }
