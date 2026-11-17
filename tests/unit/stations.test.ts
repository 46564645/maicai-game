import { describe, expect, it, afterEach } from 'vitest';
import { applyCommand } from '../../src/game/engine';
import { gameConfig } from '../../src/config/gameConfig';
import { cards, getIngredient } from '../../src/data/cards';
import { setLang } from '../../src/i18n/store';
import { boot, jumpTo, patchPlayer, actorOf, run } from './helpers';
import type { GameState } from '../../src/game/types';

function player(s: GameState, pid: string) {
  return s.players.find((p) => p.id === pid)!;
}

function setStall(s: GameState, ids: (string | null)[]): GameState {
  return { ...s, market: { ...s.market, stall: ids } };
}

describe('公交站', () => {
  it('第 1 圈收 2 币；后两圈免费通过', () => {
    let s = jumpTo(boot(), 1, 3);
    const a = actorOf(s);
    s = run(s, { type: 'PAY_BUS' });
    expect(player(s, a).coins).toBe(gameConfig.startCoins - 2);
    s = jumpTo(s, 2, 3);
    const b = actorOf(s);
    const before = player(s, b).coins;
    s = run(s, { type: 'PAY_BUS' });
    expect(player(s, b).coins).toBe(before);
  });

  it('钱不够→待付夹记欠费；之后得币先补车费', () => {
    let s = jumpTo(boot(), 1, 3);
    const a = actorOf(s);
    s = patchPlayer(s, a, { coins: 1 });
    s = run(s, { type: 'PAY_BUS' });
    expect(player(s, a).coins).toBe(0);
    expect(player(s, a).busDebt).toBe(1);
    // 到家长站拿 2 币：先补 1 币车费，钱包只多 1
    s = jumpTo(s, 1, 5, a);
    s = run(s, { type: 'PARENT_BEGIN' });
    for (const opt of ['pq1-opt-2', 'pq2-opt-1', 'pq3-opt-1', 'pq4-opt-1']) {
      s = run(s, { type: 'PARENT_ANSWER', answer: { mode: 'card', optionId: opt } });
    }
    expect(player(s, a).busDebt).toBe(0);
    expect(player(s, a).coins).toBe(1);
  });
});

