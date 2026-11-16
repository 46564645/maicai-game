import { chromium } from '@playwright/test';
const GL_ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL_ARGS });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('PAGE', m.type(), m.text().slice(0, 200)); });
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
  await page.goto('http://localhost:4174/?board=3d&seed=1&fast=1&demo=1');
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 20000 }).catch(() => null);
  await page.keyboard.press('d');
  await page.locator('.board3d-reset').click().catch(() => null);
  await page.waitForTimeout(4500);
  const info = await page.evaluate(() => {
    const keys = Object.keys(window).filter(k => k.startsWith('__'));
    const fitD = window.__fitD;
    const cam = window.__cam3;
    const c3d = document.querySelectorAll('[data-testid="board3d"] canvas').length;
    const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src.split('/').pop());
    return { keys, fitD: fitD ?? null, camPos: cam ? [cam.position.x, cam.position.y, cam.position.z].map(v => +v.toFixed(2)) : null, camFov: cam ? cam.fov : null, has3d: c3d, scripts };
  });
  console.log(JSON.stringify(info));
  await ctx.close();
} finally { await browser.close(); }
