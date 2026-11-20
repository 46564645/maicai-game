// R6 记号复测（Part 2.1/2.3）：指定种子的市场摊卡——记号渲染尺寸 +
// 记号主色 vs 该卡底色对比。用 法: node shots/diag-r6-icons.mjs <w> <h> <phone|desktop> <seed>
import { chromium } from '@playwright/test';

const W = Number(process.argv[2]);
const H = Number(process.argv[3]);
const PHONE = process.argv[4] === 'phone';
const SEED = Number(process.argv[5] ?? 2);
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: PHONE, isMobile: PHONE });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); } catch {} });
const page = await ctx.newPage();
await page.goto(`http://localhost:4173/?board=3d&seed=${SEED}&fast=1&demo=1`, { waitUntil: 'load', timeout: 30_000 });
if (PHONE && W === 874) {
  await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(() => {});
}
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(2000);
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(600);
}
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
await page.waitForTimeout(1000);
const rows = await page.evaluate(() => {
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (fg, bg) => {
    const [l1, l2] = [lum(...fg), lum(...bg)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const parse = (s) => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
  const ICON_FG = { list: [20, 113, 58], food: [207, 74, 14], fun: [123, 79, 208] };
  const out = [];
  for (const view of document.querySelectorAll('.stall-hand .card-view')) {
    const iconEl = view.querySelector('.meta-icon');
    const kind = iconEl ? [...iconEl.classList].join(' ').match(/meta-icon--(\w+)/)?.[1] : null;
    const bg = parse(getComputedStyle(view).backgroundColor);
    const artR = view.querySelector('.card-view-art')?.getBoundingClientRect();
    const cardR = view.getBoundingClientRect();
    out.push({
      name: view.querySelector('.card-view-name')?.textContent?.trim(),
      iconKind: kind,
      iconPx: iconEl ? +iconEl.getBoundingClientRect().width.toFixed(1) : null,
      iconContrast: kind ? +ratio(ICON_FG[kind], bg).toFixed(2) : null,
      artShare: artR ? +(artR.height / cardR.height).toFixed(3) : null,
      cardBg: `rgb(${bg.join(',')})`,
    });
  }
  return out;
});
console.log(`ICONS ${W}x${H} seed=${SEED}`);
for (const r of rows) console.log('  ', JSON.stringify(r));
await browser.close();
