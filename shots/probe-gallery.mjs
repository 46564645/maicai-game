/** probe-gallery.mjs — T-1 卡面画廊截图：逐卡 PNG（DSF 3 = 324×432）+
 * 美术区/文字区占比量测。前置：vite dev 在 4174 跑着 gallery.html。
 * 输出：shots/cards-gallery/<card-id>.png + split 数据（stdout）。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cards-gallery');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', String(e)));
await page.goto('http://localhost:4174/gallery.html');
await page.locator('[data-card-cell]').first().waitFor({ timeout: 30_000 });
await page.waitForTimeout(2500); // 等图片解码

const cells = await page.locator('[data-card-cell]').all();
console.log('cells:', cells.length);
const splits = [];
for (const cell of cells) {
  const id = await cell.getAttribute('data-card-cell');
  const card = cell.locator('.card-view').first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(60);
  await card.screenshot({ path: path.join(OUT, `${id}.png`) });
  const s = await card.evaluate((el) => {
    const art = el.querySelector('.card-view-art');
    const text = el.querySelector('.card-view-text');
    const h = el.getBoundingClientRect().height;
    return {
      cardH: +h.toFixed(1),
      artH: art ? +art.getBoundingClientRect().height.toFixed(1) : null,
      textH: text ? +text.getBoundingClientRect().height.toFixed(1) : null,
      nameLines: null,
    };
  });
  splits.push({ id, ...s, artPct: s.artH != null ? Math.round((s.artH / s.cardH) * 100) : null });
}
for (const s of splits) console.log(`  ${s.id}: card ${s.cardW ?? ''}${s.cardH} art ${s.artH} (${s.artPct}%) text ${s.textH}`);
const withArt = splits.filter((s) => s.artPct != null);
const min = Math.min(...withArt.map((s) => s.artPct));
const max = Math.max(...withArt.map((s) => s.artPct));
console.log(`art share range: ${min}%..${max}% over ${withArt.length} cards`);
await browser.close();
console.log('done ->', OUT);
