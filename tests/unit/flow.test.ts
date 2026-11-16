import { describe, expect, it } from 'vitest';
import { initGame, applyCommand } from '../../src/game/engine';
import { simulate } from '../../src/game/simulate';
import { stationOrder } from '../../src/game/stations/shared';
import { gameConfig } from '../../src/config/gameConfig';
import { cards } from '../../src/data/cards';
import { boot, jumpTo, patchPlayer, run, tryRun } from './helpers';

describe('整局流程', () => {
  it('起始币：四个人一样多，等于 startCoins', () => {
    const s = boot();
    expect(s.players).toHaveLength(gameConfig.playerCount);
    for (const p of s.players) expect(p.coins).toBe(gameConfig.startCoins);
    expect(gameConfig.startCoins).toBe(12);
  });

  it('真人固定 p0，3 个 bot 有性格', () => {
    const s = boot();
    expect(s.players[0].isHuman).toBe(true);
    expect(s.players.slice(1).map((p) => p.personality)).toEqual([
      'steady',
      'impulsive',
      'follower',
    ]);
  });

  it('每站起始玩家轮换：相邻两站不同人，24 站每人各先 6 次', () => {
    const firsts: string[] = [];
    for (let lap = 1; lap <= 3; lap++) {
      for (let st = 0; st < 8; st++) firsts.push(stationOrder(lap, st)[0]);
    }
    for (let i = 1; i < firsts.length; i++) expect(firsts[i]).not.toBe(firsts[i - 1]);
    for (const pid of ['p0', 'p1', 'p2', 'p3']) {
      expect(firsts.filter((f) => f === pid)).toHaveLength(6);
    }
  });

  it('3 圈后进入开饭，4 盘同屏，再到反思页结束', () => {
    const r = simulate({ seed: 7, humanCharacterId: 'chr-xiaohe' });
    expect(r.error).toBeUndefined();
    expect(r.state.phase).toBe('finished');
    expect(r.state.plates).toHaveLength(4);
    expect(r.state.reflections).toHaveLength(4);
  });

  it('结局三种盘子：缺0→完整版、缺1→简化版、缺≥2→剪影盘', () => {
    let s = boot();
    const rec = cards.recipes[0];
    const [a, b, c] = rec.ingredientIds;
    s = patchPlayer(s, 'p0', { recipeId: rec.id, collected: [a, b, c] });
    s = patchPlayer(s, 'p1', { recipeId: rec.id, collected: [a, b] });
    s = patchPlayer(s, 'p2', { recipeId: rec.id, collected: [a] });
    s = patchPlayer(s, 'p3', { recipeId: rec.id, collected: [] });
    s = jumpTo(s, 3, 7); // 第 3 圈 · 回家做饭
    for (let i = 0; i < 4; i++) s = run(s, { type: 'ACK' });
    expect(s.phase).toBe('feast');
    const kind = (pid: string) => s.plates!.find((p) => p.playerId === pid)!.kind;
    expect(kind('p0')).toBe('full');
    expect(kind('p1')).toBe('simple');
    expect(kind('p2')).toBe('shadow');
    expect(kind('p3')).toBe('shadow');
    // 没有任何人出局
    expect(s.players).toHaveLength(4);
  });

  it('非法命令返回错误码且不改状态', () => {
    const s = jumpTo(boot(), 1, 1); // 菜市场 act
    const r1 = applyCommand(s, { type: 'PAY_BUS' });
    expect(r1.error).toBe('ERR_PHASE');
    expect(r1.state).toBe(s);
    const r2 = applyCommand(s, { type: 'STALL_BUY', cardId: 'no-such-card' });
    expect(r2.error).toBe('ERR_NO_CARD');
    expect(r2.state).toBe(s);
  });

  it('DEMO_JUMP：跳到指定站，没菜谱的自动补抽', () => {
    let s = initGame({ seed: 5 });
    s = run(s, { type: 'DEMO_JUMP', lap: 2, stationIndex: 4 });
    expect(s.phase).toBe('station');
    expect(s.lap).toBe(2);
    expect(s.stationIndex).toBe(4);
    for (const p of s.players) expect(p.recipeId).not.toBeNull();
  });

  it('RESTART：回到开场，币与状态重置', () => {
    let s = jumpTo(boot(), 1, 3);
    s = run(s, { type: 'PAY_BUS' });
    s = run(s, { type: 'RESTART' });
    expect(s.phase).toBe('intro');
    expect(s.log).toHaveLength(0);
    for (const p of s.players) {
      expect(p.coins).toBe(gameConfig.startCoins);
      expect(p.recipeId).toBeNull();
    }
  });

  it('DEMO_SET_PERSONALITY：可切 bot 性格，不能改真人', () => {
    let s = boot();
    s = run(s, { type: 'DEMO_SET_PERSONALITY', playerId: 'p1', personality: 'follower' });
    expect(s.players[1].personality).toBe('follower');
    const r = tryRun(s, {
      type: 'DEMO_SET_PERSONALITY',
      playerId: 'p0',
      personality: 'impulsive',
    });
    expect(r.error).toBe('ERR_INVALID');
  });

  it('TOGGLE_HELP 只计次不改其他状态；helpHints 返回中文提示', async () => {
    const { helpHints } = await import('../../src/game/selectors');
    let s = jumpTo(boot(), 1, 1);
    s = run(s, { type: 'TOGGLE_HELP' });
    expect(s.helpUsed).toBe(1);
    const h = helpHints(s, 'p0');
    expect(h.stationName).toBe('The Market');
    expect(h.coins).toBe(gameConfig.startCoins);
    expect(h.tip.length).toBeGreaterThan(0);
  });
});
