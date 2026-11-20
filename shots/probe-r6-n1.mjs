// R6 N1 量测（量测优先，截图最后且可失败）：
// ① 市场扇：非选中卡的计算阴影集合（灰底/普通须同一套参数）、选中卡的
//    3px 主色环 + 同框相对抬升、导引句；买满后锁标尺寸
// ② 伙伴景：普通 button.card-view 按压保持时的 :active 位移/阴影（evaluate 量）
// 用法: node shots/probe-r6-n1.mjs <w> <h> <phone|desktop> [shot]
import { chromium } from '@playwright/test';

const W = Number(process.argv[2]);
const H = Number(process.argv[3]);
const PHONE = process.argv[4] === 'phone';
const WANT_SHOT = process.argv[5] === 'shot';
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: PHONE, isMobile: PHONE });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); localStorage.setItem('maicai-icons-seen', '1'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=2&fast=1&demo=1', { waitUntil: 'load', timeout: 30_000 });
if (PHONE && W === 874) {
  await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(() => {});
}
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

const TMP = ['Toy', 'Popsicle', 'Sticker', 'Marshmallow'];
const scan = () => page.evaluate((TMP) => {
  const cards = [...document.querySelectorAll('.stall-hand .hand-item .card-view')].map((c) => {
    const shadow = getComputedStyle(c).boxShadow;
    const r = c.getBoundingClientRect();
    return {
      name: c.querySelector('.card-view-name')?.textContent?.trim(),
      grey: TMP.includes(c.querySelector('.card-view-name')?.textContent?.trim()),
      shadow, hasRing: /0px 0px 0px 3px/.test(shadow),
      y: Math.round(r.y),
      itemSel: c.closest('.hand-item')?.classList.contains('hand-item--sel') ?? false,
    };
  });
  const rest = cards.filter((c) => !c.hasRing);
  const ys = cards.map((c) => c.y).sort((a, b) => a - b);
  return {
    cards,
    restShadowSet: [...new Set(rest.map((c) => c.shadow))],
    selected: cards.filter((c) => c.hasRing).map((c) => ({ name: c.name, grey: c.grey, liftVsMedian: c.y - ys[Math.floor(ys.length / 2)] })),
    guide: document.querySelector('.stall-guide-text')?.textContent?.trim(),
  };
}, TMP);

const s0 = await scan();
console.log(`N1 ${W}x${H} initial: restShadowVariants=${s0.restShadowSet.length} selected=${JSON.stringify(s0.selected)} guide=${s0.guide}`);
if (process.argv[6] === 'shotonly') {
  const gi = s0.cards.findIndex((c) => c.grey);
  if (gi >= 0) {
    await page.locator('.stall-hand .hand-item .card-view').nth(gi).click();
    /* 指针移开：悬停倾斜的弹簧动画会一直占着合成器，截图排不上 */
    await page.mouse.move(8, 8);
    await page.waitForTimeout(1500);
    const s1 = await scan();
    console.log(`  shotonly selected=${JSON.stringify(s1.selected)} guide=${s1.guide}`);
  }
  /* 右键按压一张普通卡：倾斜按下但不改选（click 只认主键），
     与灰卡选中态同框成真三态；CDP 抓帧不等合成器稳定 */
  const ni = process.argv[7] === 'nopress' ? -1 : s0.cards.findIndex((c) => !c.grey);
  if (ni >= 0) {
    const bb = await page.locator('.stall-hand .hand-item .card-view').nth(ni).boundingBox();
    if (bb) {
      await page.mouse.move(bb.x + bb.width * 0.75, bb.y + bb.height * 0.7);
      await page.mouse.down({ button: 'right' });
      await page.waitForTimeout(500);
    }
  }
  /* Playwright 截图在此景反复超时（合成器繁忙）——走 CDP 原始抓帧 */
  try {
    const cdp = await ctx.newCDPSession(page);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`shots/r6_states_${W}.png`, Buffer.from(data, 'base64'));
    console.log('  shot saved via CDP');
  } catch (e) {
    console.log('  CDP shot failed:', String(e).slice(0, 60));
  }
  await page.mouse.up({ button: 'right' }).catch(() => {});
  await browser.close();
  process.exit(0);
}

/* 点选灰底卡 → 再扫 */
const greyIdx = s0.cards.findIndex((c) => c.grey);
if (greyIdx >= 0) {
  await page.locator('.stall-hand .hand-item .card-view').nth(greyIdx).click();
  await page.waitForTimeout(600);
  const s1 = await scan();
  console.log(`  afterGreyClick: restShadowVariants=${s1.restShadowSet.length} selected=${JSON.stringify(s1.selected)} guide=${s1.guide}`);
  if (WANT_SHOT) {
    await page.screenshot({ path: `shots/r6_states_${W}.png`, timeout: 60_000 }).catch((e) => console.log('  shot failed:', e.message.slice(0, 60)));
  }
  /* 连买三张 → 锁扫描 */
  for (let b = 0; b < 3; b++) {
    await page.locator('.stall-hand .hand-item .card-view').nth(0).click().catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('.drop-zone--basket').click().catch(() => {});
    await page.waitForTimeout(700);
  }
  const LOCK = await page.evaluate(() => {
    const lock = document.querySelector('.stall-hand .card-view-lock svg');
    if (!lock) return null;
    const r = lock.getBoundingClientRect();
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
  });
  console.log('  lockAfterBuys=', JSON.stringify(LOCK));
}

/* 伙伴景：选择卡 :active 量测（按压保持中 evaluate，不截图） */
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-3"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.waitForTimeout(2500);
const cbox = await page.locator('.choice-hand .card-view').first().boundingBox().catch(() => null);
if (cbox) {
  const restT = await page.evaluate(() => {
    const c = document.querySelector('.choice-hand .card-view');
    return { transform: getComputedStyle(c).transform, shadow: getComputedStyle(c).boxShadow };
  });
  await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(350);
  const act = await page.evaluate(() => {
    const c = document.querySelector('.choice-hand .card-view');
    return { transform: getComputedStyle(c).transform, shadow: getComputedStyle(c).boxShadow };
  });
  console.log('  choiceRest transform=', restT.transform, '| shadowEq=', restT.shadow === act.shadow);
  console.log('  choiceActive transform=', act.transform, '| shadow=', act.shadow.slice(0, 80), '...');
  await page.mouse.up();
} else {
  console.log('  choiceCard: not found');
}
await browser.close();
