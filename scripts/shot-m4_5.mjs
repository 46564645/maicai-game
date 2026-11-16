/**
 * shot-m4_5.mjs —— M4.5 3D 棋盘截图脚本（需 preview 已在 :4173 运行，先 npm run build）。
 * 无头 Chrome 软渲染 WebGL 需要 SwiftShader 参数（Chrome ≥128 必须
 * --enable-unsafe-swiftshader；--use-gl/--use-angle 指定 SwiftShader 后端）。
 *
 * M4.5.2 产出 screenshots/m4_5_*_{desktop,mobile}.png：
 *   board  主棋盘（全景小岛 + 8 站道具 + 4 个 Kenney 棋子就位）
 *   hop    跳站瞬间（棋子弧跳/错峰，能拍到就拍）
 *   market 演示条跳第 1 圈 ②菜市场 → 大棚特写 + 站点面板
 * M4.5.3 再加：
 *   spinner   ⑤随机事件站转盘旋转中段（相机推近中）
 *   spindone  转盘落定（结果分区在指针下）+ 相机回俯视后
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'screenshots';
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
  await page.screenshot({ path: `${OUT}/m4_5_${key}_${mode}.png` });
  console.log(`  m4_5_${key}_${mode}.png`);
}

/** 开场 → 选角色 → 进主界面，等 <canvas> 出现（3D 已就绪或正在回退） */
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
    console.log('  !! 没有 <canvas>（可能 WebGL 不可用，已回退 2D）');
    await shot(page, 'board_FALLBACK2D', mode);
    await page.close();
    return;
  }
  // 软渲染首帧较慢：等 GLB 载完 + 相机阻尼落定
  await page.waitForTimeout(3500);
  await shot(page, 'board', mode);

  // 跳第 1 圈 ②菜市场：隐藏弹窗抓跳站瞬间（棋子弧跳/落地星尘）
  await page.addStyleTag({ content: '.popup-backdrop{display:none!important}' });
  await page.locator('[data-testid="demo-station-2"]').click();
  await page.locator('[data-testid="demo-jump"]').click();
  await page.waitForTimeout(380);
  await shot(page, 'hop', mode);

  // 等相机跟到菜市场，滚轮推近：先拍「面板浮在 3D 上」，再藏弹窗拍大棚特写
  await page.waitForTimeout(2200);
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded(); // 竖屏 toast 会撑高演示条把画布挤出首屏
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, -420);
      await page.waitForTimeout(220);
    }
  }
  await page.addStyleTag({ content: '.popup-backdrop{display:block!important}' });
  await page.waitForTimeout(800);
  await shot(page, 'market', mode);
  await page.addStyleTag({ content: '.popup-backdrop{display:none!important}' });
  await page.waitForTimeout(400);
  await shot(page, 'stall', mode);

  // === ⑤ 随机事件站：3D 天气转盘 ===
  // 站点卡 ACK 后引擎立刻定好天气，3D 只演出（蓄力→转→缓停→图标弹）
  await page.locator('[data-testid="demo-station-5"]').click();
  await page.locator('[data-testid="demo-jump"]').click();
  await page.waitForTimeout(1800); // 棋子弧跳到事件站 + 站点卡出现
  await page.locator('[data-testid="action-primary"]').click(); // 进入这一站 → 开转
  await page.waitForTimeout(850); // 旋转中段：相机推近中
  await shot(page, 'spinner', mode);
  await page.waitForTimeout(3400); // 落定弹图标 + 星尘 + 相机回俯视
  await shot(page, 'spindone', mode);

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
