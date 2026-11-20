// R6 N1 续：点选灰卡后逐 500ms 扫环/抬升何时落地（pending 提交节拍？）
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); localStorage.setItem('maicai-icons-seen', '1'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=2&fast=1&demo=1', { waitUntil: 'load', timeout: 30_000 });
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(1500);
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
}
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
await page.waitForTimeout(1200);
const scan = () => page.evaluate(() => {
  const cards = [...document.querySelectorAll('.stall-hand .hand-item .card-view')].map((c) => ({
    name: c.querySelector('.card-view-name')?.textContent?.trim(),
    ring: /0px 0px 0px 3px/.test(getComputedStyle(c).boxShadow),
    y: Math.round(c.getBoundingClientRect().y),
    itemSel: c.closest('.hand-item')?.classList.contains('hand-item--sel') ?? false,
    glowCls: c.closest('.pglow')?.className ?? '',
    cls: c.className,
    focused: c === document.activeElement || c.contains(document.activeElement),
    tf: getComputedStyle(c).transform,
    itemTf: getComputedStyle(c.closest('.hand-item')).transform,
  }));
  const ys = cards.map((c) => c.y).sort((a, b) => a - b);
  const med = ys[Math.floor(ys.length / 2)];
  return cards.map((c) => ({ ...c, lift: c.y - med }));
});
console.log('t0   ', JSON.stringify(await scan()));
const names = await page.evaluate(() => [...document.querySelectorAll('.stall-hand .card-view-name')].map((n) => n.textContent.trim()));
const gi = names.indexOf('Toy');
await page.locator('.stall-hand .hand-item .card-view').nth(gi).click();
for (let t = 500; t <= 3000; t += 500) {
  await page.waitForTimeout(500);
  console.log(`t${t}  `, JSON.stringify(await scan()));
}
await browser.close();
