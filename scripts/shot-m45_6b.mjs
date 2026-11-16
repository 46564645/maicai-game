/**
 * shot-m45_6b.mjs —— M4.5.6b 验收截图（需 preview 已在 :4173 运行，先 npm run build）。
 * 用法：node scripts/shot-m45_6b.mjs [prefix]   默认前缀 m45_6b_
 * 覆盖 m45_6_extra.txt 第 4–9 条 + 天气转盘补测：
 *   char_phone    874×402 触屏横屏：4 个角色一行全显示（第 6/9 条）
 *   board_phone   874×402：左岛右栏、无键盘提示（第 4 条）
 *   market_phone  874×402：菜市场 6 卡 2×3 完整可见不被按钮盖（第 5 条）
 *   store_phone   874×402：小卖部先选再买下 + 「走完这一站」主按钮（第 7/8 条）
 *   store_phone_sel  874×402：点卡后抬起+橙框、「买下（N 币）」（第 8 条）
 *   safe_phone    874×402 + 模拟安全区（左/右 62px、上下 20px）布局依然完整（第 2 条）
 *   store_desktop / market_desktop  1280×800：两店按钮位置样式统一（第 8 条）
 *   spinner_desktop_* / spinner_phone_*  转盘转动 + 相机推近补测
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';
const PREFIX = process.argv[2] ?? 'm45_6b_';
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${PREFIX}${name}.png` });
  console.log(`  ${PREFIX}${name}.png`);
}

async function enterGame(page) {
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click(); // 开场 → 选人
}

async function pickChar(page) {
  await page.locator('[data-testid^="action-char-"]').first().waitFor();
}

async function enterChar(page) {
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 15_000 }).catch(() => null);
}

/** 演示条跳站（站号 1..8）：发 DEMO_JUMP 后循环——
 *  目标面板出现就收工；若轮到真人进站（无弹窗但有 action-primary）先点进站；
 *  其余时间等 bot 自动推进。chips 可能被右竖栏盖住 → dispatchEvent。 */
async function jumpStation(page, station, panelTestid, timeout = 30_000) {
  await page.keyboard.press('d');
  await page.locator(`[data-testid="demo-station-${station}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  const panel = page.locator(`[data-testid="${panelTestid}"]`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await panel.count()) > 0) return;
    const enter = page.locator('[data-testid="action-primary"]').first();
    const hasPopup = (await page.locator('.popup').count()) > 0;
    if (!hasPopup && (await enter.count()) > 0) await enter.click();
    await page.waitForTimeout(300);
  }
  throw new Error(`jumpStation ${station}：等不到 ${panelTestid}`);
}

/** 等到真人回合出现目标面板（bot 回合自动推进，靠轮询） */
async function waitPanel(page, testid, ms = 30_000) {
  await page.locator(`[data-testid="${testid}"]`).waitFor({ timeout: ms });
}

/* —— 手机横屏 874×402（iPhone 17 Pro：触屏 + 小短边）—— */
async function capPhone(browser) {
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
  await page.keyboard.press('d'); // 先收演示条，正式画面干净
  await pickChar(page);
  await page.waitForTimeout(400);
  await shot(page, 'char_phone'); // 第 6/9 条：4 个角色一行
  await enterChar(page);
  await page.waitForTimeout(3500);
  await shot(page, 'board_phone'); // 第 4 条：左岛右栏 + 无键盘提示

  // 第 5 条：菜市场 6 卡在右栏 2×3
  await jumpStation(page, 2, 'panel-market');
  await page.waitForTimeout(600);
  await shot(page, 'market_phone');

  // 第 7/8 条：小卖部先选再买下
  await jumpStation(page, 7, 'panel-store');
  await page.waitForTimeout(600);
  await shot(page, 'store_phone');
  // 点「菜谱还差」里第一张可买的卡 → 抬起+橙框 + 「买下（N 币）」
  const card = page
    .locator('.phone-rail .store-section:first-of-type [data-testid^="action-store-"]:not(:disabled)')
    .first();
  if ((await card.count()) > 0) {
    await card.dispatchEvent('click');
    await page.waitForTimeout(400);
    await shot(page, 'store_phone_sel');
  }

  // 第 2 条：模拟安全区（灵动岛/圆角/地址栏 ≈ 左右 62、上下 20）布局仍完整
  await page.addStyleTag({
    content: `:root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}`,
  });
  await page.waitForTimeout(300);
  await shot(page, 'safe_phone');
  await page.evaluate(() => {
    // 检查关键件是否在可视区内
    const names = ['.phone-bots', '.phone-quick', '.phone-rail'];
    for (const s of names) {
      const el = document.querySelector(s);
      if (el) {
        const r = el.getBoundingClientRect();
        console.log(
          `  ${s}: left=${Math.round(r.left)} right=${Math.round(r.right)} top=${Math.round(r.top)} bottom=${Math.round(r.bottom)}`,
        );
      }
    }
  });

  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
}

/* —— 桌面 1280×800：两店按钮位置样式统一 —— */
async function capDesktop(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await enterGame(page);
  await enterChar(page);
  await page.keyboard.press('d');
  await page.waitForTimeout(3500);

  await jumpStation(page, 2, 'panel-market');
  await page.waitForTimeout(600);
  await shot(page, 'market_desktop');

  await jumpStation(page, 7, 'panel-store');
  await page.waitForTimeout(600);
  await shot(page, 'store_desktop');
  const card = page
    .locator('.popup .store-section:first-of-type [data-testid^="action-store-"]:not(:disabled)')
    .first();
  if ((await card.count()) > 0) {
    await card.click();
    await page.waitForTimeout(400);
    await shot(page, 'store_desktop_sel');
  }
  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
}

/* —— 天气转盘：跳到 ⑤随机事件站 → 进站 → 转盘转 + 相机推近的连拍 —— */
async function capSpinner(browser, mode) {
  const isPhone = mode === 'phone';
  const ctx = await browser.newContext(
    isPhone
      ? { viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true }
      : { viewport: { width: 1280, height: 800 } },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await enterGame(page);
  await enterChar(page);
  await page.keyboard.press('d');
  await page.waitForTimeout(3500);

  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-5"]').dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  // 轮到自己才点进站；是 bot 先行就等 bot 自动进
  const enter = page.locator('[data-testid="action-primary"]').first();
  const t0 = Date.now();
  let clicked = false;
  while (Date.now() - t0 < 5000) {
    if ((await enter.count()) > 0) {
      await enter.click();
      clicked = true;
      break;
    }
    if ((await page.locator('canvas').count()) === 0) break;
    await page.waitForTimeout(150);
    if ((await page.locator('[data-testid="action-primary"]').count()) === 0 && Date.now() - t0 > 1200)
      break;
  }
  void clicked;
  // 转盘：蓄力 0.16s + 主旋 1.05s + 落定 0.6s；连拍抓转动与推近
  for (const [i, ms] of [300, 500, 500, 500].entries()) {
    await page.waitForTimeout(ms);
    await shot(page, `spinner_${mode}_${i}`);
  }
  await page.waitForTimeout(1200);
  await shot(page, `spinner_${mode}_done`);
  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
}

const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
try {
  console.log('== phone 横屏 874×402 ==');
  await capPhone(browser);
  console.log('== desktop 1280×800 ==');
  await capDesktop(browser);
  console.log('== spinner desktop ==');
  await capSpinner(browser, 'desktop');
  console.log('== spinner phone ==');
  await capSpinner(browser, 'phone');
} finally {
  await browser.close();
}
console.log('done');
