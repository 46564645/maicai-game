/**
 * r10d.test.ts —— R10 Slice D 五镜头优化轮单测。
 *
 * 教育层：
 *   education #5  脚手架随圈数退场（supportLevel/panelHintFor/botBubbleAllowed；
 *                 botThinkLine 气泡已按消息减负审计 B11 整体删除）
 *   education #7  事件「后果回声」分支判定（eventEchoKind）
 *   education #6  扇里相邻同卡的 ×2 徽标（adjacentDupCounts）
 * 交互层：
 *   interaction #4 触屏长按检视阈值（pressInspect）
 *   interaction #8 弹窗进出场 token 与 .popup-out 壳（CSS 验收）
 * UI 层：
 *   UI #8  「下一位」推导（nextActorId）+ 进度簇/徽标样式（CSS 验收）
 *   UI #7  商店格子卡整幅 contain（CSS 验收）
 * play 层：
 *   play #4 bot 性格徽标按人配色（botTrait + CSS 验收）
 * motion 层：
 *   --ease-out/--ease-in-out/--press-ms/--hand-raise-ms token 落地
 *   （CSS 验收：按钮 140ms / 手牌上抬 180ms / 弹窗进出双时长）
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error —— vitest 运行时是 node，内置模块无类型声明
import { readFileSync } from 'node:fs';
import { cards } from '../../src/data/cards';
import type { GameState } from '../../src/game/types';
import {
  botBubbleAllowed,
  panelHintFor,
  supportLevel,
} from '../../src/ui/supportLevel';
import { eventEchoKind } from '../../src/ui/eventEcho';
import { adjacentDupCounts } from '../../src/ui/dupBadges';
import {
  INSPECT_CANCEL_PX,
  LONG_PRESS_MS,
  inspectCancelled,
  longPressReached,
} from '../../src/components/cards/pressInspect';
import { nextActorId } from '../../src/ui/nextActor';
import { botTrait } from '../../src/ui/botTrait';
import { boot } from './helpers';

const readSrc = (rel: string) => readFileSync(`src/${rel}`, 'utf8');
const cardsCss = readSrc('components/cards/cards.css');
const tokensCss = readSrc('theme/tokens.css');
const hudCss = readSrc('hud.css');
const baseCss = readSrc('theme/base.css');
const boardCss = readSrc('board.css');

function cssBlock(css: string, selector: string): string {
  const i = css.indexOf(selector);
  expect(i, `缺少选择器 ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

/* ============ education #5：脚手架随圈数退场 ============ */
describe('supportLevel（education #5）', () => {
  it('第 1 圈全扶持 / 第 2 圈半扶持 / 第 3 圈撤扶持', () => {
    expect(supportLevel(1)).toBe(1);
    expect(supportLevel(2)).toBe(2);
    expect(supportLevel(3)).toBe(3);
  });
  it('越界 lap 收敛到档位（0 当第 1 圈，>3 当第 3 圈）', () => {
    expect(supportLevel(0)).toBe(1);
    expect(supportLevel(99)).toBe(3);
  });
});

describe('panelHintFor（education #5：市场/小卖部说明句）', () => {
  it('1 圈整句 / 2 圈图标+短句 / 3 圈撤掉', () => {
    expect(panelHintFor(1)).toBe('full');
    expect(panelHintFor(2)).toBe('compact');
    expect(panelHintFor(3)).toBe('none');
  });
});

describe('botBubbleAllowed（education #5：bot 心里话气泡撤扶持）', () => {
  it('第 1 圈任何气泡都冒', () => {
    expect(botBubbleAllowed(1, false)).toBe(true);
    expect(botBubbleAllowed(1, true)).toBe(true);
  });
  it('第 2 圈起只留「先等等」气泡', () => {
    expect(botBubbleAllowed(2, true)).toBe(true);
    expect(botBubbleAllowed(2, false)).toBe(false);
    expect(botBubbleAllowed(3, true)).toBe(true);
    expect(botBubbleAllowed(3, false)).toBe(false);
  });
});

/* 消息减负审计 B11：botThinkLine 与心里话气泡已整体删除（botThink.ts
   退役）——本 describe 随面移除；botBubbleAllowed 的圈数口径仍由
   supportLevel 的 describe 覆盖（上文） */

