/** probe-r2-proposal.mjs — 提议浮签（ProposalPill）定向补拍（ww 必须拍到）。
 * Usage:
 *   node shots/probe-r2-proposal.mjs hunt [seedStart] [seedEnd]   // fast 狩猎
 *   node shots/probe-r2-proposal.mjs capture <seed>               // 普通模式桌面取证
 *   node shots/probe-r2-proposal.mjs capture-phone <seed>         // 普通模式手机取证
 * 前置：vite preview 4173。
 *
 * 新 UI 标记（以现代码为准）：ProposalPill 根元素
 * [data-testid="await-proposal"]（.board-await），内含提议文案
 * .board-await-text、两件菜图 .board-await-thumb、Yes/No 按钮
 * [data-testid="proposal-yes"/"proposal-no"]。角落气泡
 * [data-testid="bubble-proposal"] 同步在场（同一提议的另一入口）。
 * 驱动红线：await-proposal 或 bubble 任一在场时绝不推进（气泡按钮
 * 带 data-key，通用推进会误答提议）。
 *
 * 触发条件（沿用旧探针注释的读码结论）：伙伴站（station 3）bot 回合、
 * bot.extras 非空、目标 extras 非空（真人优先）。策略：全 bot 改
 * impulsive（攒 extras 概率最高）、真人市场站贪心买卡攒 extras、
 * 其余回合按 stepOnce 规则推进。fast 狩猎判定与节奏无关，命中后用
 * 普通模式同 seed 同驱动复现取证。
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
  const pill = document.querySelector('[data-testid="await-proposal"]');
  const bubble = document.querySelector('[data-testid="bubble-proposal"]');
  return {
    pill: !!pill,
    pillText: pill?.querySelector('.board-await-text')?.textContent?.trim() ?? null,
    pillThumbs: pill ? pill.querySelectorAll('.board-await-thumb').length : 0,
    pillYes: !!pill?.querySelector('[data-testid="proposal-yes"]'),
    pillNo: !!pill?.querySelector('[data-testid="proposal-no"]'),
    bubble: !!bubble,
    bubbleText: bubble?.textContent?.trim() ?? null,
    botThinking: !!document.querySelector('.bot-card--thinking'),
    lap: m ? Number(m[1]) : null,
    station: m ? Number(m[2]) : null,
    replay: !!document.querySelector('[data-testid="action-replay"]'),
    stallCards: document.querySelectorAll('[data-testid^="action-stall-"]').length,
    pendingChip: !!document.querySelector('.pending-chip'),
  };
};

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

async function tryBuyOne(page) {
  const card = page.locator('[data-testid^="action-stall-"]').first();
  if ((await card.count()) === 0) return false;
  await card.dispatchEvent('click').catch(() => null);
  await page.waitForTimeout(150);
  const buyBtn = page.locator('[data-testid="action-primary"]:not([disabled])').first();
  if ((await buyBtn.count()) === 0) return false;
  await buyBtn.dispatchEvent('click').catch(() => null);
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
  const perBtns = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[data-testid^="demo-per-"]')].map((e) => e.getAttribute('data-testid'));
    return ids.filter((id) => id.endsWith('-impulsive'));
  });
  for (const id of perBtns) {
    await page.locator(`[data-testid="${id}"]`).dispatchEvent('click').catch(() => null);
    await page.waitForTimeout(120);
  }
  await page.locator('[data-testid="demo-close"]').dispatchEvent('click').catch(() => null);
  await page.waitForTimeout(300);
  return perBtns.length;
}

async function driveUntilAwait(page, { timeoutMs }) {
  const t0 = Date.now();
  let marketBuys = 0;
  let lastStationKey = '';
  let lastAdvance = 0;
  const notes = [];
  while (Date.now() - t0 < timeoutMs) {
    const s = await page.evaluate(SNAP_FN).catch(() => null);
    if (!s) {
      await page.waitForTimeout(150);
      continue;
    }
    if (s.pill) {
      return { found: true, snap: s, elapsedMs: Date.now() - t0, notes };
    }
    if (s.bubble && !s.pill) {
      // 气泡先到、浮签应同帧渲染——等 1.2s 复查，绝不推进（防误答）
      await page.waitForTimeout(1200);
      const s2 = await page.evaluate(SNAP_FN).catch(() => null);
      if (s2?.pill) return { found: true, snap: s2, elapsedMs: Date.now() - t0, notes };
      if (s2?.bubble) {
        notes.push('气泡在场但浮签缺席（异常），继续等待不推进');
        await page.waitForTimeout(800);
        continue;
      }
      continue;
    }
    if (s.replay) return { found: false, reason: 'game-ended', snap: s, elapsedMs: Date.now() - t0, notes };
    const stationKey = `${s.lap}-${s.station}`;
    if (stationKey !== lastStationKey) {
      lastStationKey = stationKey;
      marketBuys = 0;
    }
    if (s.botThinking) {
      await page.waitForTimeout(150);
      continue;
    }
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

async function shot(page, file) {
  const full = path.join(OUT, file);
  const methods = [
    async () => { await page.screenshot({ path: full, timeout: 60_000 }); return 'pw'; },
    async () => {
      const cdp = await page.context().newCDPSession(page);
      const res = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('cap 60s')), 60_000)),
      ]);
      fs.writeFileSync(full, Buffer.from(res.data, 'base64'));
      return 'cdp-surface';
    },
    async () => {
      const cdp = await page.context().newCDPSession(page);
      const res = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('cap 60s')), 60_000)),
      ]);
      fs.writeFileSync(full, Buffer.from(res.data, 'base64'));
      return 'cdp-nosurface';
    },
  ];
  for (const m of methods) {
    try {
      const tag = await m();
      console.log(`  shot ${file} (${tag})`);
      return true;
    } catch (e) {
      console.log(`  shot ${file} failed: ${String(e).slice(0, 80)}`);
    }
  }
  return false;
}

async function pillCheck(page) {
  return page.evaluate(() => {
    const pill = document.querySelector('[data-testid="await-proposal"]');
    const yes = pill?.querySelector('[data-testid="proposal-yes"]');
    const no = pill?.querySelector('[data-testid="proposal-no"]');
    const yr = yes?.getBoundingClientRect();
    const nr = no?.getBoundingClientRect();
    return {
      text: pill?.querySelector('.board-await-text')?.textContent?.trim() ?? null,
      thumbs: pill ? pill.querySelectorAll('.board-await-thumb').length : 0,
      thumbImgs: pill ? [...pill.querySelectorAll('.board-await-thumb img')].map((i) => i.getAttribute('src')?.split('/').pop()) : [],
      yesH: yr ? Math.round(yr.height) : null,
      noH: nr ? Math.round(nr.height) : null,
      bubblePresent: !!document.querySelector('[data-testid="bubble-proposal"]'),
      anyBotThinking: !!document.querySelector('.bot-card--thinking'),
    };
  });
}

if (MODE === 'hunt') {
  const seedStart = Number(process.argv[3] ?? 2);
  const seedEnd = Number(process.argv[4] ?? 8);
  const browser = await chromium.launch({ args: GL_ARGS });
  const results = [];
  for (let seed = seedStart; seed <= seedEnd; seed++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
    console.log(`\n=== seed=${seed}（fast 狩猎）===`);
    const nPer = await startGame(page, seed, true);
    console.log(`  impulsive 性格按钮点到 ${nPer} 个`);
    const r = await driveUntilAwait(page, { timeoutMs: 240_000 });
    console.log(
      r.found
        ? `  ✅ 触发！lap${r.snap.lap} 站${r.snap.station}，${(r.elapsedMs / 1000).toFixed(0)}s\n     pill="${r.snap.pillText}" thumbs=${r.snap.pillThumbs} yes=${r.snap.pillYes} no=${r.snap.pillNo}`
        : `  ✗ 未触发（${r.reason}，${(r.elapsedMs / 1000).toFixed(0)}s）`,
    );
    for (const n of r.notes) console.log(`     note: ${n}`);
    results.push({ seed, found: r.found, reason: r.reason ?? null, snap: r.snap ?? null, notes: r.notes });
    await ctx.close();
    if (r.found) break;
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'r2-proposal-hunt.json'), JSON.stringify(results, null, 2));
  console.log('\n结果 JSON: shots/r2-proposal-hunt.json');
} else if (MODE === 'capture' || MODE === 'capture-phone') {
  const seed = Number(process.argv[3]);
  if (!seed) throw new Error('capture 需要 seed 参数');
  const phone = MODE === 'capture-phone';
  const browser = await chromium.launch({ args: GL_ARGS });
  const ctx = phone
    ? await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true })
    : await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  if (phone) {
    await page.addInitScript((css) => {
      const inject = () => {
        const st = document.createElement('style');
        st.textContent = css;
        document.documentElement.appendChild(st);
      };
      if (document.documentElement) inject();
      else document.addEventListener('DOMContentLoaded', inject);
    }, SAFE_CSS);
  }
  console.log(`=== seed=${seed}（普通模式 ${phone ? '手机' : '桌面'} 复现取证）===`);
  const nPer = await startGame(page, seed, false);
  console.log(`  impulsive 性格按钮点到 ${nPer} 个`);
  const r = await driveUntilAwait(page, { timeoutMs: 600_000 });
  if (!r.found) {
    console.log(`  ✗ 未复现（${r.reason}，${(r.elapsedMs / 1000).toFixed(0)}s）`);
    for (const n of r.notes) console.log(`     note: ${n}`);
    await browser.close();
    process.exit(2);
  }
  console.log(`  ✅ 触发：lap${r.snap.lap} 站${r.snap.station}，${(r.elapsedMs / 1000).toFixed(0)}s`);
  await page.waitForTimeout(2500);
  const pillRect = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="await-proposal"]');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  });
  console.log('  浮签 rect:', JSON.stringify(pillRect));
  // 先拍（应用自身滚动逻辑落定后的原样，实验代码在拍照之后才动滚动）
  await shot(page, phone ? 'r10e_r2_proposal_phone.png' : 'r10e_r2_proposal_desktop.png');
  const chain = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="await-proposal"]');
    const out = [];
    let n = el;
    while (n && out.length < 10) {
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      out.push({
        tag: n.tagName,
        cls: n.className?.toString().slice(0, 40),
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        scrollTop: n.scrollTop,
        clientH: n.clientHeight,
        scrollH: n.scrollHeight,
        overflowY: cs.overflowY,
        position: cs.position,
      });
      n = n.parentElement;
    }
    return out;
  });
  console.log('  祖先链:', JSON.stringify(chain, null, 1));
  // 滚动实验：手动把竖栏滚到浮签处，看会不会被拉回去
  const exp = await page.evaluate(async () => {
    const rail = document.querySelector('.phone-rail');
    const pill = document.querySelector('[data-testid="await-proposal"]');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const state = (tag) => {
      const r = pill.getBoundingClientRect();
      return { tag, railScrollTop: rail.scrollTop, pillY: Math.round(r.y), pillBottom: Math.round(r.bottom) };
    };
    const out = [state('before')];
    rail.scrollTop = 0;
    out.push(state('after scrollTop=0 (sync)'));
    await sleep(600);
    out.push(state('after 600ms'));
    pill.scrollIntoView({ block: 'start' });
    out.push(state('after scrollIntoView start (sync)'));
    await sleep(600);
    out.push(state('after 600ms more'));
    return out;
  });
  console.log('  滚动实验:', JSON.stringify(exp, null, 1));
  const check = await pillCheck(page);
  console.log('  浮签核对:', JSON.stringify(check, null, 1));
  fs.writeFileSync(
    path.join(OUT, phone ? 'r2-proposal-capture-phone.json' : 'r2-proposal-capture.json'),
    JSON.stringify({ seed, snap: r.snap, check }, null, 2),
  );
  await browser.close();
}
