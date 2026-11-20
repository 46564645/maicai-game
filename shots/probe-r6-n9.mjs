// R6 N9 量测+截图：事件景——天气卡（名字对比度，像素法）+ 故事卡
//（长名 Grandma shares greens / Wet clothes 的词界换行验证 + 截图）；
// 市场景找 Marshmallow 长名卡
// 用法: node shots/probe-r6-n9.mjs event <w> <h> <phone|desktop> <seed>
//       node shots/probe-r6-n9.mjs stall <w> <h> <phone|desktop> <seed>
import { chromium } from '@playwright/test';

const MODE = process.argv[2];
const W = Number(process.argv[3]);
const H = Number(process.argv[4]);
const PHONE = process.argv[5] === 'phone';
const SEED = Number(process.argv[6] ?? 1);
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: PHONE, isMobile: PHONE });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); localStorage.setItem('maicai-icons-seen', '1'); } catch {} });
const page = await ctx.newPage();
await page.goto(`http://localhost:4173/?board=3d&seed=${SEED}&fast=1&demo=1`, { waitUntil: 'load', timeout: 30_000 });
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

const CONTRAST_FN = () => {
  /* 与市场景同一像素法：名字元素包围盒内，背景取众数色、前景取最暗簇 */
  window.__contrastOf = async (el) => {
    const r = el.getBoundingClientRect();
    const shot = await el.screenshot().catch(() => null);
    return null; // 占位（下方用整页截图裁剪法）
  };
};

if (MODE === 'stall') {
  await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1000);
  const names = await page.evaluate(() => [...document.querySelectorAll('.stall-hand .card-view-name')].map((n) => {
    const cs = getComputedStyle(n);
    return { name: n.textContent.trim(), fontPx: parseFloat(cs.fontSize), lines: Math.round(n.getBoundingClientRect().height / parseFloat(cs.lineHeight || 20)), clipped: n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1 };
  }));
  console.log(`STALL ${W}x${H} seed=${SEED}`, JSON.stringify(names));
  if (names.some((n) => n.name === 'Marshmallow')) {
    await page.screenshot({ path: `shots/r6_longname_${W}.png`, timeout: 120_000 });
    console.log('  marshmallow shot saved');
  }
} else {
  await page.locator('[data-testid="demo-station-5"]').dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  /* 事件站要先点「Go to this stop」进站（其余站跳转直达） */
  await page.locator('[data-testid="action-primary"]').first().click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  /* 天气时刻：等转盘结束出现天气卡 */
  await page.locator('[data-testid="weather-card"]').waitFor({ timeout: 40_000 }).catch(() => {});
  await page.waitForTimeout(800);
  const weather = await page.evaluate(() => {
    const name = document.querySelector('[data-testid="weather-card"] .card-view-name');
    if (!name) return null;
    const cs = getComputedStyle(name);
    return { name: name.textContent.trim(), fontPx: parseFloat(cs.fontSize), clipped: name.scrollWidth > name.clientWidth + 1 };
  });
  console.log(`EVENT ${W}x${H} seed=${SEED} weather=`, JSON.stringify(weather));
  /* 天气大卡名字对比度（像素法，与市场景同口径） */
  await page.screenshot({ path: `shots/r6_event_moment_${W}.png`, timeout: 120_000 }).catch(() => {});
  const sampleNames = async (shotPath, sels) => {
    const { readFileSync } = await import('node:fs');
    let b64;
    try { b64 = readFileSync(shotPath).toString('base64'); } catch { return null; }
    return page.evaluate(async ({ b64, sels }) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const dpr = img.naturalWidth / window.innerWidth;
      const lum = (r, gg, b) => {
        const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
      };
      const out = [];
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) { out.push({ sel, missing: true }); continue; }
        const r = el.getBoundingClientRect();
        const x0 = Math.max(0, Math.floor(r.left * dpr)), y0 = Math.max(0, Math.floor(r.top * dpr));
        const x1 = Math.min(cv.width, Math.ceil(r.right * dpr)), y1 = Math.min(cv.height, Math.ceil(r.bottom * dpr));
        const data = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const buckets = new Map(); const px = [];
        for (let i = 0; i < data.length; i += 4) {
          const R = data[i], G = data[i + 1], B = data[i + 2];
          const k = `${R >> 4},${G >> 4},${B >> 4}`;
          buckets.set(k, (buckets.get(k) ?? 0) + 1);
          px.push([R, G, B, lum(R, G, B)]);
        }
        let bestK = '', bestN = -1;
        for (const [k, n] of buckets) if (n > bestN) { bestN = n; bestK = k; }
        const [br, bgc, bb] = bestK.split(',').map((v) => Number(v) * 16 + 8);
        const bgL = lum(br, bgc, bb);
        px.sort((a, b) => a[3] - b[3]);
        const dark = px.slice(0, Math.max(8, Math.floor(px.length * 0.02)));
        const fr = dark.reduce((s, p) => s + p[0], 0) / dark.length;
        const fg = dark.reduce((s, p) => s + p[1], 0) / dark.length;
        const fb = dark.reduce((s, p) => s + p[2], 0) / dark.length;
        const fgL = lum(fr, fg, fb);
        const hi = Math.max(bgL, fgL), lo = Math.min(bgL, fgL);
        out.push({ sel, name: el.textContent.trim(), contrast: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100 });
      }
      return out;
    }, { b64, sels });
  };
  console.log('  momentNameContrast=', JSON.stringify(await sampleNames(`shots/r6_event_moment_${W}.png`, ['[data-testid="weather-card"] .card-view-name'])));
  /* 点掉天气卡 → 翻事件牌 → 故事卡 */
  await page.locator('[data-testid="weather-card"]').click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.locator('.deck-top, [data-testid="panel-event"] [data-testid="action-primary"]').first().dispatchEvent('click').catch(() => {});
  await page.waitForTimeout(2500);
  if ((await page.locator('.event-story .card-view-name').count()) === 0) {
    const dbg = await page.evaluate(() => ({
      popup: document.querySelector('.popup')?.getAttribute('data-testid'),
      text: document.querySelector('.popup')?.textContent?.trim()?.replace(/\s+/g, ' ').slice(0, 140),
      storyEl: !!document.querySelector('.event-story'),
    }));
    console.log('  story-missing debug=', JSON.stringify(dbg));
  }
  const story = await page.evaluate(() => {
    const name = document.querySelector('.event-story .card-view-name');
    const text = document.querySelector('.event-story-text');
    if (!name) return null;
    const cs = getComputedStyle(name);
    return {
      name: name.textContent.trim(),
      fontPx: parseFloat(cs.fontSize),
      nameH: Math.round(name.getBoundingClientRect().height),
      lineH: parseFloat(cs.lineHeight || 20),
      clipped: name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1,
      storyText: text?.textContent?.trim()?.slice(0, 60),
    };
  });
  console.log('  story=', JSON.stringify(story));
  if (story) {
    const lines = Math.round(story.nameH / story.lineH);
    console.log('  storyNameLines=', lines);
    await page.screenshot({ path: `shots/r6_event_${W}.png`, timeout: 120_000, animations: 'disabled' });
    console.log('  event shot saved');
    console.log('  storyNameContrast=', JSON.stringify(await sampleNames(`shots/r6_event_${W}.png`, ['.event-story .card-view-name', '.event-weather .card-view-name'])));
  }
}
await browser.close();
