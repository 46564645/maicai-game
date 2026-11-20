/** Probe R2-await-hunt: 专门狩猎「bot 向真人发起换菜提议 → 引擎停等真人」
 * 的同框画面（气泡 [data-testid="bubble-proposal"] + 等待浮签 .board-await-pill）。
 *
 * Usage:
 *   node shots/probe-r2-await-hunt.mjs hunt [seedStart] [seedCount]
 *   node shots/probe-r2-await-hunt.mjs capture <seed>
 * 前置：vite preview 在 4173（dist 已含 R2-E3 修复）。
 *
 * 触发条件（读 src/game/bots.ts botPartner / stations/partner.ts 得出，只读）：
 *  - 伙伴站（station 3）bot 回合，bot.extras 非空；
 *  - 一遍：bot 缺的材料在真人 extras 里（真人优先）→ 必提议；
 *  - 二遍：roll('swap-any') < proposeSwapAny（impulsive .45 / follower .85），
 *    且任一目标 extras 非空、真人优先。
 *  extras 来源只有买卡入篮（非菜谱所需材料 → extras）：市场站买卡、
 *  事件站得卡、小卖部买卡。故第 1 圈伙伴站之前只有市场一站能攒 extras，
 *  bot 买「多余材料」概率 steady 0 / impulsive .35 / follower .1——
 *  第 1 圈 seed=1 整圈无提议与此吻合。狩猎策略：
 *  - 全 bot 改 impulsive（demo 条 DEMO_SET_PERSONALITY，攒 extras 概率最高，
 *    提议率 .45 次高；follower 提议率 .85 但攒 extras 只有 .1）；
 *  - 真人在市场站贪心买卡（先点摊位卡选中 → 点 action-primary 买入，
 *    等后悔窗 PendingChip 消失再下一张，每访最多买 2 张＝引擎上限）；
 *  - 其余真人回合按 e2e stepOnce 同规则推进（primary → 最大 data-key）；
 *  - 气泡在场时绝不走通用推进（气泡按钮带 data-key=1/2，误点会拒绝提议）；
 *  - pill 单独出现（一起买 inviteResponse，无气泡）时用通用推进回应掉，
 *    继续狩猎换菜提议。
 * hunt 用 ?fast=1（bot 零延迟、整局秒级；提议判定是状态哈希，与节奏无关）；
 * capture 用普通模式同 seed 同驱动复现，拍桌面 + 手机两张实证图。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const MODE = process.argv[2] ?? 'hunt';

const SNAP_FN = () => {
  const prog = document.querySelector('.prog');
  const m = prog?.getAttribute('aria-label')?.match(/(\d+)\D+(\d+)/);
  const pill = document.querySelector('.board-await-pill');
  const bubble = document.querySelector('[data-testid="bubble-proposal"]');
  const status = document.querySelector('.board-status');
  return {
    bubble: !!bubble,
    bubbleText: bubble?.textContent?.trim() ?? null,
    pill: !!pill,
    pillText: pill?.textContent?.trim() ?? null,
    statusText: status?.textContent?.trim() ?? null,
    botThinking:
      document.querySelector('.bot-card--thinking')?.getAttribute('data-testid') ??
      (document.querySelector('.phone-bot--on') ? 'phone-chip' : null),
    anyThinking: !!document.querySelector('.bot-card--thinking'),
    lap: m ? Number(m[1]) : null,
    station: m ? Number(m[2]) : null,
    replay: !!document.querySelector('[data-testid="action-replay"]'),
    stallCards: document.querySelectorAll('[data-testid^="action-stall-"]').length,
    pendingChip: !!document.querySelector('.pending-chip'),
    buysLeftText: document.querySelector('.panel-buysleft')?.textContent?.trim() ?? null,
  };
};

/** 通用推进（e2e stepOnce 同规则）：可见 primary → 可见最大 data-key */
async function advance(page) {
  await page
    .evaluate(() => {
      const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
      const primary = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
      if (primary) {
        primary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'primary';
      }
      const keyed = [...document.querySelectorAll('[data-key]')].filter(vis);
      if (keyed.length) {
        const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'keyed';
      }
      return 'none';
    })
    .catch(() => null);
}

