/** r8-noui-only.mjs — 只补 _noui.png（藏 UI 后的棋盘纯景）。
 * Usage: BASE=... node shots/r8-noui-only.mjs r10a phone-740x360 desktop-1440x900 ...
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] ?? 'r10a';
const NAMES = process.argv.slice(3);
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const PANEL_SELECTORS = [
  '.game-topbar', '.bot-card', '.lap-card', '.game-bottom', '.board3d-overlay',
  '.board3d-status', '.popup', '.phone-rail', '.phone-turn', '.phone-bots',
  '.phone-quick', '.toast-stack', '.speech-bubble', '.lang-toggle',
];
const CASES = {
  'phone-844x390': [844, 390, true],
  'phone-874x402': [874, 402, true],
  'phone-915x412': [915, 412, true],
  'phone-740x360': [740, 360, true],
  'desktop-1024x768': [1024, 768, false],
  'desktop-1280x800': [1280, 800, false],
  'desktop-1440x900': [1440, 900, false],
  'desktop-1600x1000': [1600, 1000, false],
  'desktop-1920x1080': [1920, 1080, false],
};

const browser = await chromium.launch({ args: GL_ARGS });
for (const name of NAMES) {
  const [w, h, phone] = CASES[name];
  const ctx = await browser.newContext(
    phone ? { viewport: { width: w, height: h }, hasTouch: true, isMobile: true }
          : { viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 60_000 }).catch(() => null);
  await page.waitForTimeout(4500);
  await page.addStyleTag({
    content: `${PANEL_SELECTORS.join(',')}{visibility:hidden !important}`,
  });
  await page.waitForTimeout(600);
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  fs.writeFileSync(path.join(OUT, `r8_${name}_${TAG}_noui.png`), Buffer.from(res.data, 'base64'));
  console.log(`r8_${name}_${TAG}_noui.png`);
  await ctx.close();
}
await browser.close();