/* ============ education #7：事件「后果回声」分支判定 ============ */
describe('eventEchoKind（education #7）', () => {
  it('花了 0 币（免费项）→ free', () => {
    expect(eventEchoKind(0, 10, 5)).toBe('free');
    expect(eventEchoKind(0, 0, 0)).toBe('free');
  });
  it('花了币且剩余 ≥ 菜谱缺口 → spendOk（买菜钱还够）', () => {
    expect(eventEchoKind(3, 9, 9)).toBe('spendOk'); // 恰好持平仍算够
    expect(eventEchoKind(3, 12, 9)).toBe('spendOk');
  });
  it('花进菜谱缺口 → spendGap（提示还差多少）', () => {
    expect(eventEchoKind(3, 8, 9)).toBe('spendGap');
    expect(eventEchoKind(5, 0, 1)).toBe('spendGap');
  });
});

/* ============ education #6：相邻同卡 ×n 徽标 ============ */
describe('adjacentDupCounts（education #6）', () => {
  const id = (t: string | null) => t;
  it('空列 / 全不同 → 全 null', () => {
    expect(adjacentDupCounts<string>([], id)).toEqual([]);
    expect(adjacentDupCounts(['a', 'b', 'c'], id)).toEqual([null, null, null]);
  });
  it('相邻连号 >1 → 每个位上都写连号数', () => {
    expect(adjacentDupCounts(['a', 'a', 'b'], id)).toEqual([2, 2, null]);
    expect(adjacentDupCounts(['a', 'b', 'b'], id)).toEqual([null, 2, 2]);
    expect(adjacentDupCounts(['a', 'a', 'a'], id)).toEqual([3, 3, 3]);
  });
  it('不相邻的同卡不算（按位置连号，不是全局分组）', () => {
    expect(adjacentDupCounts(['a', 'b', 'a'], id)).toEqual([null, null, null]);
    expect(adjacentDupCounts(['a', 'a', 'b', 'a'], id)).toEqual([
      2, 2, null, null,
    ]);
  });
  it('null 键（空摊位槽）不连号也不打断语义', () => {
    expect(adjacentDupCounts(['a', null, 'a'], id)).toEqual([null, null, null]);
    expect(adjacentDupCounts([null, null], id)).toEqual([null, null]);
  });
  it('市场摊位混合列：同卡并排的才贴徽', () => {
    expect(adjacentDupCounts(['x', 'x', 'y', 'z', 'z'], id)).toEqual([
      2, 2, null, 2, 2,
    ]);
  });
});

/* ============ interaction #4：触屏长按检视 ============ */
describe('pressInspect（interaction #4：长按 300ms / 挪 14px 让位拖拽）', () => {
  it('300ms 阈值：差 1ms 不开、到点开、超时照开', () => {
    expect(LONG_PRESS_MS).toBe(300);
    expect(longPressReached(LONG_PRESS_MS - 1)).toBe(false);
    expect(longPressReached(LONG_PRESS_MS)).toBe(true);
    expect(longPressReached(800)).toBe(true);
  });
  it('14px 阈值：界内不取消，超界取消（严格大于）', () => {
    expect(INSPECT_CANCEL_PX).toBe(14);
    expect(inspectCancelled(0, 0)).toBe(false);
    expect(inspectCancelled(9, 9)).toBe(false); // √162 ≈ 12.7px
    expect(inspectCancelled(14, 0)).toBe(false); // 恰在阈值
    expect(inspectCancelled(15, 0)).toBe(true);
    expect(inspectCancelled(11, 11)).toBe(true); // √242 ≈ 15.6px
  });
  it('比拖拽阈值（touch 18px）略小：检视先让位给拖拽', () => {
    expect(INSPECT_CANCEL_PX).toBeLessThan(18);
  });
});