/** 市场站真人贪心买一张：点摊位卡 → 点买入钮 → 等后悔窗结束。成功返回 true */
async function tryBuyOne(page) {
  const card = page.locator('[data-testid^="action-stall-"]').first();
  if ((await card.count()) === 0) return false;
  await card.dispatchEvent('click').catch(() => null);
  await page.waitForTimeout(150);
  const buyBtn = page.locator('[data-testid="action-primary"]:not([disabled])').first();
  if ((await buyBtn.count()) === 0) return false;
  await buyBtn.dispatchEvent('click').catch(() => null);
  // 后悔窗 PendingChip 在场时等它到期派发（最多 4s）
  const t0 = Date.now();
  while (Date.now() - t0 < 4000) {
    const s = await page.evaluate(SNAP_FN).catch(() => null);
    if (s && !s.pendingChip) break;
    await page.waitForTimeout(150);
  }
  return true;
}

async function startGame(page, seed, fast) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('maicai-lang', 'en');
    } catch { /* ignore */ }
  });
  const q = fast ? `?demo=1&fast=1&board=3d&seed=${seed}` : `?demo=1&board=3d&seed=${seed}`;
  await page.goto(`${BASE}/${q}`);
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(1500);
  // 全 bot 改 impulsive（攒 extras 概率最高）
  const perBtns = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[data-testid^="demo-per-"]')].map((e) => e.getAttribute('data-testid'));
    return ids.filter((id) => id.endsWith('-impulsive'));
  });
  for (const id of perBtns) {
    await page.locator(`[data-testid="${id}"]`).dispatchEvent('click').catch(() => null);
    await page.waitForTimeout(120);
  }
  // 关演示条，免得遮挡/入镜
  await page.locator('[data-testid="demo-close"]').dispatchEvent('click').catch(() => null);
  await page.waitForTimeout(300);
  return perBtns.length;
}

/** 驱动一局直到气泡+浮签同框 / 整局结束 / 超时。返回结果对象 */
async function driveUntilAwait(page, { timeoutMs, onFound }) {
  const t0 = Date.now();
  let marketBuys = 0;
  let lastStationKey = '';
  let pillOnlySince = 0;
  let lastAdvance = 0;
  const notes = [];
  while (Date.now() - t0 < timeoutMs) {
    const s = await page.evaluate(SNAP_FN).catch(() => null);
    if (!s) {
      await page.waitForTimeout(150);
      continue;
    }
    if (s.bubble && s.pill) {
      return { found: true, snap: s, elapsedMs: Date.now() - t0, notes };
    }
    if (s.bubble && !s.pill) {
      // 气泡先到、浮签应同帧——等 1.2s 复查，仍无浮签记异常并继续等（不回应）
      await page.waitForTimeout(1200);
      const s2 = await page.evaluate(SNAP_FN).catch(() => null);
      if (s2?.bubble && s2?.pill) return { found: true, snap: s2, elapsedMs: Date.now() - t0, notes };
      if (s2?.bubble && !s2?.pill) {
        notes.push(`气泡出现但浮签缺席（status="${s2.statusText}", pill=false），继续等待`);
        await page.waitForTimeout(800);
        continue;
      }
      continue;
    }
    if (s.replay) return { found: false, reason: 'game-ended', snap: s, elapsedMs: Date.now() - t0, notes };
    if (s.pill && !s.bubble) {
      // 一起买等真人（面板卡回应，无气泡）：停留确认 1s 后通用推进回应掉
      if (!pillOnlySince) pillOnlySince = Date.now();
      if (Date.now() - pillOnlySince > 1000) {
        notes.push(`pill-only（一起买）出现于 lap${s.lap} 站${s.station}：「${s.pillText}」，已回应继续狩猎`);
        pillOnlySince = 0;
        await advance(page);
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(150);
      continue;
    }
    pillOnlySince = 0;
    const stationKey = `${s.lap}-${s.station}`;
    if (stationKey !== lastStationKey) {
      lastStationKey = stationKey;
      marketBuys = 0;
    }
    if (s.botThinking) {
      await page.waitForTimeout(150);
      continue;
    }
    // 真人回合
    const now = Date.now();
    if (now - lastAdvance < 200) {
      await page.waitForTimeout(100);
      continue;
    }
    lastAdvance = now;
    if (s.stallCards > 0 && marketBuys < 2) {
      const ok = await tryBuyOne(page);
      if (ok) marketBuys++;
      else await advance(page);
    } else {
      await advance(page);
    }
    await page.waitForTimeout(120);
  }
  return { found: false, reason: 'timeout', elapsedMs: Date.now() - t0, notes };
}

async function cdpShot(page, file) {
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(res.data, 'base64'));
  console.log(`  shot ${file}`);
}

