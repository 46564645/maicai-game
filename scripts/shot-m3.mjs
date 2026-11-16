/**
 * shot-m3.mjs —— M3.4 截图脚本（需 preview 已在 :4173 运行，先 npm run build）。
 * 产出 screenshots/m3_<屏>_<desktop|mobile>.png：
 *   intro 开场 / characters 选角色 / board 主棋盘轮到你 / market 菜市场弹窗
 *   wallet 钱包抽屉 / parent AI 家长站 / proposal 伙伴站提议气泡（seed=25 固定轨迹）
 *   feast 开饭 G6 / ledger 看看钱花到哪了 / reflection 最满意的决定
 *   debt 待付夹非空（?demo=1 → 演示条「花光零钱」→ 公交待付夹）+ debt_bus 公交面板
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'screenshots';
const MODES = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, key, mode) {
  await page.waitForTimeout(250); // 等弹入动画/布局稳定
  await page.screenshot({ path: `${OUT}/m3_${key}_${mode}.png` });
  console.log(`  m3_${key}_${mode}.png`);
}

/** 通用推进一步：action-primary 优先，否则最大 data-key，没有就等 bot */
async function stepOnce(page) {
  const pri = page.locator('[data-testid="action-primary"]:not([disabled])').first();
  if ((await pri.count()) > 0) {
    await pri.click();
    return;
  }
  const el = await page.evaluateHandle(() => {
    const els = [...document.querySelectorAll('[data-key]:not([disabled])')];
    return els.sort((a, b) => Number(b.dataset.key) - Number(a.dataset.key))[0] ?? null;
  });
  const handle = el.asElement();
  if (handle) await handle.click();
  else await page.waitForTimeout(150);
}

async function startGame(page, url, charTestid) {
  await page.goto(url);
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator(`[data-testid="${charTestid}"]`).click();
  await page.locator('[data-testid="screen-game"]').waitFor();
}

/** 场次 A：seed=1 正常对局 —— intro/characters/board/market/wallet/parent/feast/ledger/reflection */
async function captureMain(browser, mode, vp) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto(`${BASE}/?seed=1&fast=1`);
  await page.locator('[data-primary="true"]').waitFor();
  await shot(page, 'intro', mode);
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid="screen-characters"]').waitFor();
  await shot(page, 'characters', mode);
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor();
  await shot(page, 'board', mode);

  // 轮到你 intro（无站点弹窗）时开钱包抽屉拍 wallet
  await page.locator('[data-testid="btn-wallet"]').click();
  await page.locator('[data-testid="drawer-wallet"]').waitFor();
  await shot(page, 'wallet', mode);
  await page.keyboard.press('Escape');
  await page.locator('[data-testid="drawer-wallet"]').waitFor({ state: 'detached' });

  const seen = new Set(['intro', 'characters', 'board', 'wallet']);
  for (let i = 0; i < 400 && (await page.getByTestId('action-replay').count()) === 0; i++) {
    if (!seen.has('market') && (await page.getByTestId('panel-market').count()) > 0) {
      seen.add('market');
      await shot(page, 'market', mode);
      continue;
    }
    if (!seen.has('parent') && (await page.locator('.parent-options').count()) > 0) {
      seen.add('parent');
      await shot(page, 'parent', mode);
      continue;
    }
    if (
      !seen.has('feast') &&
      (await page.locator('[data-testid^="plate-"]').count()) === 4
    ) {
      seen.add('feast');
      await shot(page, 'feast', mode);
      continue;
    }
    if (!seen.has('ledger') && (await page.getByTestId('ledger').count()) > 0) {
      seen.add('ledger');
      await shot(page, 'ledger', mode);
      continue;
    }
    if (
      !seen.has('reflection') &&
      (await page.getByTestId('action-reflect-rho-6').count()) > 0
    ) {
      seen.add('reflection');
      await shot(page, 'reflection', mode);
      continue;
    }
    await stepOnce(page);
  }
  console.log(`  seen: ${[...seen].join(',')}`);
  await page.close();
}

