/** capreflect.mjs — 感想帧最小捕获（无前置截图/无量测，落定后单拍）：
 * node shots/capreflect.mjs <w> <h> <phone|desktop> <outfile> */
import { chromium } from '@playwright/test';
const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const [w, h, kind, out] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4], process.argv[5]];
const browser = await chromium.launch({ args: GL });
const ctx = kind === 'phone'
  ? await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })
  : await browser.newContext({ viewport: { width: w, height: h } });
const page = await ctx.newPage();
await page.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1');
if (kind === 'phone' && w === 874) {
  await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' });
}
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(2500);
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-lap-3"]').dispatchEvent('click');
await page.locator('[data-testid="demo-station-8"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
const advance = () => page.evaluate(() => {
  const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
  const no = document.querySelector('[data-testid="proposal-no"]');
  if (vis(no)) { no.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
  const primary = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
  if (primary) { primary.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
  const keyed = [...document.querySelectorAll('[data-key]')].filter(vis);
  if (keyed.length) {
    const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
}).catch(() => {});
for (let i = 0; i < 400; i++) {
  if (await page.locator('[data-testid="screen-reflection"]').count()) break;
  const thinking = await page.locator('.bot-card--thinking, .phone-bot--on').count();
  if (!thinking) await advance();
  await page.waitForTimeout(200);
}
await page.locator('.reflection-options .hand-item').nth(4).waitFor({ timeout: 15_000 }).catch(() => null);
await page.waitForTimeout(2200);
await page.screenshot({ path: `shots/${out}` });
console.log('shot', out);
await browser.close();
