// R6 状态图单景探针（Part 1.5）：找含灰底卡的种子——选中灰卡 +
// 按住普通卡 + 其余静置，截图 r6_states_<W>.png
// 用法: node shots/diag-r6-states.mjs <w> <h> <phone|desktop>
import { chromium } from '@playwright/test';

const W = Number(process.argv[2]);
const H = Number(process.argv[3]);
const PHONE = process.argv[4] === 'phone';
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function freshPage(seed) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: PHONE, isMobile: PHONE });
  await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:4173/?board=3d&seed=${seed}&fast=1&demo=1`, { waitUntil: 'load', timeout: 30_000 });
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
  return { ctx, page };
}

let done = false;
for (let seed = 2; seed <= 6 && !done; seed++) {
  const { ctx, page } = await freshPage(seed);
  await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(900);
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('.stall-hand [data-testid^="action-stall-"]')].map((el) => el.dataset.testid.replace('action-stall-', '')),
  );
  const tmpIdx = ids.findIndex((id) => id.startsWith('tmp-'));
  if (tmpIdx < 0) { await ctx.close(); continue; }
  const views = page.locator('.stall-hand .hand-item .card-view');
  await views.nth(tmpIdx).click().catch(() => {});
  await page.waitForTimeout(500);
  const otherIdx = ids.findIndex((id, i) => i !== tmpIdx && !id.startsWith('tmp-'));
  const box = await views.nth(otherIdx).boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(350);
  }
  await page.screenshot({ path: `shots/r6_states_${W}.png`, timeout: 120_000 });
  console.log(`STATES ${W}x${H} seed=${seed} greyCard=${ids[tmpIdx]} pressedIdx=${otherIdx}`);
  await page.mouse.up().catch(() => {});
  await ctx.close();
  done = true;
}
if (!done) console.log(`STATES ${W}x${H} NONE`);
await browser.close();
