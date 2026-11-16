/** One-off convergence probe (not part of the repo harness): does the
 *  desktop camera reach the solver-predicted framing if given wall time?
 *  Screenshots at 4.5s and at 60s after the reset click + __fitD. */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL_ARGS });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 20_000 }).catch(() => null);
  const mounted = await page.locator('[data-testid="board3d"] canvas').count();
  console.log('board3d canvas count:', mounted);
  await page.keyboard.press('d');
  await page.locator('.board3d-reset').click().catch(() => null);
  await page.waitForTimeout(4500);
  console.log('t=4.5s __fitD:', JSON.stringify(await page.evaluate(() => window.__fitD)));
  await page.screenshot({ path: '/tmp/probe_4s.png', timeout: 180_000 });
  console.log('shot /tmp/probe_4s.png');
  await page.waitForTimeout(55000);
  console.log('t=60s __fitD:', JSON.stringify(await page.evaluate(() => window.__fitD)));
  await page.screenshot({ path: '/tmp/probe_60s.png', timeout: 180_000 });
  console.log('shot /tmp/probe_60s.png');
  await ctx.close();
} finally {
  await browser.close();
}
