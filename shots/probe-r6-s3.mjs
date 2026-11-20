// R6 S3 探针：卡扇里每张卡的名/价元素是否被「画在它上面」的邻卡卡身盖住
// 覆盖判定：name/gem 的 axis-aligned rect 与更高层邻卡 .card-view rect 相交
// （层序：DOM 后者压前者；--sel/:focus-within 的 z-10 压所有普通卡）
// 用法: node shots/probe-r6-s3.mjs <w> <h> <phone|desktop> [seed]
import { chromium } from 'playwright';

const W = Number(process.argv[2]);
const H = Number(process.argv[3]);
const PHONE = process.argv[4] === 'phone';
const SEED = Number(process.argv[5] ?? 1);

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  hasTouch: PHONE,
  isMobile: PHONE,
});
await ctx.addInitScript(() => {
  try { localStorage.setItem('maicai-lang', 'en'); } catch { /* ignore */ }
});
const page = await ctx.newPage();
page.setDefaultTimeout(30_000);
await page.goto(`http://localhost:4173/?board=3d&seed=${SEED}&fast=1&demo=1`, {
  waitUntil: 'load',
  timeout: 30_000,
});
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

const MEASURE = () => {
  const items = [...document.querySelectorAll('.stall-hand .hand-item')];
  const cards = items.map((it, i) => {
    const view = it.querySelector('.card-view');
    const name = it.querySelector('.card-view-name');
    const gem = it.querySelector('.card-view-gem');
    const r = view.getBoundingClientRect();
    const z = it.classList.contains('hand-item--sel') ? 10 : i;
    return {
      i,
      name: name?.textContent?.trim() ?? '',
      sel: it.classList.contains('hand-item--sel'),
      card: { x: r.x, y: r.y, w: r.width, h: r.height },
      z,
      nameRect: name ? (() => { const q = name.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; })() : null,
      gemRect: gem ? (() => { const q = gem.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; })() : null,
    };
  });
  const inter = (a, b) => {
    const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return x * y;
  };
  const covered = [];
  for (const c of cards) {
    for (const o of cards) {
      if (o === c || o.z <= c.z) continue;
      const nA = c.nameRect ? inter(c.nameRect, o.card) : 0;
      const gA = c.gemRect ? inter(c.gemRect, o.card) : 0;
      if (nA > 0 || gA > 0) covered.push({ card: c.name, by: o.name, nameCoverPx2: Math.round(nA), priceCoverPx2: Math.round(gA) });
    }
  }
  return { n: cards.length, covered };
};
const rest = await page.evaluate(MEASURE);
console.log(`S3 ${W}x${H} ${PHONE ? 'phone' : 'desktop'} seed=${SEED} cards=${rest.n} rest covered=${JSON.stringify(rest.covered)}`);
/* 选中态：被选卡立直+放大 6%+z-10，查它有没有反过来压住邻卡的名/价，
   也查它自己的名/价是否被别的卡压（选中卡层序最高，理论上不会） */
const views = page.locator('.stall-hand .hand-item .card-view');
const n = await views.count();
for (const idx of [0, Math.floor(n / 2), n - 1]) {
  await views.nth(idx).click().catch(() => {});
  await page.waitForTimeout(600);
  const m = await page.evaluate(MEASURE);
  console.log(`   sel[${idx}] covered=${JSON.stringify(m.covered)}`);
}
await browser.close();
