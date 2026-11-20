// diag4.mjs — 抓再挂起瞬间的网络请求 + React 相关 console
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
page.on('console', (m) => {
  const t = m.text();
  if (/suspend|lazy|three|glb|warn|error/i.test(t)) console.log('CONSOLE', t.slice(0, 220));
});
page.on('request', (r) => {
  const u = r.url();
  if (!u.includes('localhost')) return;
  if (/\.(glb|hdr|js|css|png|jpg|ktx|bin)/.test(u) || u.includes('models') || u.includes('env'))
    console.log('REQ', u.replace('http://localhost:4173/', ''));
});
await page.goto('http://localhost:4173/?seed=1&fast=1&board=3d');
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'visible' });
const t0 = Date.now();
console.log('entered game @0ms');

let prev = '';
for (let i = 0; i < 60; i++) {
  const s = await page.evaluate(() => {
    const b3 = document.querySelector('.board3d');
    const b2 = document.querySelector('.board');
    return `b3=${b3 ? (getComputedStyle(b3).display === 'none' ? 'HID' : 'shown') : 'none'} b2=${b2 ? 'Y' : 'n'}`;
  });
  if (s !== prev) console.log(`@${Date.now() - t0}ms`, s);
  prev = s;
  await page.waitForTimeout(120);
}
await browser.close();
