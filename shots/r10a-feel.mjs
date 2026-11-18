/**
 * r10a-feel.mjs — R10 Slice A「手感四件」实测驱动：
 *   1) 拖拽跟随：pointerdown+move 后卡 transform 有位移
 *   2) 命中吸附/投放：拖进篮子区松手 → 引擎 STALL_BUY（币变少/卡离开摊位）
 *   3) 无效弹回：拖离两区松手 → transform 归零（spring-back）
 *   4) tap-tap 等价：点卡选中→点篮子区 → STALL_BUY
 * Usage: node shots/r10a-feel.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];
const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(2500);

async function waitPanel(testid, timeoutMs = 60_000) {
  const panel = page.locator(`[data-testid="${testid}"]`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if ((await panel.count()) > 0) return;
    const hasPopup = (await page.locator('.popup').count()) > 0;
    if (!hasPopup) {
      const e = page.locator('.board-enter, [data-testid="action-primary"]').first();
      if ((await e.count()) > 0) await e.dispatchEvent('click').catch(() => {});
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`${testid} never opened`);
}

// 先过抽任务站（点牌堆翻牌 → DRAW_RECIPE），再 demo 跳到市场
await waitPanel('panel-drawTask');
await page.locator('.deck').waitFor({ timeout: 15_000 });
await page.locator('.deck-top').click();
await page.waitForTimeout(1200);
if ((await page.locator('[data-testid="demo-station-2"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-2"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await waitPanel('panel-market');
await page.locator('.stall-hand').waitFor({ timeout: 15_000 });
await page.waitForTimeout(900);

const coins = async () =>
  page.evaluate(() => document.querySelector('.coin-counter')?.textContent ??
    document.querySelector('.coins-count')?.textContent ?? '');

/* —— 1+2) 拖拽跟随 + 命中投放 —— */
const card = page.locator('[data-testid^="action-stall-"]').last();
const cb = await card.boundingBox();
const zone = page.locator('.drop-zone--basket');
const zb = await zone.boundingBox();
if (!cb || !zb) throw new Error('missing card/zone box');
const sx = cb.x + cb.width / 2;
const sy = cb.y + cb.height / 2;
const coinsBefore = await coins();

await page.mouse.move(sx, sy);
await page.mouse.down();
await page.mouse.move(sx + 40, sy - 60, { steps: 6 });
await page.waitForTimeout(120);
const dragEl = page.locator('.hand-drag--up').first();
const follow = (await dragEl.count()) > 0;
const tf = follow ? await dragEl.evaluate((el) => el.style.transform) : '';
console.log('1) drag-follow:', follow ? `OK (${tf.slice(0, 60)})` : 'FAIL no transform');
// 投放区热态
await page.mouse.move(zb.x + zb.width / 2, zb.y + zb.height / 2, { steps: 8 });
await page.waitForTimeout(120);
const hot = await zone.evaluate((el) => el.classList.contains('drop-zone--hot'));
console.log('2a) zone hot on hover:', hot ? 'OK' : 'FAIL');
await page.mouse.up();
await page.waitForTimeout(700);
const coinsAfter = await coins();
console.log(`2b) drop→buy: coins ${coinsBefore} → ${coinsAfter}`, coinsBefore !== coinsAfter ? 'OK' : 'FAIL?');

/* —— 3) 无效弹回 —— */
const card2 = page.locator('[data-testid^="action-stall-"]').last();
const cb2 = await card2.boundingBox();
if (cb2) {
  await page.mouse.move(cb2.x + cb2.width / 2, cb2.y + cb2.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb2.x - 300, cb2.y - 250, { steps: 8 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const back = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.hand-drag')].find(
      (d) => d.style.transition.includes('transform'),
    );
    return el ? 'returning' : 'idle';
  });
  console.log('3) spring-back after invalid drop:', back === 'returning' ? 'OK' : 'check');
  await page.waitForTimeout(600);
  const settled = await page.evaluate(() =>
    [...document.querySelectorAll('.hand-drag')].every((d) => d.style.transform === ''),
  );
  console.log('   settled back in fan:', settled ? 'OK' : 'FAIL');
}

/* —— 4) tap-tap：点卡选中 → 点篮子区 → STALL_BUY —— */
const coinsB4Tap = await coins();
await page.locator('[data-testid^="action-stall-"]').last().click();
await page.waitForTimeout(250);
const armed = await zone.evaluate((el) => el.className);
await page.locator('.drop-zone--basket').click();
await page.waitForTimeout(700);
const coinsAfterTap = await coins();
console.log(`4) tap-tap buy: coins ${coinsB4Tap} → ${coinsAfterTap}`, coinsB4Tap !== coinsAfterTap ? 'OK' : 'FAIL?');

/* —— 5) 键盘：数字键 1 = 买（选中卡） —— */
const coinsB4Key = await coins();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
await page.keyboard.press('1');
await page.waitForTimeout(700);
const coinsAfterKey = await coins();
console.log(`5) keyboard buy (numkey 1): coins ${coinsB4Key} → ${coinsAfterKey}`, coinsB4Key !== coinsAfterKey ? 'OK' : 'check(disabled?)');

await browser.close();
console.log('done');
