// R6 S1 探针：量市场投放区一行（买/先等等/算式/跳过）的几何与按钮内文字行数
// 用法: node shots/probe-r6-s1.mjs <w> <h> <phone|desktop> [seed]
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
await page.waitForTimeout(1200);

const out = await page.evaluate(() => {
  const lines = (el) => {
    // 只量按钮里「裸文本节点」的行数（键位片/图标是独立盒，不算）
    const ys = [];
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width > 0 && !ys.some((y) => Math.abs(y - r.top) < 4)) ys.push(r.top);
      }
    }
    return ys.length;
  };
  const row = document.querySelector('.drop-row');
  const kids = [...row.children].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      cls: el.className.split(' ')[0] + (el.className.includes('basket') ? '--basket' : el.className.includes('hold') ? '--hold' : ''),
      text: el.textContent.trim().replace(/\s+/g, ' '),
      w: Math.round(r.width),
      h: Math.round(r.height),
      textLines: lines(el),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    };
  });
  const rr = row.getBoundingClientRect();
  return { rowW: Math.round(rr.width), kids };
});
console.log(`S1 ${W}x${H} ${PHONE ? 'phone' : 'desktop'} seed=${SEED} rowW=${out.rowW}`);
for (const k of out.kids) console.log('  ', JSON.stringify(k));
await browser.close();
