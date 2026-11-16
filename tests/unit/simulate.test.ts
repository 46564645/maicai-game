import { describe, expect, it } from 'vitest';
import { simulate, humanScripts } from '../../src/game/simulate';
import type { HumanScript, SimulateResult } from '../../src/game/simulate';
import { gameConfig } from '../../src/config/gameConfig';
import { moneyLedger } from '../../src/game/selectors';
import type { BotPersonality, GameState } from '../../src/game/types';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

const COMBOS: { name: string; personalities: BotPersonality[] }[] = [
  { name: 'mixed', personalities: ['steady', 'impulsive', 'follower'] },
  { name: 'all-steady', personalities: ['steady', 'steady', 'steady'] },
  { name: 'all-impulsive', personalities: ['impulsive', 'impulsive', 'impulsive'] },
];

const SCRIPTS: { name: string; script: HumanScript }[] = [
  { name: 'first', script: humanScripts.first },
  { name: 'random', script: humanScripts.random },
  { name: 'frugal', script: humanScripts.frugal },
  { name: 'tempted', script: humanScripts.tempted },
];

/** 每步不变量：币非负、无玩家间币转移、花钱事件≤2、家长站≤1 次 */
function checkInvariants(
  prev: GameState,
  next: GameState | undefined,
  parentUses: Map<string, number>,
  err?: string,
) {
  if (err || !next) return;
  next.players.forEach((p, i) => {
    expect(p.coins).toBeGreaterThanOrEqual(0);
    expect(p.busDebt).toBeGreaterThanOrEqual(0);
    expect(p.paidEventCount).toBeLessThanOrEqual(gameConfig.events.maxPaidPerPlayer);
    if (p.parentUsed && !prev.players[i].parentUsed) {
      parentUses.set(p.id, (parentUses.get(p.id) ?? 0) + 1);
    }
  });
  const deltas = next.players.map((p, i) => p.coins - prev.players[i].coins);
  const gained = deltas.some((d) => d > 0);
  const lost = deltas.some((d) => d < 0);
  expect(gained && lost).toBe(false); // 不允许一步内有人得币有人失币（即玩家间转币）
  expectOneEntryPerTransaction(prev, next);
}

/**
 * 不重复记账（M4 §13 第 2 项）：这一步里每个玩家的币变化，必须正好等于
 * 这一步新增的流水（得币 − 花费）。同一笔交易记两条账、或扣了钱没记账，
 * 都会在这里露馅 —— 光看终局合计是看不出来的。
 */
function expectOneEntryPerTransaction(prev: GameState, next: GameState) {
  const fresh = next.log.slice(prev.log.length).filter((e) => e.spend !== undefined);
  for (const p of next.players) {
    const before = prev.players.find((x) => x.id === p.id)!;
    const mine = fresh.filter((e) => e.playerId === p.id);
    const gained = mine
      .filter((e) => e.spend!.kind === 'gain')
      .reduce((sum, e) => sum + e.spend!.coins, 0);
    const spent = mine
      .filter((e) => e.spend!.kind !== 'gain')
      .reduce((sum, e) => sum + e.spend!.coins, 0);
    expect(
      p.coins - before.coins,
      `${p.id} 这一步的币变化要和新增流水一一对上（同一笔交易只记一次）`,
    ).toBe(gained - spent);
  }
}

/** 「看看钱花到哪了」流水：开局 + 得币 − 各组明细之和 == 终局钱包（逐条对账） */
function expectLedgerReconciles(state: GameState) {
  for (const p of state.players) {
    const l = moneyLedger(state, p.id);
    const gained = l.groups.find((g) => g.kind === 'gain')?.total ?? 0;
    const spent = l.groups
      .filter((g) => g.kind !== 'gain')
      .reduce((sum, g) => sum + g.total, 0);
    expect(
      l.startCoins + gained - spent,
      `${p.id} 流水明细要正好对到钱包`,
    ).toBe(p.coins);
    for (const g of l.groups) {
      expect(g.lines.length, `${p.id} 的「${g.label}」组要有逐条明细`).toBeGreaterThan(0);
      expect(g.lines.reduce((s, line) => s + line.coins, 0)).toBe(g.total);
    }
  }
}

