/** Probe E3-lap2: 一整圈 bot 回合计时（R2 新口径，团队第 1 轮反馈后定）。
 * Usage: BASE=http://localhost:4173 node shots/probe-e3-lap2.mjs [maxMinutes]
 * 前置：npm run build 后 vite preview 在 4173。
 *
 * 新口径三段切分（取代旧 probe-e3-lap.mjs 的整段墙钟记账）：
 *  - (a) bot 自控段：bot 处于 thinking、且无提议在等真人时的时间。
 *        pending（等驱动器下一步）归 bot 本人。验收：平均 ≤2s、单回合 ≤3s
 *        （新硬上限 BOT_TURN_HARD_CAP_MS=3000，看门狗在 useBotDriver）。
 *  - (b) 等真人段：[data-testid="bubble-proposal"] 存在（bot 提议在等真人
 *        回应）或等待浮签 .board-await-pill 存在的时间。单独报告，不计入
 *        bot 自控段。探针识别后替真人点气泡「好呀」(action-1) 让流程继续，
 *        并在浮签+气泡同框时截图存 shots/r10e_r2_await_prompt.png。
 *  - (c) 冻结段：采样间隔（相邻两次快照起始时刻差）>300ms 且该次
 *        evaluate 往返耗时 >300ms 的区间——软渲染主线程冻结特征，
 *        从自控/等真人段中剥离，单独报告。
 *
 * 采样：名义间隔 60ms，时间戳与往返耗时均取 Node 侧墙钟。每个采样点
 * 的状态管辖 [本采样起始, 下一采样起始) 区间，按上表归段。
 * 回合边界与旧探针一致：thinking 的 bot 变化/消失即回合结束。
 * 真人回合由脚本按 e2e helpers.stepOnce 同规则即时推进（气泡出现时
 * 走提议回应通道，不走通用推进，避免误点气泡内按钮）。
 * 一圈口径：lap=1 起，采到 lap 变 2 或满 24 个 bot 回合（8 站 × 3）止。
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const MAX_MS = (Number(process.argv[2]) || 14) * 60_000;
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const FREEZE_GAP_MS = 300;
const NOMINAL_MS = 60;

const SNAP_FN = () => {
  const think = document.querySelector('.bot-card--thinking');
  const prog = document.querySelector('.prog');
  const m = prog?.getAttribute('aria-label')?.match(/(\d+)\D+(\d+)/);
  return {
    bot: think?.getAttribute('data-testid') ?? null,
    bubble: !!document.querySelector('[data-testid="bubble-proposal"]'),
    pill: !!document.querySelector('.board-await-pill'),
    humanPrimary: !!document.querySelector('[data-testid="action-primary"]:not([disabled])'),
    lap: m ? Number(m[1]) : null,
    station: m ? Number(m[2]) : null,
    veil: !!document.querySelector('.spotlight-veil'),
    spot: !!document.querySelector('.bot-card--spot, .phone-bot--spot'),
    replay: !!document.querySelector('[data-testid="action-replay"]'),
  };
};

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript(() => {
  try {
    window.localStorage.setItem('maicai-lang', 'en');
  } catch { /* ignore */ }
});
await page.goto(`${BASE}/?board=3d&seed=1`);
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(2000);

const turns = []; // {bot, lap, station, selfMs, awaitMs, freezeMs, hadBubble, hadPill}
let cur = null;
let prev = null; // {tStart, snap}
let veilSeen = 0;
let spotSeen = 0;
let sawLap1 = false;
let lapDone = false;
let globalFreezeMs = 0; // 回合外（真人时段等）的冻结
let awaitShotTaken = false;
let awaitResponded = false; // 本次提议是否已替真人回应
let rttMax = 0;
let rttOver300 = 0;
let samples = 0;
const t0 = Date.now();
let lastHumanClick = 0;