describe('随机事件站', () => {
  it('天气决定事件类型：晴天只抽好事，雨/风只抽两选项事件', () => {
    const seen = new Map<string, boolean[]>();
    for (let seed = 1; seed <= 300; seed++) {
      const s = jumpTo(boot(seed), 1, 4, 'p0');
      const sub = s.turn!.sub;
      if (sub.kind === 'event' && sub.weatherId && sub.eventCardId) {
        const card = cards.events.find((e) => e.id === sub.eventCardId)!;
        seen.set(sub.weatherId, [...(seen.get(sub.weatherId) ?? []), card.isGood]);
      }
    }
    const sunny = seen.get('wth-sunny') ?? [];
    expect(sunny.length).toBeGreaterThan(0);
    expect(sunny.every(Boolean)).toBe(true); // 晴天全是好事卡
    for (const w of ['wth-rainy', 'wth-windy']) {
      const list = seen.get(w) ?? [];
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((g) => !g)).toBe(true); // 雨/风全是两选项事件卡
    }
  });

  it('满 2 次花钱事件后只抽好事卡；雨/风也跨天气回退到好事卡', () => {
    let sawBadWeather = 0;
    for (let seed = 1; seed <= 400 && sawBadWeather < 3; seed++) {
      let s = boot(seed);
      s = patchPlayer(s, 'p0', { paidEventCount: gameConfig.events.maxPaidPerPlayer });
      s = jumpTo(s, 1, 4, 'p0');
      const sub = s.turn!.sub;
      if (sub.kind === 'event' && sub.eventCardId) {
        const card = cards.events.find((e) => e.id === sub.eventCardId)!;
        expect(card.isGood, `seed=${seed}`).toBe(true);
        if (sub.weatherId !== 'wth-sunny') sawBadWeather++;
      }
    }
    expect(sawBadWeather).toBeGreaterThan(0); // 确实覆盖到了雨/风回合的回退
  });

  it('花钱事件每人最多 2 次：满 2 次后只能选不花钱，且只抽好事卡', () => {
    let s = boot();
    const pid = 'p0';
    s = patchPlayer(s, pid, { paidEventCount: 2, coins: 10 });
    s = jumpTo(s, 1, 4, pid);
    const sub = s.turn!.sub;
    expect(sub.kind).toBe('event');
    if (sub.kind === 'event') {
      const card = cards.events.find((e) => e.id === sub.eventCardId)!;
      expect(card.isGood).toBe(true);
    }
    const r = applyCommand(s, { type: 'CHOOSE_EVENT_OPTION', option: 'spend' });
    expect(r.error).toBe('ERR_LIMIT');
    s = run(s, { type: 'CHOOSE_EVENT_OPTION', option: 'free' });
    expect(player(s, pid).paidEventCount).toBe(2);
  });

  it('选花钱方案会扣币并计 1 次；钱不够不可选', () => {
    let s = boot();
    s = jumpTo(s, 1, 4, 'p0');
    const sub = s.turn!.sub;
    const card = cards.events.find(
      (e) => sub.kind === 'event' && e.id === sub.eventCardId,
    )!;
    const cost = card.spendOption.coins ?? 0;
    s = run(s, { type: 'CHOOSE_EVENT_OPTION', option: 'spend' });
    expect(player(s, 'p0').paidEventCount).toBe(1);
    expect(player(s, 'p0').coins).toBe(gameConfig.startCoins - cost);

    let s2 = boot();
    s2 = patchPlayer(s2, 'p0', { coins: 0 });
    s2 = jumpTo(s2, 1, 4, 'p0');
    const r = applyCommand(s2, { type: 'CHOOSE_EVENT_OPTION', option: 'spend' });
    expect(['ERR_NO_COINS', 'ERR_LIMIT']).toContain(r.error);
  });
});

describe('AI 家长站', () => {
  const answerCards = ['pq1-opt-2', 'pq2-opt-1', 'pq3-opt-1', 'pq4-opt-1'];

  it('说清 4 问→2 币；①②后「就这样吧」→1 币', () => {
    let s = jumpTo(boot(), 1, 5, 'p0');
    s = run(s, { type: 'PARENT_BEGIN' });
    for (const opt of answerCards) {
      s = run(s, { type: 'PARENT_ANSWER', answer: { mode: 'card', optionId: opt } });
    }
    expect(player(s, 'p0').coins).toBe(gameConfig.startCoins + 2);

    let s2 = jumpTo(boot(), 1, 5, 'p0');
    s2 = run(s2, { type: 'PARENT_BEGIN' });
    s2 = run(s2, { type: 'PARENT_ANSWER', answer: { mode: 'card', optionId: 'pq1-opt-2' } });
    s2 = run(s2, { type: 'PARENT_ANSWER', answer: { mode: 'card', optionId: 'pq2-opt-1' } });
    expect(s2.pendingDecision.kind).toBe('parentSettle');
    s2 = run(s2, { type: 'PARENT_SETTLE' });
    expect(player(s2, 'p0').coins).toBe(gameConfig.startCoins + 1);
  });

  it('打字关键词判定：命中→说清；判不出→留在本问', () => {
    let s = jumpTo(boot(), 1, 5, 'p0');
    s = run(s, { type: 'PARENT_BEGIN' });
    s = run(s, { type: 'PARENT_ANSWER', answer: { mode: 'text', text: 'umm…' } });
    expect(s.parentDialog?.step).toBe(0);
    expect(s.parentDialog?.cleared[0]).toBe(false);
    s = run(s, { type: 'PARENT_ANSWER', answer: { mode: 'text', text: 'I want 2 coins' } });
    expect(s.parentDialog?.step).toBe(1);
    expect(s.parentDialog?.cleared[0]).toBe(true);
    s = run(s, { type: 'PARENT_ANSWER', answer: { mode: 'text', text: 'buy veggies' } });
    expect(s.parentDialog?.cleared[1]).toBe(true);
  });

  it('每人每局只能用 1 次：用过后再到此站自动跳过', () => {
    let s = jumpTo(boot(), 1, 5, 'p0');
    s = run(s, { type: 'PARENT_BEGIN' });
    for (const opt of answerCards) {
      s = run(s, { type: 'PARENT_ANSWER', answer: { mode: 'card', optionId: opt } });
    }
    expect(player(s, 'p0').parentUsed).toBe(true);
    s = jumpTo(s, 2, 5, 'p0');
    // p0 已用过：prepareTurn 自动跳过，轮到下一位
    expect(s.pendingDecision.kind).toBe('parentUse');
    expect(actorOf(s)).not.toBe('p0');
    const r = applyCommand(s, { type: 'PARENT_BEGIN' });
    expect(r.error).toBeUndefined(); // 是下一位的合法命令
  });
});

