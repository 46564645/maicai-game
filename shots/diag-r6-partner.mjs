// R6 伙伴站单景探针：跳伙伴站截图 r6_swap_<W>.png + 邀约卡美术占比
// （长会话多景在 SwiftShader 下易崩，单景单跑最稳）
// 用法: node shots/diag-r6-partner.mjs <w> <h> <phone|desktop> [seed]
import { chromium } from '@playwright/test';

const W = Number(process.argv[2]);
const H = Number(process.argv[3]);
const PHONE = process.argv[4] === 'phone';
const SEED = Number(process.argv[5] ?? 1);
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
await page.locator('[data-testid="demo-station-3"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-partner"]').waitFor({ timeout: 20_000 }).catch(() => {});
await page.waitForTimeout(1500);
/* 手机竖栏里弹窗是可滚长列：把邀约卡完整滚入栏窗（上方留 ~100px
   给站名签），让被审的卡面 + 分摊说明行同框（复拍口径） */
await page.evaluate(() => {
  const card = document.querySelector('.invite-card .card-view') ?? document.querySelector('.card-view');
  if (!card) return;
  let sc = card.parentElement;
  while (sc && !(sc.scrollHeight > sc.clientHeight + 4)) sc = sc.parentElement;
  if (!sc) return;
  const cr = card.getBoundingClientRect();
  const sr = sc.getBoundingClientRect();
  sc.scrollTop += cr.top - sr.top - 100;
});
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const invite = document.querySelector('.invite-card .card-view') ?? [...document.querySelectorAll('.card-view')].find((v) => v.querySelector('.card-view-tag'));
  if (!invite) return null;
  const cardR = invite.getBoundingClientRect();
  const artR = invite.querySelector('.card-view-art')?.getBoundingClientRect();
  return {
    name: invite.querySelector('.card-view-name')?.textContent?.trim(),
    tag: invite.querySelector('.card-view-tag')?.textContent?.trim(),
    artShare: artR ? +(artR.height / cardR.height).toFixed(3) : null,
  };
});
const frame = await page.evaluate(() => {
  const popup = document.querySelector('.popup');
  const r = popup?.getBoundingClientRect();
  const demoEls = [...document.querySelectorAll('[data-testid="demo-bar"], .demo-bar, .demo-bar-toggle')]
    .filter((el) => el.getClientRects().length > 0);
  return {
    popup: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) } : null,
    demoVisible: demoEls.length,
  };
});
await page.screenshot({ path: `shots/r6_swap_${W}.png`, timeout: 90_000 });
console.log(`PARTNER ${W}x${H} seed=${SEED} invite=${JSON.stringify(info)} frame=${JSON.stringify(frame)} viewport=${W}x${H}`);
await browser.close();