console.log('开始采样（普通模式，三段口径）…');
while (Date.now() - t0 < MAX_MS && !lapDone) {
  const tStart = Date.now();
  const snap = await page.evaluate(SNAP_FN).catch(() => null);
  const rtt = Date.now() - tStart;
  if (!snap) {
    await page.waitForTimeout(120);
    continue;
  }
  samples++;
  if (rtt > rttMax) rttMax = rtt;
  if (rtt > FREEZE_GAP_MS) rttOver300++;

  // 把上一采样点管辖的区间归段
  if (prev) {
    const dur = tStart - prev.tStart;
    const frozen = dur > FREEZE_GAP_MS && prev.rtt > FREEZE_GAP_MS;
    const ps = prev.snap;
    if (cur && ps.bot === cur.bot) {
      if (frozen) cur.freezeMs += dur;
      else if (ps.bubble || ps.pill) cur.awaitMs += dur;
      else cur.selfMs += dur;
      if (ps.bubble) cur.hadBubble = true;
      if (ps.pill) cur.hadPill = true;
    } else if (frozen) {
      globalFreezeMs += dur;
    }
  }

  if (snap.veil) veilSeen++;
  if (snap.spot) spotSeen++;
  if (snap.lap === 1) sawLap1 = true;

  // 回合边界
  if (snap.bot !== (cur?.bot ?? null)) {
    if (cur) {
      turns.push(cur);
      const t = cur;
      console.log(
        `  回合 ${turns.length}: ${t.bot} lap${t.lap} 站${t.station} 自控=${(t.selfMs / 1000).toFixed(2)}s 等真人=${(t.awaitMs / 1000).toFixed(2)}s 冻结=${(t.freezeMs / 1000).toFixed(2)}s${t.hadBubble ? ' [有提议]' : ''}`,
      );
    }
    cur = snap.bot
      ? { bot: snap.bot, lap: snap.lap, station: snap.station, selfMs: 0, awaitMs: 0, freezeMs: 0, hadBubble: false, hadPill: false }
      : null;
    awaitResponded = false;
  }
  if ((sawLap1 && snap.lap === 2) || turns.length >= 24) lapDone = true;
  if (snap.replay) {
    console.log('  到达整局结束（action-replay），停止采样');
    break;
  }

  // 等真人段处理：气泡在场 → 等浮签同框截图 → 替真人点「好呀」
  if (snap.bubble && !awaitResponded) {
    if (snap.pill && !awaitShotTaken) {
      awaitShotTaken = true;
      await page.screenshot({ path: 'shots/r10e_r2_await_prompt.png' }).catch(() => null);
      console.log('  📷 已截等真人提示同框图 shots/r10e_r2_await_prompt.png（气泡+浮签）');
    }
    // 给浮签留出被采样到的时间：气泡出现满 ~500ms 后再回应
    if (cur && cur.awaitMs >= 500) {
      awaitResponded = true;
      const ok = await page
        .locator('[data-testid="bubble-proposal"] [data-testid="action-1"]')
        .click({ timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (!ok) {
        await page
          .evaluate(() => {
            const b = document.querySelector('[data-testid="bubble-proposal"] [data-testid="action-1"]');
            b?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          })
          .catch(() => null);
      }
      console.log('  → 替真人回应提议（好呀）');
    }
  }

  // 真人推进（无 bot thinking、无气泡时；限频 250ms）
  const now = Date.now();
  if (!snap.bot && !snap.bubble && now - lastHumanClick > 250) {
    lastHumanClick = now;
    await page
      .evaluate(() => {
        const primary = document.querySelector('[data-testid="action-primary"]:not([disabled])');
        const vis = (el) => el && el.getClientRects().length > 0;
        if (vis(primary)) {
          primary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return;
        }
        const keyed = [...document.querySelectorAll('[data-key]:not([disabled])')].filter(vis);
        if (keyed.length) {
          const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      })
      .catch(() => null);
  }

  prev = { tStart, snap, rtt };
  await page.waitForTimeout(NOMINAL_MS);
}
if (cur) turns.push({ ...cur, partial: true });

await browser.close();

const lap1 = turns.filter((t) => t.lap === 1 && !t.partial);
const sum = (k) => lap1.reduce((a, t) => a + t[k], 0);
const selfTotal = sum('selfMs');
const awaitTotal = sum('awaitMs');
const freezeTotal = sum('freezeMs');
const selfAvg = lap1.length ? selfTotal / lap1.length : 0;
const selfMax = lap1.length ? Math.max(...lap1.map((t) => t.selfMs)) : 0;
const awaitTurns = lap1.filter((t) => t.hadBubble || t.awaitMs > 0);
const pillTurns = lap1.filter((t) => t.hadPill);

console.log('\n===== E3 计时结果（R2 三段口径）=====');
console.log(`采样总时长: ${((Date.now() - t0) / 1000).toFixed(0)}s；采样点 ${samples} 个；evaluate 往返最大 ${rttMax}ms，>300ms 的 ${rttOver300} 次`);
console.log(`采到 bot 回合 ${turns.length} 个（lap1 完整回合 ${lap1.length} 个）；一圈完成: ${lapDone ? '是' : '否'}`);
console.log('逐回合（自控 / 等真人 / 冻结，秒）:');
for (const [i, t] of lap1.entries()) {
  console.log(
    `  ${i + 1}. ${t.bot} 站${t.station}: ${(t.selfMs / 1000).toFixed(2)} / ${(t.awaitMs / 1000).toFixed(2)} / ${(t.freezeMs / 1000).toFixed(2)}${t.hadBubble ? ' [提议]' : ''}${t.hadPill ? ' [浮签]' : ''}`,
  );
}
console.log(`自控段: 总 ${(selfTotal / 1000).toFixed(2)}s，平均 ${(selfAvg / 1000).toFixed(2)}s（≤2s → ${selfAvg <= 2000 ? 'PASS' : '🔴FAIL'}），单回合最大 ${(selfMax / 1000).toFixed(2)}s（≤3s 硬上限 → ${selfMax <= 3000 ? 'PASS' : '🔴FAIL'}）`);
console.log(`等真人段: 总 ${(awaitTotal / 1000).toFixed(2)}s，出现在 ${awaitTurns.length} 个回合；浮签 .board-await-pill 出现在 ${pillTurns.length} 个回合；截图: ${awaitShotTaken ? 'shots/r10e_r2_await_prompt.png' : '未截（无同框样本）'}`);
console.log(`冻结段: 回合内总 ${(freezeTotal / 1000).toFixed(2)}s，回合外 ${globalFreezeMs / 1000 >= 0 ? (globalFreezeMs / 1000).toFixed(2) : 0}s`);
console.log(`形态证据: .spotlight-veil 采样命中 ${veilSeen} 次（bot 自动高光应为 0）；.bot-card--spot 命中 ${spotSeen} 次`);

writeFileSync(
  'shots/e3-lap2-result.json',
  JSON.stringify(
    {
      sampledSec: (Date.now() - t0) / 1000,
      samples,
      rttMax,
      rttOver300,
      lapDone,
      turns: lap1,
      selfTotalMs: selfTotal,
      selfAvgMs: selfAvg,
      selfMaxMs: selfMax,
      awaitTotalMs: awaitTotal,
      freezeTotalMs: freezeTotal,
      globalFreezeMs,
      awaitShotTaken,
      veilSeen,
      spotSeen,
    },
    null,
    2,
  ),
);
console.log('结果 JSON: shots/e3-lap2-result.json');