if (MODE === 'hunt') {
  const seedStart = Number(process.argv[3] ?? 1);
  const seedCount = Number(process.argv[4] ?? 6);
  const browser = await chromium.launch({ args: GL_ARGS });
  const results = [];
  for (let seed = seedStart; seed < seedStart + seedCount; seed++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
    console.log(`\n=== seed=${seed}（fast 狩猎）===`);
    const nPer = await startGame(page, seed, true);
    console.log(`  性格按钮（impulsive）点到 ${nPer} 个`);
    const r = await driveUntilAwait(page, { timeoutMs: 240_000 });
    console.log(
      r.found
        ? `  ✅ 触发！lap${r.snap.lap} 站${r.snap.station}，用时 ${(r.elapsedMs / 1000).toFixed(0)}s\n     status="${r.snap.statusText}"\n     pill="${r.snap.pillText}"\n     bubble="${r.snap.bubbleText}"`
        : `  ✗ 未触发（${r.reason}，${(r.elapsedMs / 1000).toFixed(0)}s）`,
    );
    for (const n of r.notes) console.log(`     note: ${n}`);
    results.push({ seed, found: r.found, reason: r.reason ?? null, snap: r.snap ?? null, notes: r.notes });
    await ctx.close();
    if (r.found) break;
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'r2-hunt-result.json'), JSON.stringify(results, null, 2));
  console.log('\n结果 JSON: shots/r2-hunt-result.json');
} else if (MODE === 'capture') {
  const seed = Number(process.argv[3]);
  if (!seed) throw new Error('capture 需要 seed 参数');
  const browser = await chromium.launch({ args: GL_ARGS });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  console.log(`=== seed=${seed}（普通模式复现取证）===`);
  const nPer = await startGame(page, seed, false);
  console.log(`  性格按钮（impulsive）点到 ${nPer} 个`);
  const r = await driveUntilAwait(page, { timeoutMs: 600_000 });
  if (!r.found) {
    console.log(`  ✗ 普通模式未复现（${r.reason}，${(r.elapsedMs / 1000).toFixed(0)}s）`);
    for (const n of r.notes) console.log(`     note: ${n}`);
    await browser.close();
    process.exit(2);
  }
  console.log(`  ✅ 触发：lap${r.snap.lap} 站${r.snap.station}，用时 ${(r.elapsedMs / 1000).toFixed(0)}s`);
  // 四要素核对（桌面）
  const check = await page.evaluate(() => {
    const pill = document.querySelector('.board-await-pill');
    const bubble = document.querySelector('[data-testid="bubble-proposal"]');
    const status = document.querySelector('.board-status');
    const fromName = pill?.textContent ?? '';
    return {
      statusText: status?.textContent?.trim() ?? null,
      pillText: pill?.textContent?.trim() ?? null,
      pillVisible: !!pill && pill.getClientRects().length > 0,
      bubblePresent: !!bubble,
      bubbleText: bubble?.textContent?.trim() ?? null,
      speechBubblePresent: !!document.querySelector('.speech-bubble'),
      anyBotThinking: !!document.querySelector('.bot-card--thinking'),
      thinkingCards: [...document.querySelectorAll('.bot-card--thinking')].map((e) => e.getAttribute('data-testid')),
    };
  });
  console.log('  桌面四要素:', JSON.stringify(check, null, 2));
  await page.waitForTimeout(600);
  await cdpShot(page, 'r10e_r2_await_prompt_desktop.png');
  // 手机横屏：同页切视口 + 安全区注入（状态不变，布局切换为手机形态）
  await page.addStyleTag({ content: SAFE_CSS });
  await page.setViewportSize({ width: 874, height: 402 });
  await page.waitForTimeout(1500);
  const phoneCheck = await page.evaluate(() => {
    const pill = document.querySelector('.board-await-pill');
    const bubble = document.querySelector('[data-testid="bubble-proposal"]');
    const status = document.querySelector('.board-status');
    const r = pill?.getBoundingClientRect();
    return {
      statusText: status?.textContent?.trim() ?? null,
      pillText: pill?.textContent?.trim() ?? null,
      pillRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      pillInViewport: !!r && r.x >= 0 && r.y >= 0 && r.right <= 874 && r.bottom <= 402 && r.width > 0,
      pillVisible: !!pill && pill.getClientRects().length > 0,
      bubblePresent: !!bubble,
      anyBotThinking: !!document.querySelector('.bot-card--thinking'),
      phoneRail: !!document.querySelector('.phone-rail'),
    };
  });
  console.log('  手机核对:', JSON.stringify(phoneCheck, null, 2));
  await cdpShot(page, 'r10e_r2_await_prompt_phone.png');
  fs.writeFileSync(
    path.join(OUT, 'r2-capture-result.json'),
    JSON.stringify({ seed, snap: r.snap, desktop: check, phone: phoneCheck }, null, 2),
  );
  console.log('结果 JSON: shots/r2-capture-result.json');
  await browser.close();
}

