/**
 * shot-m45_5.mjs —— M4.5.5 五条验收截图（需 preview 已在 :4173 运行，先 npm run build）。
 * 无头 Chrome 软渲染 WebGL 需要 SwiftShader 参数（同 shot-m4_5.mjs）。
 * 产出 docs/screenshots/m45_5_*_{desktop,mobile}.png：
 *   board    ①+② 页面背景奶油→浅蓝渐变 + 3D 占满整屏（2D 件浮在上面）
 *   market   ② 菜市场弹窗浮在全屏 3D 上
 *   toast    ③ 顶部提示条一次只有一条
 *   endturn  ⑤ 买完一张卡后，主高亮跳到「走完这一站」
 *   （④ colormap.png 入库由文件存在 + dist 校验，模型贴图在截图里可见）
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';
const MODES = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, key, mode) {
  await page.screenshot({ path: `${OUT}/m45_5_${key}_${mode}.png` });
  console.log(`  m45_5_${key}_${mode}.png`);
}

async function enterGame(page) {
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor();
}

async function capture(browser, mode, vp) {
  const page = await browser.newPage({ viewport: vp });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enterGame(page);
  const hasCanvas = await page
    .locator('canvas')
    .waitFor({ timeout: 12_000 })
    .then(() => true)
    .catch(() => false);
  if (!hasCanvas) {
    console.log('  !! 没有 <canvas>（WebGL 不可用，已回退 2D）');
    await shot(page, 'board_FALLBACK2D', mode);
    await page.close();
    return;
  }
  await page.waitForTimeout(3500); // GLB 载完 + 相机落定
  await shot(page, 'board', mode);

  // 演示条跳第 1 圈 ②菜市场 → 进入这一站 → 弹窗浮在全屏 3D 上
  await page.locator('[data-testid="demo-station-2"]').click();
  await page.locator('[data-testid="demo-jump"]').click();
  await page.waitForTimeout(2000);
  await page.locator('[data-testid="action-primary"]').click(); // 进入这一站
  await page.locator('.stall-grid button.card-view').first().waitFor();
  await page.waitForTimeout(800);
  await shot(page, 'market', mode);

  // 点一张便宜的卡 → 买下 → 「走完这一站」变主高亮
  await page.locator('.stall-grid button.card-view').nth(2).click(); // 选一张卡
  await page.locator('[data-testid="action-primary"]').click(); // 买下
  await page.waitForTimeout(1200);
  const endBtn = page.locator('[data-primary="true"]');
  const label = (await endBtn.innerText()).replace(/\s+/g, '');
  console.log(`  data-primary 现在是：${label}`);
  await shot(page, 'endturn', mode);

  // 顶部提示条：此刻只有一条（最近一条日志）
  const toastCount = await page.locator('.toast-stack .toast').count();
  console.log(`  toast 条数：${toastCount}`);
  await shot(page, 'toast', mode);

  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await page.close();
}

const only = process.argv[2]; // 可选：desktop / mobile
const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
try {
  for (const [mode, vp] of Object.entries(MODES)) {
    if (only && mode !== only) continue;
    console.log(`== ${mode} ==`);
    await capture(browser, mode, vp);
  }
} finally {
  await browser.close();
}
console.log('done');
