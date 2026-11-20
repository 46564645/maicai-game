// diag2.mjs — 定位 action-primary 点击超时的真实原因
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
await page.goto('http://localhost:4173/?seed=1&fast=1&board=3d');
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'visible' });
console.log('entered game');

const p = page.locator('[data-testid="action-primary"]').first();
await p.waitFor({ state: 'visible', timeout: 20000 });
console.log('primary visible');

// 1) 试 DOM click（不走 actionability）
try {
  await p.click({ timeout: 5000 });
  console.log('normal click OK');
} catch (e) {
  console.log('CLICK ERR:', e.message.split('\n').slice(0, 14).join('\n'));
}

// 2) 点击点的元素归属
const pt = await p.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  const top = document.elementFromPoint(x, y);
  const all = document.elementsFromPoint(x, y).map(
    (n) => `${n.tagName.toLowerCase()}.${(n.className || '').toString().split(' ')[0]}`,
  );
  return {
    rect: `${r.x},${r.y} ${r.width}x${r.height}`,
    top: top ? `${top.tagName}.${(top.className || '').toString().slice(0, 40)}` : 'null',
    stack: all.slice(0, 8),
  };
});
console.log('point:', JSON.stringify(pt, null, 1));

// 3) dispatchEvent 兜底看是否真是拦截
try {
  await p.dispatchEvent('click');
  console.log('dispatchEvent click OK');
  await page.waitForTimeout(400);
  console.log(
    'after dispatch: primaries=',
    await page.locator('[data-testid="action-primary"]').count(),
  );
} catch (e) {
  console.log('dispatch err', String(e).slice(0, 200));
}
await browser.close();