/* ============ UI #8：「下一位」推导 ============ */
describe('nextActorId（UI #8：回合条「下一位」高亮）', () => {
  const st = boot(7); // intro 阶段，turn.order 已定
  const order = st.turn!.order;
  it('intro 阶段：下一位 = order[0]（马上要行动的人）', () => {
    expect(nextActorId(st)).toBe(order[0]);
  });
  it('act 阶段：下一位 = order[orderIndex+1]', () => {
    const s: GameState = {
      ...st,
      turn: { ...st.turn!, turnPhase: 'act', orderIndex: 0 },
    };
    expect(nextActorId(s)).toBe(order[1]);
    const s2: GameState = {
      ...st,
      turn: { ...st.turn!, turnPhase: 'act', orderIndex: 2 },
    };
    expect(nextActorId(s2)).toBe(order[3]);
  });
  it('最后一位行动完 → null（无下一位）', () => {
    const s: GameState = {
      ...st,
      turn: { ...st.turn!, turnPhase: 'act', orderIndex: order.length - 1 },
    };
    expect(nextActorId(s)).toBeNull();
  });
  it('无 turn（非站内阶段）→ null', () => {
    const s: GameState = { ...st, turn: null };
    expect(nextActorId(s)).toBeNull();
  });
  it('done 阶段 → null（不预告下一站）', () => {
    const s: GameState = {
      ...st,
      turn: { ...st.turn!, turnPhase: 'done' },
    };
    expect(nextActorId(s)).toBeNull();
  });
});

/* ============ play #4：bot 性格徽标 ============ */
describe('botTrait（play #4：性格小徽标 = 图标 + 1–2 字）', () => {
  const st = boot(7);
  it('真人无徽标', () => {
    const human = st.players.find((p) => p.isHuman)!;
    expect(botTrait(human)).toBeNull();
  });
  it('每个 bot 的徽标 key = 引擎性格；图标来自既有 bot 卡数据', () => {
    for (const bot of st.players.filter((p) => !p.isHuman)) {
      const trait = botTrait(bot);
      expect(trait).not.toBeNull();
      expect(trait!.key).toBe(bot.personality);
      const card = cards.bots.find((b) => b.id === bot.characterId)!;
      expect(trait!.icon).toBe(card.icon);
      expect(trait!.label.length).toBeGreaterThan(0);
      expect(trait!.label.length).toBeLessThanOrEqual(2);
    }
  });
  it('三种性格三种 key（accent 类各走各的 token）', () => {
    const keys = st.players
      .filter((p) => !p.isHuman)
      .map((p) => botTrait(p)!.key);
    expect(new Set(keys).size).toBe(keys.length > 1 ? 3 : keys.length);
  });
  it('characterId 对不上任何 bot 卡 → null（容错，不崩）', () => {
    const ghost = { ...st.players[1], characterId: 'bot-nobody' };
    expect(botTrait(ghost)).toBeNull();
  });
});

/* ============ motion：缓动/时长 token 落地 ============ */
describe('motion tokens（--ease-out/--ease-in-out + 按用途时长）', () => {
  it('--ease-out / --ease-in-out 曲线就位', () => {
    expect(tokensCss).toContain('--ease-out: cubic-bezier(0.23, 1, 0.32, 1)');
    expect(tokensCss).toContain('--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)');
  });
  it('按压 140ms / 手牌上抬 180ms / 弹窗 180+160ms token 就位', () => {
    expect(tokensCss).toContain('--press-ms: 140ms');
    expect(tokensCss).toContain('--hand-raise-ms: 180ms');
    expect(tokensCss).toContain('--popup-in-ms: 180ms');
    expect(tokensCss).toContain('--popup-out-ms: 160ms');
  });
  it('按钮 transform/box-shadow 按压走 --press-ms + --ease-out（无过冲）', () => {
    const block = cssBlock(baseCss, '.btn {');
    expect(block).toContain('transform var(--press-ms) var(--ease-out)');
    expect(block).not.toContain('--ease-spring');
  });
  it('手牌上抬/邻卡让位走 --hand-raise-ms + --ease-out', () => {
    const block = cssBlock(cardsCss, '.hand-item {');
    expect(block).toContain('transform var(--hand-raise-ms) var(--ease-out)');
  });
});

