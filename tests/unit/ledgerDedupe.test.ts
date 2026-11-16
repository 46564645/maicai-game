/**
 * ledgerDedupe.test.ts —— M4 第 13 节第 2 项：「买了 鱼」「花 1 币买个新袋子」
 * 在流水里各出现两次的根因与回归测试。
 *
 * 结论（先复现、再修）：
 *  - 不是同一笔记了两次：两次都是真的扣了钱、真的拿到第二份东西，
 *    流水合计一直等于钱包（见 simulate.test.ts 的 2400 局对账）。
 *  - 「买了 鱼」：牌堆里每种食材 4 张，6 格摊位可能同时摆着两张「鱼」。
 *    买走一张只补那一格，另一张「鱼」还在；以前选中项按卡 id 记，
 *    买完仍停在「鱼」上，「买下」还是亮的 —— 再点一下就又买了第二张。
 *    现在：一次到站同一样东西只买一次（引擎 ERR_LIMIT），买完清空选中。
 *  - 「花 1 币买个新袋子」：随机事件站每圈重转天气，同一个事件卡可能在
 *    第 1 圈、第 2 圈各抽到一次；每次都是单独的一次 1 币交易（每人花钱事件
 *    上限 2 次）。现在流水每行标出「第 N 圈」，两笔同名账一眼能分开。
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/game/engine';
import { moneyLedger } from '../../src/game/selectors';
import { computePending, getPlayer } from '../../src/game/stations/shared';
import { cards } from '../../src/data/cards';
import { gameConfig } from '../../src/config/gameConfig';
import type { CardId, GameState } from '../../src/game/types';
import { boot, jumpTo, run } from './helpers';

function setStall(s: GameState, ids: (string | null)[]): GameState {
  return { ...s, market: { ...s.market, stall: ids } };
}

/** 把当前事件站回合钉成指定事件卡（引擎平时按天气随机抽） */
function pinEventCard(s: GameState, eventCardId: CardId, weatherId: CardId): GameState {
  const next: GameState = {
    ...s,
    turn: { ...s.turn!, sub: { kind: 'event', weatherId, eventCardId } },
  };
  return { ...next, pendingDecision: computePending(next) };
}

function spendLines(state: GameState, pid: string) {
  return moneyLedger(state, pid)
    .groups.flatMap((g) => g.lines.map((l) => ({ ...l, kind: g.kind })))
    .sort((a, b) => a.id - b.id);
}

describe('菜市场：同一次到站同一样东西只买一次（「买了 鱼」两次的修复）', () => {
  it('摊位摆着两张「鱼」：买第一张记一笔账，再点同一张不再扣钱、不再记账', () => {
    let s = jumpTo(boot(1), 1, 1, 'p0');
    // 牌堆里每种食材 4 张 → 6 格摊位真的可能同时出现两张鱼
    s = setStall(s, ['ing-fish', 'ing-tomato', 'ing-fish', 'ing-egg', 'ing-tofu', 'ing-greens']);
    const before = getPlayer(s, 'p0').coins;
    const fish = cards.ingredients.find((i) => i.id === 'ing-fish')!;

    s = run(s, { type: 'STALL_BUY', cardId: 'ing-fish' });
    const afterFirst = getPlayer(s, 'p0');
    expect(afterFirst.coins).toBe(before - fish.marketPrice);
    const fishLines = () =>
      s.log.filter((e) => e.playerId === 'p0' && e.spend?.kind === 'ingredient');
    expect(fishLines()).toHaveLength(1); // 一笔交易一条账

    // 第二张「鱼」还在摊位上，但同一次到站不能再买（以前这里会再扣 3 币、再记一条）
    const again = applyCommand(s, { type: 'STALL_BUY', cardId: 'ing-fish' });
    expect(again.error).toBe('ERR_LIMIT');
    expect(again.state).toBe(s); // 状态原样返回：不扣钱、不记账、不发卡
    expect(getPlayer(again.state, 'p0').coins).toBe(before - fish.marketPrice);
    expect(again.state.log).toHaveLength(s.log.length);
    // 同一站仍可买另一张不同的卡（每次最多 2 张的上限不变）
    const other = run(s, { type: 'STALL_BUY', cardId: 'ing-tomato' });
    expect(getPlayer(other, 'p0').coins).toBe(before - fish.marketPrice - 2);
  });

  it('买过的卡不再出现在可选命令里（界面按钮同步变灰）', () => {
    let s = jumpTo(boot(2), 1, 1, 'p0');
    s = setStall(s, ['ing-fish', 'ing-fish', 'ing-egg', 'ing-tofu', 'ing-greens', 'ing-tomato']);
    s = run(s, { type: 'STALL_BUY', cardId: 'ing-fish' });
    const sub = s.turn!.sub;
    expect(sub.kind).toBe('market');
    if (sub.kind === 'market') expect(sub.boughtIds).toContain('ing-fish');
    // 下一次到站（换一圈）重置：同一张卡可以再买，流水会标出新的圈数
    const nextLap = jumpTo(s, 2, 1, 'p0');
    const sub2 = nextLap.turn!.sub;
    if (sub2.kind === 'market') expect(sub2.boughtIds).toEqual([]);
  });
});

