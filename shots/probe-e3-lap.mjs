/** Probe E3: 一整圈 bot 回合计时（R1 定稿 E3）。
 * Usage: BASE=http://localhost:4173 node shots/probe-e3-lap.mjs [maxMinutes]
 * 前置：npm run build 后 vite preview 在 4173。
 *
 * 口径：普通模式（无 ?fast=1，bot 走 botTiming 阶梯延迟）。
 *  - active 信号 = DOM：桌面 .bot-card--thinking 的 data-testid（bot-<id>）；
 *    无 bot thinking 且出现真人待办主按钮 = 真人回合。
 *  - 一个 bot 回合 = 某 bot 连续 thinking 的时段（成为 active → 下一位
 *    玩家 active）。轮询 60ms，时间戳取 Node 侧墙钟。
 *  - 真人回合由脚本按 e2e helpers.stepOnce 同规则即时推进（点
 *    action-primary，否则点 data-key 最大者），真人「思考时间」≈ 轮询
 *    + 点击延迟，不计入 bot 数据。
 *  - 一圈口径：.prog 的 aria-label 给出 lap 与站号；从 lap=1 第 1 站
 *    开始，采到 lap 变 2（或采满 8 站 × 3 bot = 24 个 bot 回合）为止。
 *  - 超时未采满一圈：输出已采回合 + 按 botTiming 纯函数的全圈估算，
 *    并标注实测/估算边界。
 * 同步记录 E3 形态证据：bot 回合中是否出现全屏 .spotlight-veil
 * （新形态应为 0 次；manual 点开才有，本脚本不点 bot 卡）、
 * .bot-card--spot 角落高光出现次数。
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const MAX_MS = (Number(process.argv[2]) || 12) * 60_000;
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const SNAP_FN = () => {
  const think = document.querySelector('.bot-card--thinking');
  const prog = document.querySelector('.prog');
  const m = prog?.getAttribute('aria-label')?.match(/(\d+)\D+(\d+)/);
  return {
    bot: think?.getAttribute('data-testid') ?? null,
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

const turns = []; // {bot, start, end, lap, station}
let cur = null; // {bot, since, lap, station}
let veilSeen = 0;
let spotSeen = 0;
let sawLap1 = false;
let lapDone = false;
const t0 = Date.now();
let lastHumanClick = 0;

console.log('开始采样（普通模式）…');
while (Date.now() - t0 < MAX_MS && !lapDone) {
  const s = await page.evaluate(SNAP_FN).catch(() => null);
  if (!s) {
    await page.waitForTimeout(120);
    continue;
  }
  if (s.veil) veilSeen++;
  if (s.spot) spotSeen++;
  if (s.lap === 1) sawLap1 = true;

  // 回合边界：thinking 的 bot 变了（或消失）
  const now = Date.now();
  if (s.bot !== (cur?.bot ?? null)) {
    if (cur) {
      turns.push({ ...cur, end: now, durMs: now - cur.since });
      console.log(`  回合 ${turns.length}: ${cur.bot} lap${cur.lap} 站${cur.station} = ${(turns[turns.length - 1].durMs / 1000).toFixed(2)}s`);
    }
    cur = s.bot ? { bot: s.bot, since: now, lap: s.lap, station: s.station } : null;
  }
  // 一圈完成：进入 lap 2，或已采 24 个 bot 回合
  if ((sawLap1 && s.lap === 2) || turns.length >= 24) lapDone = true;
  if (s.replay) {
    console.log('  到达整局结束（action-replay），停止采样');
    break;
  }

  // 真人推进：无 bot thinking 时按 stepOnce 规则点（限频 250ms）
  if (!s.bot && now - lastHumanClick > 250) {
    lastHumanClick = now;
    const clicked = await page
      .evaluate(() => {
        const primary = document.querySelector('[data-testid="action-primary"]:not([disabled])');
        const vis = (el) => el && el.getClientRects().length > 0;
        if (vis(primary)) {
          primary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return 'primary';
        }
        const keyed = [...document.querySelectorAll('[data-key]:not([disabled])')].filter(vis);
        if (keyed.length) {
          const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return 'keyed';
        }
        return null;
      })
      .catch(() => null);
    void clicked;
  }
  await page.waitForTimeout(60);
}
if (cur) turns.push({ ...cur, end: Date.now(), durMs: Date.now() - cur.since, partial: true });

await browser.close();

const lap1 = turns.filter((t) => t.lap === 1 && !t.partial);
const total = lap1.reduce((a, t) => a + t.durMs, 0);
const avg = lap1.length ? total / lap1.length : 0;
console.log('\n===== E3 计时结果 =====');
console.log(`采样总时长: ${((Date.now() - t0) / 1000).toFixed(0)}s；采到 bot 回合 ${turns.length} 个（lap1 完整回合 ${lap1.length} 个）`);
for (const t of lap1) console.log(`  ${t.bot} 站${t.station}: ${(t.durMs / 1000).toFixed(2)}s`);
console.log(`lap1 bot 回合总时长: ${(total / 1000).toFixed(2)}s；平均每回合: ${(avg / 1000).toFixed(2)}s（标准 ≤2.00s → ${avg <= 2000 ? 'PASS' : '🔴FAIL'}）`);
console.log(`一圈完成: ${lapDone ? '是' : '否（超时/未采满，总秒数与平均为已采回合口径）'}`);
console.log(`形态证据: .spotlight-veil 采样命中 ${veilSeen} 次（bot 自动高光应为 0）；.bot-card--spot 命中 ${spotSeen} 次`);
console.log('估算对照（botTiming 纯函数）: 3 条命令回合 1300ms / 4 条 1550ms / 5 条 1670ms（base=800）；若实测回合命令数分布未知，全圈估算 = 24 回合 × 平均命令数对应值，见报告口径说明。');