function expectCompleteGame(r: SimulateResult, parentUses: Map<string, number>) {
  expect(r.error).toBeUndefined();
  expect(r.steps).toBeLessThan(5000);
  expect(r.state.phase).toBe('finished'); // 经过 feast + reflection
  expect(r.state.plates).toHaveLength(gameConfig.playerCount);
  expect(r.state.reflections).toHaveLength(gameConfig.playerCount);
  expect(r.state.players).toHaveLength(gameConfig.playerCount); // 无人出局
  for (const p of r.state.players) expect(p.recipeId).not.toBeNull();
  for (const n of parentUses.values()) expect(n).toBeLessThanOrEqual(1);
  expectLedgerReconciles(r.state);
}

/** 伙伴站：bot→真人换菜提议出现率（2400 局里按 组合×脚本 累计） */
const OFFER_STATS = new Map<string, number>();

describe('多种子整局模拟（200 种子 × 4 脚本 × 3 性格组合）', () => {
  for (const combo of COMBOS) {
    for (const { name, script } of SCRIPTS) {
      it(
        `${name} 真人脚本 × ${combo.name} bots：每局到达终局且不变量成立`,
        { timeout: 60000 },
        () => {
          for (const seed of SEEDS) {
            const parentUses = new Map<string, number>();
            const r = simulate({
              seed,
              humanCharacterId: 'chr-xiaohe',
              botPersonalities: combo.personalities,
              humanScript: script,
              onStep: (prev, _cmd, next, err) => checkInvariants(prev, next, parentUses, err),
            });
            expect(r.error, `seed=${seed}`).toBeUndefined();
            expectCompleteGame(r, parentUses);
            if (
              r.commands.some(
                (c) => c.type === 'PROPOSE_SWAP' && c.to === 'p0',
              )
            ) {
              const key = `${combo.name}/${name}`;
              OFFER_STATS.set(key, (OFFER_STATS.get(key) ?? 0) + 1);
            }
          }
        },
      );
    }
  }
});

describe('伙伴站换菜提议频率（addendum DECIDED a：降门槛后要有规律地出现）', () => {
  it('默认性格组合（mixed）下大部分对局至少 1 次提议给真人', () => {
    const scripts = ['first', 'random', 'frugal', 'tempted'];
    const mixed = scripts.reduce((s, n) => s + (OFFER_STATS.get(`mixed/${n}`) ?? 0), 0);
    // 实测约 70%，留足余量
    expect(mixed / (SEEDS.length * scripts.length)).toBeGreaterThanOrEqual(0.6);
  });

  it('全部 2400 局合计 ≥1/3 对局有提议给真人（跟风/冲动多、稳妥少）', () => {
    const total = [...OFFER_STATS.values()].reduce((a, b) => a + b, 0);
    expect(total / (SEEDS.length * SCRIPTS.length * COMBOS.length)).toBeGreaterThanOrEqual(
      0.33,
    );
  });
});

describe('确定性', () => {
  it('同种子两次模拟结果完全一致', () => {
    for (const seed of [1, 42, 777]) {
      const a = simulate({ seed, humanCharacterId: 'chr-xiaohe' });
      const b = simulate({ seed, humanCharacterId: 'chr-xiaohe' });
      expect(b.state).toEqual(a.state);
      expect(b.commands).toEqual(a.commands);
    }
  });

  it('不同脚本下也可复现（random 脚本同种子一致）', () => {
    const a = simulate({ seed: 9, humanCharacterId: 'chr-xiaohe', humanScript: humanScripts.random });
    const b = simulate({ seed: 9, humanCharacterId: 'chr-xiaohe', humanScript: humanScripts.random });
    expect(b.state).toEqual(a.state);
  });
});
