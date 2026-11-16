// Interaction acceptance probe for the merged R5 build.
// Run solo (parallel SwiftShader instances trip the 2D fallback).
// Usage: node shots/interact-probe.mjs [port]  (default 4173)
import { chromium } from 'playwright';
const port = process.argv[2] || '4173';
const base = `http://localhost:${port}`;

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

async function measure(stage) {
  const r = {};
  r.buttons = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('button, [role="button"], a, [data-testid^="action-char-"]')) {
      const rect = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      if (rect.width === 0 || rect.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      out.push({ label: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(rect.width), h: Math.round(rect.height) });
    }
    return out;
  });
  r.below48 = r.buttons.filter((b) => b.h < 48 || b.w < 48);
  const primary = await page.$('button[data-primary="true"], button.btn--primary, button.primary');
  if (primary) {
    const before = await primary.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { transform: cs.transform, background: cs.backgroundColor, opacity: cs.opacity };
    });
    await primary.hover();
    await page.mouse.down();
    await page.waitForTimeout(120);
    const during = await primary.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { transform: cs.transform, background: cs.backgroundColor, opacity: cs.opacity };
    });
    await page.mouse.up();
    r.pressFeedback = { changed: JSON.stringify(before) !== JSON.stringify(during), before, during };
  } else r.pressFeedback = { error: 'no primary button' };
  r.maxDeclaredMs = await page.evaluate(() => {
    let maxMs = 0;
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      for (const v of [cs.transitionDuration, cs.animationDuration]) {
        for (const part of v.split(',')) {
          const s = part.trim();
          if (s.endsWith('ms')) maxMs = Math.max(maxMs, parseFloat(s));
          else if (s.endsWith('s')) maxMs = Math.max(maxMs, parseFloat(s) * 1000);
        }
      }
    }
    return maxMs;
  });
  r.canvasPresent = await page.evaluate(() => !!document.querySelector('canvas'));
  r.bodyStart = await page.evaluate(() => document.body.innerText.slice(0, 120));
  console.log(`--- ${stage} ---`);
  console.log(JSON.stringify(r, null, 1));
  return r;
}

await measure('character-screen');

// Click through to the board: Start (Intro) -> pick first character.
// (The press-feedback probe above may already have clicked Start via mousedown+mouseup.)
const start = await page.$('[data-testid="action-primary"]');
if (start) {
  await start.click();
  await page.waitForTimeout(1500);
}
const char = await page.$('[data-testid^="action-char-"]');
if (char) {
  await char.click();
  await page.waitForTimeout(8000); // let 3D mount + converge (SwiftShader slow)
  await measure('board-screen');
} else console.log('no character card found');

console.log('PAGEERRORS:', JSON.stringify(errors));
await browser.close();
