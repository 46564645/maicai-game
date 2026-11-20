import { chromium } from '@playwright/test';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.waitForTimeout(2500);
// demo 跳 cook lap3 → 做饭 → 开饭
async function jumpTo(stationIdx, panelTestid, lap) {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
    await page.waitForTimeout(600);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  if (lap !== null) await page.locator(`[data-testid="demo-lap-${lap}"]`).dispatchEvent('click');
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  await page.locator(`[data-testid="${panelTestid}"]`).waitFor({ timeout: 30_000 }).catch(() => null);
}
await jumpTo(8, 'panel-cook', 3);
await page.waitForTimeout(1000);
// 推进做饭直到 feast
for (let i = 0; i < 40; i++) {
  if (await page.locator('[data-testid="screen-feast"]').count()) break;
  await page.evaluate(() => {
    const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
    const p = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
    if (p) { p.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
    const k = [...document.querySelectorAll('[data-key]')].filter(vis);
    if (k.length) k[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }).catch(() => {});
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1200);
const data = await page.evaluate(() => {
  const plate = document.querySelector('.plate-card');
  if (!plate) return { feast: false };
  const R = (el) => { const r = el.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), y: +r.y.toFixed(1), cw: el.clientWidth, ch: el.clientHeight }; };
  const disc = plate.querySelector('.plate-disc');
  const img = plate.querySelector('.plate-art');
  const cs = img ? getComputedStyle(img) : null;
  const pcs = getComputedStyle(plate);
  const dcs = getComputedStyle(disc);
  return {
    feast: true,
    plate: { ...R(plate), cssH: pcs.height, display: pcs.display, flexDir: pcs.flexDirection },
    discFlex: { flex: dcs.flex, minH: dcs.minHeight }, 
    disc: R(disc),
    img: img ? { ...R(img), natural: [img.naturalWidth, img.naturalHeight], objectFit: cs.objectFit, complete: img.complete } : null,
    kids: [...plate.children].map((el) => ({ cls: el.className, h: R(el).h, ch: el.clientHeight, fs: getComputedStyle(el).fontSize, text: (el.textContent || '').trim().slice(0, 24) })),
  };
});
console.log(JSON.stringify(data, null, 1));
await browser.close();
