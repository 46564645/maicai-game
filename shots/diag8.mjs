// diag8.mjs — 复现 keyboard 钱包 Esc 不关：开抽屉→按 Esc→看层栈/DOM
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE-ERR', m.text().slice(0, 200));
});
// 捕获 keydown 监听链：在 Escape 时看谁拦了
await page.addInitScript(() => {
  window.__escLog = [];
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') window.__escLog.push('window-bubble saw Esc');
    },
    false,
  );
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') window.__escLog.push('window-capture saw Esc');
    },
    true,
  );
});
await page.goto('http://localhost:4173/?seed=1&fast=1&demo=1');
await page.locator('[data-primary="true"]').waitFor();
await page.keyboard.press('Enter');
await page.locator('[data-testid="screen-characters"]').waitFor();
await page.keyboard.press('1');
await page.locator('[data-testid="screen-game"]').waitFor();
await page.keyboard.press('w');
await page.locator('[data-testid="drawer-wallet"]').waitFor();
console.log('wallet open');
await page.keyboard.press('Tab');
await page.waitForTimeout(200);
const focus1 = await page.evaluate(
  () => document.querySelector('[data-testid="drawer-wallet"]')?.contains(document.activeElement),
);
console.log('focus in drawer:', focus1);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const st = await page.evaluate(() => ({
  drawer: document.querySelectorAll('[data-testid="drawer-wallet"]').length,
  popupShell: [...document.querySelectorAll('.popup-shell')].map((e) => e.className),
  escLog: window.__escLog,
  active: document.activeElement?.tagName + '.' + (document.activeElement?.className || '').toString().slice(0, 40),
}));
console.log('after Esc:', JSON.stringify(st, null, 1));
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
console.log(
  'after Esc2:',
  await page.evaluate(() => document.querySelectorAll('[data-testid="drawer-wallet"]').length),
);
await browser.close();
