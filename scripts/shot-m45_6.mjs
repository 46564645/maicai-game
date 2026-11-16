/**
 * shot-m45_6.mjs —— M4.5.6 验收截图（需 preview 已在 :4173 运行，先 npm run build）。
 * 无头 Chrome 软渲染 WebGL 需要 SwiftShader 参数（同 shot-m45_5.mjs）。
 * 正式版截图一律不带 ?demo=1 显示条——演示条只在跳到菜市场时临时用，
 * 用完按 D 收起再截。
 * 产出 docs/screenshots/m45_6_*.png：
 *   desktop_board    1280×800：「轮到你了」卡在底栏上方不压字
 *   phone_board      874×402：左岛右栏 + 左上头像排 + 左下圆钮
 *   phone_turn       874×402：右竖栏「轮到你了」+ 大按钮
 *   phone_market     874×402：菜市场弹窗收进右竖栏，卡 2×3
 *   phone_wallet     874×402：钱包从右侧整条拉出
 *   portrait_rotate  402×874：竖屏「把手机横过来」循环动画提示
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/m45_6_${name}.png` });
  console.log(`  m45_6_${name}.png`);
}

async function enterGame(page) {
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click(); // 开场 → 选人
  await page.locator('[data-testid^="action-char-"]').first().click();
  // 手机横屏下游戏屏的子元素全是 fixed，容器本身高度为 0 → 用 attached 而非 visible
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
}

/** 等到真人回合（.phone-turn 出现「轮到你了」） */
async function waitMyTurn(page, scope) {
  for (let i = 0; i < 60; i++) {
    const t = await page.locator(scope).innerText().catch(() => '');
    if (t.includes('轮到你了')) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

/* —— 桌面 1280×800：不带 demo、不带触屏，正式默认画面 —— */
async function capDesktop(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1`);
  await enterGame(page);
  await page.locator('canvas').waitFor({ timeout: 15_000 }).catch(() => null);
  await page.waitForTimeout(3500); // GLB + 相机落定
  await waitMyTurn(page, '.board3d-overlay');
  await page.waitForTimeout(400);
  // 演示条必须不在
  if ((await page.locator('.demo-bar').count()) > 0)
    console.log('  !! demo-bar 意外出现在桌面截图');
  await shot(page, 'desktop_board');
  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
}

/* —— 手机横屏 874×402（iPhone 17 Pro：触屏 + 小短边）—— */
async function capPhoneLand(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 874, height: 402 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await enterGame(page);
  await page.locator('canvas').waitFor({ timeout: 15_000 }).catch(() => null);
  await page.keyboard.press('d'); // 收起演示条——正式截图不许出现
  await page.waitForTimeout(3500);
  await waitMyTurn(page, '.phone-turn');
  await page.waitForTimeout(400);
  if ((await page.locator('.demo-bar').count()) > 0)
    console.log('  !! demo-bar 没收起');
  await shot(page, 'phone_board');
  await shot(page, 'phone_turn');

  // 演示条临时打开跳 ②菜市场，跳完立刻收起再截
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-2"]').click();
  await page.locator('[data-testid="demo-jump"]').click();
  await page.keyboard.press('d');
  await page.waitForTimeout(1500);
  await page.locator('.phone-rail [data-testid="action-primary"]').click(); // 进入这一站
  await page.locator('.phone-rail .stall-grid button.card-view').first().waitFor();
  await page.waitForTimeout(800);
  await shot(page, 'phone_market');

  // 钱包：点左下圆钮 → 右侧整条抽屉展开
  await page.locator('.phone-quick [data-testid="btn-wallet"]').click();
  await page.waitForTimeout(600);
  await shot(page, 'phone_wallet');
  await page.keyboard.press('Escape');

  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
}

/* —— 手机竖屏 402×874：全屏「把手机横过来」提示 —— */
async function capPhonePortrait(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 874 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?seed=1&fast=1`);
  await page.locator('[data-testid="rotate-gate"]').waitFor();
  await page.waitForTimeout(1400); // 动画转到一半，手机斜着
  await shot(page, 'portrait_rotate');
  await ctx.close();
}

const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
try {
  console.log('== desktop 1280×800 ==');
  await capDesktop(browser);
  console.log('== phone 横屏 874×402 ==');
  await capPhoneLand(browser);
  console.log('== phone 竖屏 402×874 ==');
  await capPhonePortrait(browser);
} finally {
  await browser.close();
}
console.log('done');