if (MODE === 'capture-phone') {
  const seed = Number(process.argv[3]);
  if (!seed) throw new Error('capture-phone 需要 seed 参数');
  const browser = await chromium.launch({ args: GL_ARGS });
  // 与 r10e-after-shots phone 口径一致：874×402 + hasTouch/isMobile（手机判定
  // 需 pointer:coarse/maxTouchPoints>0 且短边 ≤560，否则进不了 phone 形态）
  const ctx = await browser.newContext({
    viewport: { width: 874, height: 402 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await page.addInitScript((css) => {
    const inject = () => {
      const st = document.createElement('style');
      st.textContent = css;
      document.documentElement.appendChild(st);
    };
    if (document.documentElement) inject();
    else document.addEventListener('DOMContentLoaded', inject);
  }, SAFE_CSS);
  console.log(`=== seed=${seed}（手机横屏 874×402 复现取证）===`);
  const nPer = await startGame(page, seed, false);
  console.log(`  性格按钮（impulsive）点到 ${nPer} 个`);
  const r = await driveUntilAwait(page, { timeoutMs: 600_000 });
  if (!r.found) {
    console.log(`  ✗ 手机形态未复现（${r.reason}，${(r.elapsedMs / 1000).toFixed(0)}s）`);
    for (const n of r.notes) console.log(`     note: ${n}`);
    await browser.close();
    process.exit(2);
  }
  console.log(`  ✅ 触发：lap${r.snap.lap} 站${r.snap.station}，用时 ${(r.elapsedMs / 1000).toFixed(0)}s`);
  await page.waitForTimeout(800);
  const phoneCheck = await page.evaluate(() => {
    const pill = document.querySelector('.board-await-pill');
    const bubble = document.querySelector('[data-testid="bubble-proposal"]');
    const status = document.querySelector('.board-status');
    const rect = pill?.getBoundingClientRect();
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
    return {
      statusText: status?.textContent?.trim() ?? null,
      pillText: pill?.textContent?.trim() ?? null,
      pillRect: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
      pillInViewport: !!rect && rect.x >= 0 && rect.y >= 0 && rect.right <= 874 && rect.bottom <= 402 && rect.width > 0,
      pillInRail: !!pill && !!pill.closest('.phone-rail'),
      pillVisible: !!pill && pill.getClientRects().length > 0,
      bubblePresent: !!bubble,
      bubbleText: bubble?.textContent?.trim() ?? null,
      phoneRailPresent: !!rail,
      railTextHasThinking: !!rail && /Thinking/.test(rail.textContent ?? ''),
      anyBotThinkingCard: !!document.querySelector('.bot-card--thinking'),
    };
  });
  console.log('  手机核对:', JSON.stringify(phoneCheck, null, 2));
  await page.waitForTimeout(400);
  await cdpShot(page, 'r10e_r2_await_prompt_phone.png');
  fs.writeFileSync(
    path.join(OUT, 'r2-capture-phone-result.json'),
    JSON.stringify({ seed, snap: r.snap, phone: phoneCheck }, null, 2),
  );
  console.log('结果 JSON: shots/r2-capture-phone-result.json');
  await browser.close();
}
