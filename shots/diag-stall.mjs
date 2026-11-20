// diag-stall.mjs — 复现 board3d e2e 卡死：逐步 stepOnce，dump action-primary 可见性
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE-ERR', m.text().slice(0, 200));
});
await page.goto('http://localhost:4173/?seed=1&fast=1&board=3d');
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'visible' });
console.log('entered game');
try {
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 25000 });
  console.log('canvas visible');
} catch {
  console.log('canvas NOT visible in 25s');
}

for (let i = 0; i < 12; i++) {
  const info = await page.evaluate(() => {
    const primaries = [...document.querySelectorAll('[data-testid="action-primary"]')];
    const out = primaries.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const chain = [];
      let p = el.parentElement;
      while (p && chain.length < 5) {
        const pcs = getComputedStyle(p);
        chain.push(
          `${p.tagName.toLowerCase()}.${(p.className || '').toString().split(' ')[0]}[disp=${pcs.display}]`,
        );
        p = p.parentElement;
      }
      return {
        cls: el.className.slice(0, 60),
        rect: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        vis: cs.visibility,
        disp: cs.display,
        disabled: el.disabled,
        chain: chain.join(' < '),
      };
    });
    const veils = [...document.querySelectorAll('.spotlight-veil,.weather-moment,.popup-backdrop,.moment-card')]
      .map((el) => el.className.slice(0, 50));
    return { primaries: out, veils, sub: document.querySelector('[data-testid="weather-moment"]') ? 'weather-moment' : '' };
  });
  console.log(`step ${i}:`, JSON.stringify(info, null, 0).slice(0, 900));
  const primary = page.locator('[data-testid="action-primary"]:not([disabled])').first();
  if ((await primary.count()) > 0) {
    try {
      await primary.click({ timeout: 3000 });
      console.log(`  clicked primary`);
      continue;
    } catch (e) {
      console.log(`  CLICK BLOCKED: ${String(e).split('\n')[0]}`);
    }
  }
  const keyed = await page.evaluateHandle(() => {
    const els = [...document.querySelectorAll('[data-key]:not([disabled])')]
      .filter((el) => el.getClientRects().length > 0);
    if (!els.length) return null;
    return els.reduce((a, b) => (Number(b.dataset.key) > Number(a.dataset.key) ? b : a));
  });
  const el = keyed.asElement();
  if (el) {
    try {
      await el.click({ timeout: 3000 });
      console.log(`  clicked keyed`);
      continue;
    } catch {
      console.log(`  keyed click blocked`);
    }
  }
  await page.waitForTimeout(400);
}
await page.screenshot({ path: 'shots/diag-stall.png' });
await browser.close();
console.log('done');