describe('AI 家长站 · R9 写进日志的 AI 台词随界面语言', () => {
  afterEach(() => setLang('en'));

  it('判不出的兜底台词：中文模式进中文行，英文模式进 cards.json 英文原文', () => {
    setLang('zh');
    let s = jumpTo(boot(), 1, 5, 'p0');
    s = run(s, { type: 'PARENT_BEGIN' });
    s = run(s, { type: 'PARENT_ANSWER', answer: { mode: 'text', text: 'umm…' } });
    const zhLast = s.log[s.log.length - 1];
    expect(zhLast.text).toBe('没关系。我们一起选一张图卡。');
    expect(zhLast.asAi).toBe(true);

    setLang('en');
    let s2 = jumpTo(boot(), 1, 5, 'p0');
    s2 = run(s2, { type: 'PARENT_BEGIN' });
    s2 = run(s2, { type: 'PARENT_ANSWER', answer: { mode: 'text', text: 'umm…' } });
    const enLast = s2.log[s2.log.length - 1];
    expect(enLast.text).toBe(cards.parentStation.fallbackLine);
    expect(enLast.asAi).toBe(true);
  });

  it('中文模式：语音占位提示与批准台词也走中文（判定与币数不变）', () => {
    setLang('zh');
    let s = jumpTo(boot(), 1, 5, 'p0');
    s = run(s, { type: 'PARENT_BEGIN' });
    s = run(s, { type: 'PARENT_ANSWER', answer: { mode: 'voice' } });
    const voiceLast = s.log[s.log.length - 1];
    expect(voiceLast.text).toBe('语音还没准备好 — 点一张图卡吧。');
    expect(voiceLast.asAi).toBe(true);
    for (const opt of ['pq1-opt-2', 'pq2-opt-1', 'pq3-opt-1', 'pq4-opt-1']) {
      s = run(s, { type: 'PARENT_ANSWER', answer: { mode: 'card', optionId: opt } });
    }
    const approveLast = s.log[s.log.length - 1];
    expect(approveLast.text).toBe('好，说清楚了，给你 2 个币。');
    expect(approveLast.asAi).toBe(true);
    expect(player(s, 'p0').coins).toBe(gameConfig.startCoins + 2);
  });
});

