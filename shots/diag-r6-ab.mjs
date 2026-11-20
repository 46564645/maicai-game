import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30_000 });
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(2000);
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) await page.keyboard.press('d');
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
await page.addStyleTag({ content: '*{animation:none !important;transition:none !important}' });
await page.waitForTimeout(600);

const SAMPLE = (b64) => {
  const img = new Image();
  return new Promise((res, rej) => {
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const dpr = img.naturalWidth / window.innerWidth;
      const lum = (r, gg, bl) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(bl); };
      const out = [];
      for (const nameEl of document.querySelectorAll('.stall-hand .card-view-name')) {
        if (nameEl.getClientRects().length === 0) continue;
        const r = nameEl.getBoundingClientRect();
        const x0 = Math.max(0, Math.floor(r.left * dpr)), y0 = Math.max(0, Math.floor(r.top * dpr));
        const x1 = Math.min(cv.width, Math.ceil(r.right * dpr)), y1 = Math.min(cv.height, Math.ceil(r.bottom * dpr));
        if (x1 <= x0 || y1 <= y0) continue;
        const data = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const buckets = new Map(); const px = [];
        for (let i = 0; i < data.length; i += 4) { const R = data[i], G = data[i + 1], B = data[i + 2]; const k = `${R >> 4},${G >> 4},${B >> 4}`; buckets.set(k, (buckets.get(k) ?? 0) + 1); px.push([R, G, B, lum(R, G, B)]); }
        let bestK = '', bestN = -1; for (const [k, n] of buckets) if (n > bestN) { bestN = n; bestK = k; }
        const [br, bgc, bb] = bestK.split(',').map((v) => Number(v) * 16 + 8);
        const bgL = lum(br, bgc, bb);
        px.sort((a, b2) => a[3] - b2[3]);
        const dark = px.slice(0, Math.max(8, Math.floor(px.length * 0.02)));
        const fr = dark.reduce((s, p) => s + p[0], 0) / dark.length, fg = dark.reduce((s, p) => s + p[1], 0) / dark.length, fb = dark.reduce((s, p) => s + p[2], 0) / dark.length;
        const fgL = lum(fr, fg, fb);
        out.push({ name: nameEl.textContent, c: Math.round(((Math.max(bgL, fgL) + 0.05) / (Math.min(bgL, fgL) + 0.05)) * 100) / 100, fg: [Math.round(fr), Math.round(fg), Math.round(fb)].join(',') });
      }
      res(out);
    };
    img.onerror = rej;
    img.src = 'data:image/png;base64,' + b64;
  });
};

async function snap(tag) {
  const path = `shots/diag_ab_${tag}.png`;
  await page.screenshot({ path, timeout: 90_000 });
  console.log(tag, JSON.stringify(await page.evaluate(SAMPLE, readFileSync(path).toString('base64'))));
}

await snap('base');
await page.addStyleTag({ content: '.stall-hand .hand-item{transform:none !important}' });
await page.waitForTimeout(400);
await snap('notransform');
await page.addStyleTag({ content: '.tc-glare{display:none !important}.pglow-sweep{display:none !important}.tc-foil{display:none !important}' });
await page.waitForTimeout(400);
await snap('nooverlays');
await browser.close();