/* ============ interaction #4/#6/#8 + UI #7/#8 CSS 验收 ============ */
describe('Slice D 交付样式验收', () => {
  it('触屏长按检视：hand-item--inspect 直立 + 放大 1.15 + 名签浮出', () => {
    const block = cssBlock(cardsCss, '.hand-item--inspect {');
    expect(block).toContain('scale(1.15)');
    expect(cssBlock(cardsCss, '.hand-item--inspect .hand-tag')).toContain(
      'display: block',
    );
  });
  it('相邻同卡徽标 .hand-badge 落卡角（presentation-only，不拦指针）', () => {
    const block = cssBlock(cardsCss, '.hand-badge {');
    expect(block).toContain('position: absolute');
    expect(block).toContain('pointer-events: none');
  });
  it('「可点不可打」：拒付 = 卡面+价格宝石单次柔红晕脉冲（不摇不闪）', () => {
    // F20/F21（WS5）：横摇与红闪撤除，换成 Border Glow warn 变体的
    // 单次柔红晕脉冲——卡面一圈 + 价格宝石一圈，同脉冲同色系
    const deny = cssBlock(cardsCss, '.card-deny {');
    expect(deny).toContain('pglow-warn-pulse');
    expect(deny).not.toContain('shake');
    const gem = cssBlock(cardsCss, '.card-deny .card-view-gem {');
    expect(gem).toContain('pglow-warn-pulse');
    // 旧的横摇/红闪 keyframe 已移除
    expect(cardsCss).not.toContain('card-deny-shake');
    expect(cardsCss).not.toContain('gem-deny-flash');
  });
  it('事件后果回声行：正常态薄荷底 / 缺口态警示底', () => {
    expect(cssBlock(cardsCss, '.panel-echo {')).toContain('var(--color-mint)');
    expect(cssBlock(cardsCss, '.panel-echo--warn')).toContain(
      'var(--color-deny)',
    );
  });
  it('弹窗退场：PopupOutlet 壳 display:contents + .popup-out 淡出', () => {
    expect(cssBlock(hudCss, '.popup-shell {')).toContain('display: contents');
    const out = cssBlock(hudCss, '.popup-out .popup {');
    expect(out).toContain('popup-out');
    expect(out).toContain('var(--popup-out-ms)');
  });
  it('商店格子卡：插画 object-fit contain 整幅可读', () => {
    // T-1 统一卡面后，contain 由卡面解剖的基规则统一保证（cards.css
    // .card-view-art-img），商店格不再有自己的 art 规则——断言随之
    // 指向基规则（意图不变：商店卡插画整幅可读、不裁）
    expect(cssBlock(cardsCss, '.card-view-art-img {')).toContain(
      'object-fit: contain',
    );
  });
  it('回合条「下一位」：上抬 + 墨描边（与选中卡同语言）', () => {
    const block = cssBlock(boardCss, '.order-chip--next {');
    expect(block).toContain('translateY(-3px)');
    expect(block).toContain('var(--color-ink)');
  });
  it('性格小徽已撤：常驻面无 bot-trait/think-trait，气泡只剩按人描边色', () => {
    // R-traits 清理：图标+1–2字缩写孩子读不懂——全词性格只活在详情
    // 层（ProfileCard pc-badge、伙伴站 swap-row-trait）；气泡保留与
    // 棋子/头像同色的描边作「谁在说」非文字线索
    expect(boardCss).not.toContain('.bot-trait');
    expect(boardCss).not.toContain('.think-trait');
    for (const k of ['steady', 'impulsive', 'follower']) {
      expect(cssBlock(boardCss, `.think-bubble--${k}`)).toContain(
        `var(--bot-accent-${k})`,
      );
    }
  });
  it('拒付反馈/检视有 reduced-motion 降级档（gentler，不一刀切零）', () => {
    // Slice D 区块的 reduce 档：卡摇/宝石闪撤动画，检视保留缩放
    const sliceD = cardsCss.slice(cardsCss.indexOf('R10 Slice D'));
    const rmIdx = sliceD.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(rmIdx).toBeGreaterThan(-1);
    expect(sliceD.slice(rmIdx)).toContain('.card-deny');
    expect(sliceD.slice(rmIdx)).toContain('scale(1.15)');
  });
});