describe('小卖部', () => {
  it('材料 = 市场价 + 1 币', () => {
    let s = jumpTo(boot(), 1, 6, 'p0');
    const ing = getIngredient('ing-tomato')!;
    s = run(s, { type: 'STORE_BUY', ingredientId: 'ing-tomato' });
    expect(player(s, 'p0').coins).toBe(
      gameConfig.startCoins - ing.marketPrice - gameConfig.store.markup,
    );
  });

  it('「先等等」夹在小卖部按原价买，不加价；也可放弃', () => {
    let s = jumpTo(boot(), 1, 1, 'p0');
    s = setStall(s, ['ing-potato', 'ing-egg', 'tmp-sticker', 'ing-greens', 'ing-tofu', null]);
    s = run(s, { type: 'STALL_HOLD', cardId: 'ing-potato' });
    expect(player(s, 'p0').holdClip).toBe('ing-potato');
    const price = getIngredient('ing-potato')!.marketPrice;
    s = jumpTo(s, 1, 6, 'p0');
    s = run(s, { type: 'RESOLVE_HOLD', buy: true });
    expect(player(s, 'p0').coins).toBe(gameConfig.startCoins - price); // 原价，不是 +1
    expect(player(s, 'p0').holdClip).toBeNull();

    let s2 = jumpTo(boot(), 1, 1, 'p0');
    s2 = setStall(s2, ['ing-potato', null, null, null, null, null]);
    s2 = run(s2, { type: 'STALL_HOLD', cardId: 'ing-potato' });
    s2 = jumpTo(s2, 1, 6, 'p0');
    s2 = run(s2, { type: 'RESOLVE_HOLD', buy: false });
    expect(player(s2, 'p0').holdClip).toBeNull();
    expect(player(s2, 'p0').coins).toBe(gameConfig.startCoins);
  });
});

describe('菜市场', () => {
  it('摊位牌堆里食材与诱惑品混排（含玩具 tmp-toy）', () => {
    const s = boot();
    const pool = [...s.market.stall, ...s.market.deck].filter((x): x is string => x !== null);
    expect(pool).toContain('tmp-toy');
    expect(pool.some((id) => id.startsWith('tmp-'))).toBe(true);
    expect(pool.some((id) => id.startsWith('ing-'))).toBe(true);
  });

  it('每次到站最多买 2 张、先等等最多 1 张；买走的卡补满 6 张', () => {
    let s = jumpTo(boot(), 1, 1, 'p0');
    s = setStall(s, ['ing-tomato', 'ing-egg', 'ing-greens', 'ing-tofu', 'ing-pork', 'ing-fish']);
    s = run(s, { type: 'STALL_BUY', cardId: 'ing-tomato' });
    s = run(s, { type: 'STALL_BUY', cardId: 'ing-egg' });
    const r = applyCommand(s, { type: 'STALL_BUY', cardId: 'ing-greens' });
    expect(r.error).toBe('ERR_LIMIT');
    s = run(r.state, { type: 'STALL_HOLD', cardId: 'ing-greens' });
    const r2 = applyCommand(s, { type: 'STALL_HOLD', cardId: 'ing-tofu' });
    expect(r2.error).toBe('ERR_LIMIT');
    expect(s.market.stall.filter((x) => x !== null)).toHaveLength(6);
  });
});