describe('小卖部：同一次到站同一样材料只补一次', () => {
  it('连点两下同一材料只扣一次钱、只记一条账', () => {
    let s = jumpTo(boot(3), 1, 6, 'p0');
    const ing = cards.ingredients.find((i) => i.id === 'ing-tomato')!;
    const before = getPlayer(s, 'p0').coins;
    s = run(s, { type: 'STORE_BUY', ingredientId: 'ing-tomato' });
    expect(getPlayer(s, 'p0').coins).toBe(before - ing.marketPrice - gameConfig.store.markup);
    const again = applyCommand(s, { type: 'STORE_BUY', ingredientId: 'ing-tomato' });
    expect(again.error).toBe('ERR_LIMIT');
    expect(again.state.log).toHaveLength(s.log.length);
    expect(getPlayer(again.state, 'p0').coins).toBe(
      before - ing.marketPrice - gameConfig.store.markup,
    );
  });
});

describe('随机事件站：同一事件卡在不同圈各记一笔，带各自的圈数', () => {
  it('第 1、2 圈都抽到「袋子破了」并各花 1 币 → 两笔真交易，合计 2 币，对得上钱包', () => {
    let s = boot(5);
    s = jumpTo(s, 1, 4, 'p0');
    s = pinEventCard(s, 'evt-bag-broken', 'wth-windy');
    s = run(s, { type: 'CHOOSE_EVENT_OPTION', option: 'spend' });
    s = jumpTo(s, 2, 4, 'p0');
    s = pinEventCard(s, 'evt-bag-broken', 'wth-windy');
    s = run(s, { type: 'CHOOSE_EVENT_OPTION', option: 'spend' });

    const bag = spendLines(s, 'p0').filter((l) =>
      l.text.includes('Spend 1 coin on a new bag'),
    );
    expect(bag).toHaveLength(2); // 两次真交易，不是同一笔记重
    expect(bag.map((l) => l.lap)).toEqual([1, 2]); // 各带自己的圈数，界面能分开
    expect(bag.every((l) => l.kind === 'event' && l.coins === 1)).toBe(true);

    // 流水合计仍等于钱包：开局 − 2 笔意外
    const l = moneyLedger(s, 'p0');
    const spent = l.groups
      .filter((g) => g.kind !== 'gain')
      .reduce((sum, g) => sum + g.total, 0);
    const gained = l.groups.find((g) => g.kind === 'gain')?.total ?? 0;
    expect(l.startCoins + gained - spent).toBe(getPlayer(s, 'p0').coins);
    expect(l.coinsLeft).toBe(gameConfig.startCoins - 2);
  });
});

describe('一起买记账（第 13 节第 1 项：复核，不改）', () => {
  it('邀请卡只有冰棍/贴纸两种，加入一起买记在「诱惑品」组', () => {
    // 卡面数据保证：两张邀请卡送的都是诱惑品
    for (const invite of cards.invites) {
      expect(cards.temptations.some((t) => t.id === invite.giveCardId)).toBe(true);
    }
    let s = jumpTo(boot(7), 1, 2, 'p0');
    const partnerSub = s.turn!.sub;
    if (partnerSub.kind !== 'partner') throw new Error('应该停在伙伴站');
    s = {
      ...s,
      turn: { ...s.turn!, sub: { ...partnerSub, inviteCardId: 'inv-popsicle' } },
    };
    s = run(s, { type: 'RESPOND_INVITE', proposalId: 'inv-1-2-p0', accept: true });
    const entry = s.log.find((e) => e.playerId === 'p0' && e.spend !== undefined)!;
    expect(entry.spend).toEqual({ kind: 'temptation', coins: 1 });
    const group = moneyLedger(s, 'p0').groups.find((g) => g.kind === 'temptation')!;
    expect(group.total).toBe(1);
    expect(group.lines).toHaveLength(1);
  });
});
