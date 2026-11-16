/**
 * moneyLedger.test.ts —— G6「看看钱花到哪了」流水（PLAN 4.1.8 类纯派生）。
 * 校验：分组小计、币守恒（开局 + 得币 − 花费 = 剩余）、只记自己的账。
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/game/engine';
import { moneyLedger } from '../../src/game/selectors';
import { getPlayer } from '../../src/game/stations/shared';
import { simulate, humanScripts } from '../../src/game/simulate';
import { gameConfig } from '../../src/config/gameConfig';
import { boot, jumpTo } from './helpers';

const totals = (l: ReturnType<typeof moneyLedger>) =>
  Object.fromEntries(l.groups.map((g) => [g.kind, g.total]));

describe('moneyLedger', () => {
  it('开局：只有起始币，没有任何账', () => {
    const l = moneyLedger(boot(1), 'p0');
    expect(l.startCoins).toBe(gameConfig.startCoins);
    expect(l.coinsLeft).toBe(gameConfig.startCoins);
    expect(l.groups).toHaveLength(0);
  });

  it('菜市场买卡后记一笔对应分类的账', () => {
    const s = jumpTo(boot(1), 1, 1, 'p0'); // 菜市场，真人先动
    const cardId = s.market.stall.find((id) => id !== null)!;
    const r = applyCommand(s, { type: 'STALL_BUY', cardId });
    expect(r.error).toBeUndefined();
    const l = moneyLedger(r.state, 'p0');
    expect(l.groups).toHaveLength(1);
    expect(l.groups[0].total).toBeGreaterThan(0);
    expect(l.groups[0].lines).toHaveLength(1);
  });

  it('整局模拟后币守恒：开局 + 得币 − 花费 = 剩余，且只含自己的账', () => {
    const r = simulate({ seed: 7, humanCharacterId: 'chr-xiaohe', humanScript: humanScripts.tempted });
    expect(r.error).toBeUndefined();
    const me = getPlayer(r.state, 'p0');
    const l = moneyLedger(r.state, 'p0');
    const t = totals(l);
    const gained = t.gain ?? 0;
    const spent = (t.ingredient ?? 0) + (t.temptation ?? 0) + (t.bus ?? 0) + (t.event ?? 0);
    expect(l.coinsLeft).toBe(me.coins);
    expect(l.startCoins + gained - spent).toBe(me.coins);
    // 真人的账不含 bot 的动作
    for (const g of l.groups) {
      for (const line of g.lines) expect(line.text).not.toContain('Steady');
    }
  });

  it('多玩几个种子依然守恒', () => {
    for (const seed of [1, 2, 3, 11]) {
      const r = simulate({ seed, humanCharacterId: 'chr-xiaohe', humanScript: humanScripts.random });
      expect(r.error).toBeUndefined();
      const me = getPlayer(r.state, 'p0');
      const l = moneyLedger(r.state, 'p0');
      const t = totals(l);
      const gained = t.gain ?? 0;
      const spent = (t.ingredient ?? 0) + (t.temptation ?? 0) + (t.bus ?? 0) + (t.event ?? 0);
      expect(l.startCoins + gained - spent).toBe(me.coins);
    }
  });

  it('每个分组都有逐条明细（不允许只挂小计），且各组明细之和 == 分组小计', () => {
    for (const seed of [1, 25, 42]) {
      const r = simulate({ seed, humanCharacterId: 'chr-xiaoan', humanScript: humanScripts.random });
      expect(r.error).toBeUndefined();
      const l = moneyLedger(r.state, 'p0');
      for (const g of l.groups) {
        expect(g.lines.length, `${g.kind} 组要有明细条目`).toBeGreaterThan(0);
        expect(
          g.lines.reduce((sum, line) => sum + line.coins, 0),
          `${g.kind} 组明细之和要对上小计`,
        ).toBe(g.total);
        for (const line of g.lines) expect(line.text.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
