// R6 S2 探针：874 手机右栏文案——逐张选中摊卡，量选中块两行与导引行
// 的实际折行（文本节点 Range 行数）与栏宽
// 用法: node shots/probe-r6-s2.mjs [seed]
import { chromium } from 'playwright';

const SEED = Number(process.argv[2] ?? 1);
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({
  viewport: { width: 874, height: 402 },
  hasTouch: true,
  isMobile: true,
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
await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(() => {});
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

const measure = () =>
  page.evaluate(() => {
    const textLines = (el) => {
      const ys = [];
      const walk = (node) => {
        for (const ch of node.childNodes) {
          if (ch.nodeType === Node.TEXT_NODE && ch.textContent.trim()) {
            const range = document.createRange();
            range.selectNodeContents(ch);
            for (const r of range.getClientRects()) {
              if (r.width > 0 && !ys.some((y) => Math.abs(y - r.top) < 4)) ys.push(r.top);
            }
          } else if (ch.nodeType === Node.ELEMENT_NODE) walk(ch);
        }
      };
      walk(el);
      return ys.length;
    };
    const rail = document.querySelector('.phone-rail') ?? document.querySelector('.panel-market') ?? document.querySelector('[data-testid="panel-market"]');
    const lines = [...document.querySelectorAll('.panel-selected-line')].map((el) => ({
      text: el.textContent.trim().replace(/\s+/g, ' '),
      lines: textLines(el),
      w: Math.round(el.getBoundingClientRect().width),
    }));
    const guide = document.querySelector('.stall-guide-text');
    return {
      railW: rail ? Math.round(rail.getBoundingClientRect().width) : -1,
      lines,
      guide: guide ? { text: guide.textContent.trim(), lines: textLines(guide) } : null,
    };
  });

const cards = page.locator('.stall-hand .hand-item .card-view');
const n = await cards.count();
console.log(`S2 874 seed=${SEED} stallCards=${n}`);
for (let i = 0; i < n; i++) {
  await cards.nth(i).click().catch(() => {});
  await page.waitForTimeout(500);
  const m = await measure();
  console.log(`  [${i}] railW=${m.railW} sel=${JSON.stringify(m.lines)} guide=${JSON.stringify(m.guide)}`);
}
await page.screenshot({ path: 'shots/r6_s2_874.png', timeout: 90_000 });
await browser.close();