/** 市场买入：复现 sim 策略 —— 每次买 DOM 序第一张非「菜谱里有」卡，最多 2 次 */
async function marketBuyExtras(page) {
  for (let b = 0; b < 2; b++) {
    const pri = page.locator('[data-testid="action-primary"]:not([disabled])');
    if ((await pri.count()) === 0) break;
    const pickSel = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[data-testid^="action-stall-"]')];
      const extra = els.find(
        (e) => e.querySelector('.card-view-tag')?.textContent !== '食材 · 菜谱里有',
      );
      return (extra ?? els[0])?.getAttribute('data-testid') ?? null;
    });
    if (!pickSel) break;
    await page.locator(`[data-testid="${pickSel}"]`).first().click();
    await page
      .locator('[data-testid="action-primary"]:not([disabled])')
      .waitFor({ timeout: 2000 })
      .catch(() => {});
    if ((await page.locator('[data-testid="action-primary"]:not([disabled])').count()) === 0) break;
    await page.locator('[data-testid="action-primary"]').click();
    await page.waitForTimeout(120); // 等 selected 重置 / 摊位补牌
  }
  // 走完这一站（最大 data-key）
  const el = await page.evaluateHandle(() => {
    const els = [...document.querySelectorAll('[data-key]:not([disabled])')];
    return els.sort((a, b) => Number(b.dataset.key) - Number(a.dataset.key))[0] ?? null;
  });
  const handle = el.asElement();
  if (handle) await handle.click();
}

/** 场次 B：seed=25 复现引擎探测轨迹（囤 extras → lap1 伙伴站 p3 提议换菜） */
async function captureProposal(browser, mode, vp) {
  const page = await browser.newPage({ viewport: vp });
  await startGame(page, `${BASE}/?seed=25&fast=1`, 'action-char-chr-doudou');

  let ok = false;
  for (let i = 0; i < 300; i++) {
    if ((await page.getByTestId('bubble-proposal').count()) > 0) {
      await page.getByTestId('bubble-proposal').scrollIntoViewIfNeeded();
      await page.waitForTimeout(450); // 等 smooth scroll 落定
      await shot(page, 'proposal', mode);
      ok = true;
      break;
    }
    if ((await page.getByTestId('panel-market').count()) > 0) {
      await marketBuyExtras(page);
      continue;
    }
    await stepOnce(page);
  }
  console.log(`  proposal ${ok ? 'OK' : 'MISS'}`);
  await page.close();
}

/** 场次 C：?demo=1 → 「演示：花光零钱」→ 公交「先记进待付夹」→ 钱包待付夹非空 */
async function captureDebt(browser, mode, vp) {
  const page = await browser.newPage({ viewport: vp });
  await startGame(page, `${BASE}/?seed=1&fast=1&demo=1`, 'action-char-chr-doudou');

  await page.locator('[data-testid="demo-spend-all"]').click();
  // bot 先行的站自动进入：等 panel-bus 出现（途中看到真人的「进入这一站」就点）
  for (let i = 0; i < 40 && (await page.getByTestId('panel-bus').count()) === 0; i++) {
    const pri = page.locator('[data-testid="action-primary"]:not([disabled])');
    if ((await pri.count()) > 0) await pri.first().click();
    else await page.waitForTimeout(150);
  }
  await page.locator('[data-testid="panel-bus"]').waitFor();
  await shot(page, 'debt_bus', mode); // 「先记进待付夹」
  await page.locator('[data-testid="panel-bus"] [data-testid="action-primary"]').click(); // PAY_BUS → busDebt=2
  await page.locator('[data-testid="demo-close"]').click();
  await page.locator('[data-testid="btn-wallet"]').click();
  await page.locator('[data-testid="drawer-wallet"]').waitFor();
  await shot(page, 'debt', mode); // 待付夹：2 币
  await page.close();
}

const only = process.argv[2]; // 可选：desktop / mobile
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
try {
  for (const [mode, vp] of Object.entries(MODES)) {
    if (only && mode !== only) continue;
    console.log(`== ${mode} ==`);
    await captureMain(browser, mode, vp);
    await captureProposal(browser, mode, vp);
    await captureDebt(browser, mode, vp);
  }
} finally {
  await browser.close();
}
console.log('done');