describe('伙伴站', () => {
  it('交换一换一、不发生币转移；真人可拒绝', () => {
    let s = jumpTo(boot(), 1, 2, 'p1');
    s = patchPlayer(s, 'p1', { extras: ['ing-egg'] });
    s = patchPlayer(s, 'p0', { extras: ['ing-greens'] });
    const coinsBefore = s.players.map((p) => p.coins);
    // bot 的邀请卡回应
    s = run(s, { type: 'RESPOND_INVITE', proposalId: s.pendingDecision.kind === 'inviteResponse' ? s.pendingDecision.proposalId : 'x', accept: false });
    s = run(s, { type: 'PROPOSE_SWAP', to: 'p0', giveCardId: 'ing-egg', wantCardId: 'ing-greens' });
    expect(s.proposals).toHaveLength(1);
    s = run(s, { type: 'RESPOND_SWAP', proposalId: s.proposals[0].id, accept: true });
    expect(player(s, 'p1').extras).toEqual(['ing-greens']);
    expect(player(s, 'p0').extras).toEqual(['ing-egg']);
    expect(s.players.map((p) => p.coins)).toEqual(coinsBefore);

    // 拒绝路径：再发一次，真人说不
    s = patchPlayer(s, 'p1', { extras: ['ing-egg'] });
    s = patchPlayer(s, 'p0', { extras: ['ing-greens'] });
    // 清掉 humanOffered 限制（本站已用过一次提议）——直接重置子状态模拟新一站
    s = jumpTo(s, 2, 2, 'p1');
    s = patchPlayer(s, 'p1', { extras: ['ing-egg'] });
    s = patchPlayer(s, 'p0', { extras: ['ing-greens'] });
    s = run(s, { type: 'RESPOND_INVITE', proposalId: s.pendingDecision.kind === 'inviteResponse' ? s.pendingDecision.proposalId : 'x', accept: false });
    s = run(s, { type: 'PROPOSE_SWAP', to: 'p0', giveCardId: 'ing-egg', wantCardId: 'ing-greens' });
    s = run(s, { type: 'RESPOND_SWAP', proposalId: s.proposals[0].id, accept: false });
    expect(player(s, 'p1').extras).toEqual(['ing-egg']);
    expect(player(s, 'p0').extras).toEqual(['ing-greens']);
    expect(s.players.map((p) => p.coins)).toEqual(coinsBefore);
  });

  it('邀请卡一起买：各付各的份，凑够人数才拿卡；不够退款', () => {
    let s = jumpTo(boot(), 1, 2); // 本站顺序 [p2,p3,p0,p1]
    const sub = s.turn!.sub;
    const invite = cards.invites.find(
      (i) => sub.kind === 'partner' && i.id === sub.inviteCardId,
    )!;
    // 前两人加入
    for (let i = 0; i < 4; i++) {
      const accept = i < 2;
      const pid = actorOf(s);
      const before = player(s, pid).coins;
      s = run(s, {
        type: 'RESPOND_INVITE',
        proposalId: s.pendingDecision.kind === 'inviteResponse' ? s.pendingDecision.proposalId : 'x',
        accept: accept && before >= invite.eachCost,
      });
      s = run(s, { type: 'END_TURN' });
    }
    // 结算：加入的两人各付各的，拿到卡
    expect(s.players.filter((p) => p.temptations.includes(invite.giveCardId))).toHaveLength(2);
  });

  it('接受邀请只扣自己的 eachCost，别人的币不变（eachPaysOwnShare）', () => {
    let s = jumpTo(boot(), 1, 2);
    const sub = s.turn!.sub;
    const invite = cards.invites.find(
      (i) => sub.kind === 'partner' && i.id === sub.inviteCardId,
    )!;
    const pid = actorOf(s);
    const before = player(s, pid).coins;
    const othersBefore = s.players.filter((p) => p.id !== pid).map((p) => p.coins);
    s = run(s, {
      type: 'RESPOND_INVITE',
      proposalId: s.pendingDecision.kind === 'inviteResponse' ? s.pendingDecision.proposalId : 'x',
      accept: true,
    });
    expect(player(s, pid).coins).toBe(before - invite.eachCost);
    expect(s.players.filter((p) => p.id !== pid).map((p) => p.coins)).toEqual(othersBefore);
  });

  it('一起买没凑够人：已付的币退回', () => {
    let s = jumpTo(boot(), 1, 2);
    const joiner = actorOf(s);
    s = run(s, {
      type: 'RESPOND_INVITE',
      proposalId: s.pendingDecision.kind === 'inviteResponse' ? s.pendingDecision.proposalId : 'x',
      accept: true,
    });
    s = run(s, { type: 'END_TURN' });
    for (let i = 0; i < 3; i++) {
      s = run(s, {
        type: 'RESPOND_INVITE',
        proposalId: s.pendingDecision.kind === 'inviteResponse' ? s.pendingDecision.proposalId : 'x',
        accept: false,
      });
      s = run(s, { type: 'END_TURN' });
    }
    expect(player(s, joiner).coins).toBe(gameConfig.startCoins); // 钱退回来了
  });
});
