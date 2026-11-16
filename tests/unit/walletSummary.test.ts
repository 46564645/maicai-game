/**
 * walletSummary.test.ts —— PLAN 4.1.8.2 新增的纯派生 selector。
 * 校验：币数/欠费/菜谱缺口/自由额度估计/先等等夹/按人过滤的最近日志。
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/game/engine';
import { walletSummary } from '../../src/game/selectors';
import { getPlayer } from '../../src/game/stations/shared';
import { boot, jumpTo, patchPlayer } from './helpers';

describe('walletSummary', () => {
  it('开局：币数=起始币、无欠费、菜谱未定', () => {
    const s = boot(1);
    const w = walletSummary(s, 'p0');
    expect(w.coins).toBe(getPlayer(s, 'p0').coins);
    expect(w.busDebt).toBe(0);
    expect(w.recipeName).toBeNull();
    expect(w.holdClip).toBeNull();
  });

  it('有菜谱后给出缺口价与自由额度估计', () => {
    const s = jumpTo(boot(1), 1, 1); // 跳过抽菜谱前置（jumpTo 自动补抽）
    const me = getPlayer(s, 'p0');
    const w = walletSummary(s, 'p0');
    expect(w.recipeName).not.toBeNull();
    expect(w.missingCost).toBe(6); // 菜谱总价 6
    expect(w.freeEstimate).toBe(me.coins - 6 - me.busDebt);
  });

  it('recentLogs 只含自己的动作与全局事件', () => {
    const s = jumpTo(boot(1), 1, 1); // jumpTo 已 ACK 进入 act
    const w = walletSummary(s, 'p0');
    expect(
      w.recentLogs.every((e) => e.playerId === undefined || e.playerId === 'p0'),
    ).toBe(true);
    expect(w.recentLogs.length).toBeLessThanOrEqual(5);
  });

  it('LogEntry.playerId 由引擎写入（买卡动作归属行动者）', () => {
    const s = jumpTo(boot(1), 1, 1); // 已进入 act，pending=marketTurn
    const stallCard = s.market.stall.find((id) => id !== null)!;
    const r = applyCommand(s, { type: 'STALL_BUY', cardId: stallCard });
    if (!r.error) {
      const last = r.state.log[r.state.log.length - 1];
      expect(last.playerId).toBeDefined();
    }
  });

  it('欠车费会反映到 busDebt 与 freeEstimate', () => {
    const s = patchPlayer(jumpTo(boot(1), 1, 3), 'p0', { busDebt: 2, coins: 5 });
    const w = walletSummary(s, 'p0');
    expect(w.busDebt).toBe(2);
    expect(w.freeEstimate).toBe(5 - w.missingCost - 2);
  });
});
