// diag5.mjs — 按钮 rect 稳定性 + DOM 点击是否推进 + 主线程占用
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

// 1) 按钮 rect 每 rAF 采一次，10 帧看是否抖动 + 帧间隔（主线程忙不忙）
const rects = await page.evaluate(
  () =>
    new Promise((res) => {
      const el = document.querySelector('[data-testid="action-primary"]');
      if (!el) return res(null);
      const out = [];
      let n = 0;
      const loop = (t) => {
        const r = el.getBoundingClientRect();
        out.push(`${t.toFixed(0)}:${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} same=${el.isConnected}`);
        if (++n < 10) requestAnimationFrame(loop);
        else res(out);
      };
      requestAnimationFrame(loop);
    }),
);
console.log('rects:', JSON.stringify(rects, null, 0));

// 2) detach 检测：同一节点 300ms 后还在不在
const stable = await page.evaluate(
  () =>
    new Promise((res) => {
      const el = document.querySelector('[data-testid="action-primary"]');
      if (!el) return res('no-el');
      const t0 = performance.now();
      const check = () => {
        if (!el.isConnected) return res(`detached@${(performance.now() - t0).toFixed(0)}ms`);
        if (performance.now() - t0 > 1500) return res('connected 1500ms');
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }),
);
console.log('stability:', stable);

// 3) DOM click 推进试验
const r = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="action-primary"]');
  if (!el) return 'no-el';
  el.click();
  return 'clicked';
});
console.log('dom click:', r);
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({
  primaries: [...document.querySelectorAll('[data-testid="action-primary"]')].map(
    (el) => `${el.className.slice(0, 50)}|${el.getBoundingClientRect().width}x${el.getBoundingClientRect().height}`,
  ),
  popup: !!document.querySelector('.popup'),
  panel: document.querySelector('[data-testid^="panel-"]')?.getAttribute('data-testid'),
}));
console.log('after dom click:', JSON.stringify(after));
await browser.close();
