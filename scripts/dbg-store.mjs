import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

async function jumpStation(page, station, panelTestid, timeout = 30_000) {
  await page.keyboard.press('d');
  await page.locator(`[data-testid="demo-station-${station}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  const panel = page.locator(`[data-testid="${panelTestid}"]`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await panel.count()) > 0) return;
    const enter = page.locator('[data-testid="action-primary"]').first();
    const hasPopup = (await page.locator('.popup').count()) > 0;
    if (!hasPopup && (await enter.count()) > 0) await enter.click();
    await page.waitForTimeout(300);
  }
  throw new Error('timeout');
}

const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.locator('[data-primary="true"]').waitFor();
await page.locator('[data-testid="action-primary"]').click();
await page.keyboard.press('d');
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(2000);
await jumpStation(page, 7, 'panel-store');
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('[data-testid^="action-store-"]')].map((b) => ({
    id: b.dataset.testid,
    disabled: b.disabled,
    pressed: b.getAttribute('aria-pressed'),
  }));
  return { sel: !!document.querySelector('.panel-selected'), cards };
});
console.log(JSON.stringify(info, null, 1));

// real click on first enabled
const btn = page.locator('[data-testid^="action-store-"]:not(:disabled)').first();
await btn.click();
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({
  sel: !!document.querySelector('.panel-selected'),
  pressed: [...document.querySelectorAll('[data-testid^="action-store-"]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.testid),
}));
console.log('after real click:', JSON.stringify(after));
await browser.close();
