// R6 N7b 量测：伙伴邀请景——Yes 卡上朗读徽标与价丸/记号的矩形与重叠
import { chromium } from '@playwright/test';

const W = Number(process.argv[2] ?? 1280);
const H = Number(process.argv[3] ?? 800);
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); localStorage.setItem('maicai-icons-seen', '1'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30_000 });
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
await page.locator('[data-testid="demo-station-3"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.waitForTimeout(2500);
const out = await page.evaluate(() => {
  const inter = (a, b) => {
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return Math.round(x * y);
  };
  const rows = [];
  for (const card of document.querySelectorAll('.choice-hand .card-view')) {
    const name = card.querySelector('.card-view-name')?.textContent?.trim();
    const gem = card.querySelector('.card-view-gem');
    const wrap = card.closest('.card-view-speak');
    const btn = wrap?.querySelector('.card-view-speak-btn');
    const cr = card.getBoundingClientRect();
    rows.push({
      name,
      card: { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height) },
      gem: gem ? { x: Math.round(gem.getBoundingClientRect().x), y: Math.round(gem.getBoundingClientRect().y), w: Math.round(gem.getBoundingClientRect().width), h: Math.round(gem.getBoundingClientRect().height) } : null,
      badge: btn ? { x: Math.round(btn.getBoundingClientRect().x), y: Math.round(btn.getBoundingClientRect().y), w: Math.round(btn.getBoundingClientRect().width), h: Math.round(btn.getBoundingClientRect().height) } : null,
      badgeGemOverlap: gem && btn ? inter(gem.getBoundingClientRect(), btn.getBoundingClientRect()) : null,
    });
  }
  return rows;
});
console.log('BADGE', JSON.stringify(out, null, 1));
await browser.close();
