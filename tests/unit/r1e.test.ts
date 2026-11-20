/**
 * r1e.test.ts —— R1 定稿 E1–E9 中本轮修复项的单测。
 *
 * 纯函数层：
 *   botTiming      E3 bot 回合阶梯延迟与总预算（典型 3–5 条 ≤2s）
 *   weatherMoment  E3 bot 天气简版换布景等待（400ms，远小于真人整圈）
 *   Deck           E2 翻牌时长（560 / reduced 120）
 * 源码/CSS 断言（沿 r10e 体例，readFileSync）：
 *   E6 BoardMount 外层 fallback 不带 children
 *   E2 EventPanel spin 可点跳过 / CookPanel 等待段可点 / CameraRig reduced 兜底
 *   E3 Scene bot 简版不推近 + Game 自动高光 ~1s 角落态 + 快进信号接线
 *   E4 bot 三处可见数字（BotCard / order-chip / phone-bot）
 *   E7 phone.css 栏内主按钮统一 white-space: normal + board-enter 拆盒
 *   E9 ProfileCard 登记与头注（MIT + Commons Clause、无摄像头/着色器）
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error —— vitest 运行时是 node，内置模块无类型声明
import { readFileSync } from 'node:fs';
import {
  BOT_TURN_BUDGET_MS,
  BOT_TURN_HARD_CAP_MS,
  botCommandDelayCappedMs,
  botCommandDelayMs,
  botTurnTotalCappedMs,
  botTurnTotalMs,
} from '../../src/ui/botTiming';
import { awaitingHumanKind } from '../../src/ui/awaitingHuman';
import { lapGainOf } from '../../src/ui/lapGain';
import type { GameState, LogEntry, PendingDecision, PlayerId } from '../../src/game/types';
import {
  botWeatherSettleMs,
  weatherCardDelayMs,
} from '../../src/ui/weatherMoment';
import { deckFlipMs } from '../../src/components/cards/Deck';
import { gameConfig } from '../../src/config/gameConfig';

const readSrc = (rel: string) => readFileSync(`src/${rel}`, 'utf8');
const phoneCss = readSrc('phone.css');
const boardCss = readSrc('board.css');
const gameTsx = readSrc('screens/Game.tsx');
const boardMount = readSrc('board/BoardMount.tsx');
const eventPanel = readSrc('components/EventPanel.tsx');
const cookPanel = readSrc('components/CookPanel.tsx');
const cameraRig = readSrc('board/three/CameraRig.tsx');
const scene = readSrc('board/three/Scene.tsx');
const botCard = readSrc('components/BotCard.tsx');
const notices = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
const profileCard = readSrc('components/cards/ProfileCard.tsx');
const hudCss = readSrc('hud.css');
const tokensCss = readSrc('theme/tokens.css');
const toastTsx = readSrc('components/Toast.tsx');
const proposalPill = readSrc('components/ProposalPill.tsx');
const enDict = readSrc('i18n/en.ts');
const zhDict = readSrc('i18n/zh.ts');

/* ============ E3：bot 回合总预算 ============ */
describe('botTiming (E3)', () => {
  const base = gameConfig.timing.botDelayMs;
  it('阶梯：首条 = base，后续递减（250 → 120）', () => {
    expect(botCommandDelayMs(0, base)).toBe(base);
    expect(botCommandDelayMs(1, base)).toBe(250);
    expect(botCommandDelayMs(3, base)).toBe(250);
    expect(botCommandDelayMs(4, base)).toBe(120);
    expect(botCommandDelayMs(9, base)).toBe(120);
  });
  it('典型回合（3–5 条命令）总时长 ≤2s 预算', () => {
    for (const n of [3, 4, 5]) {
      expect(botTurnTotalMs(n, base), `${n} 条`).toBeLessThanOrEqual(
        BOT_TURN_BUDGET_MS,
      );
    }
    expect(botTurnTotalMs(3, base)).toBe(1300);
    expect(botTurnTotalMs(5, base)).toBe(1670);
  });
  it('长回合不失控：8 条也只在 ~2s 量级', () => {
    expect(botTurnTotalMs(8, base)).toBeLessThanOrEqual(2100);
  });
});

/* ============ E3 团队第 1 轮反馈：bot 自控段硬上限 ============ */
describe('botTiming hard cap (E3 round-1 feedback)', () => {
  const base = gameConfig.timing.botDelayMs;
  it('硬上限 = 3000ms（Thong 拍板口径）', () => {
    expect(BOT_TURN_HARD_CAP_MS).toBe(3000);
  });
  it('钳制后任何命令数的回合总时长都 ≤ 硬上限', () => {
    for (const n of [1, 3, 5, 8, 20, 50]) {
      expect(botTurnTotalCappedMs(n, base), `${n} 条`).toBeLessThanOrEqual(
        BOT_TURN_HARD_CAP_MS,
      );
    }
    // 典型回合在上限内，钳制不改变原阶梯总时长
    expect(botTurnTotalCappedMs(5, base)).toBe(botTurnTotalMs(5, base));
  });
  it('单条延迟被剩余空间钳制：快到上限只给剩余量、到上限给 0', () => {
    expect(botCommandDelayCappedMs(0, base, 0)).toBe(base);
    expect(botCommandDelayCappedMs(1, base, 100)).toBe(250);
    expect(botCommandDelayCappedMs(0, base, 2900)).toBe(100);
    expect(botCommandDelayCappedMs(0, base, 3000)).toBe(0);
    expect(botCommandDelayCappedMs(4, base, 9999)).toBe(0);
  });
  it('驱动层接线：useBotDriver 按硬上限走快进通道排空', () => {
    const driver = readSrc('ui/useBotDriver.ts');
    expect(driver).toContain('BOT_TURN_HARD_CAP_MS');
    expect(driver).toContain('botCommandDelayCappedMs');
    expect(driver).toContain('turnStartRef');
    expect(driver).toContain('ffKeyRef.current = key');
  });
});

/* ============ E3 团队第 1 轮反馈：等真人回应提议的状态行口径 ============ */
describe('awaitingHumanKind (round-1 feedback)', () => {
  const me = 'p-human';
  const bot = 'p-bot';
  it('等真人回应换菜 → swap；一起买 → invite', () => {
    const swapPd: PendingDecision = {
      kind: 'swapResponse',
      proposalId: 'x',
      playerId: me,
    };
    const invitePd: PendingDecision = {
      kind: 'inviteResponse',
      proposalId: 'y',
      playerId: me,
    };
    expect(awaitingHumanKind(swapPd, me)).toBe('swap');
    expect(awaitingHumanKind(invitePd, me)).toBe('invite');
  });
  it('回应者是 bot、或其他决策种类 → null（不覆盖状态行）', () => {
    expect(
      awaitingHumanKind(
        { kind: 'swapResponse', proposalId: 'x', playerId: bot },
        me,
      ),
    ).toBeNull();
    expect(
      awaitingHumanKind({ kind: 'marketTurn', playerId: me }, me),
    ).toBeNull();
    expect(awaitingHumanKind({ kind: 'none' }, me)).toBeNull();
  });
  it('Game 接线（R2 更新）：提议浮签卡 + 不再亮 bot 思考态 + 无任何计时提醒', () => {
    expect(gameTsx).toContain('awaitingHumanKind(pd, state.humanId)');
    expect(gameTsx).toContain('!awaitKind');
    /* R2 定稿：R1 的状态行短指令（swapWait/inviteWait）已被
       ProposalPill 浮签卡取代；10s 轻跳按第 2 轮更正整段撤除 */
    expect(gameTsx).toContain('<ProposalPill');
    expect(gameTsx).not.toContain('strings.bubble.swapWait');
    expect(gameTsx).not.toContain('strings.bubble.inviteWait');
    expect(gameTsx).not.toContain('bumpProposalBubble');
    expect(gameTsx).not.toContain('10_000');
  });
  it('浮签卡样式复用舞台浮签 token', () => {
    expect(boardCss).toContain('.board-await {');
    expect(boardCss).toContain('var(--stage-pill-bg)');
  });
});

/* ============ E3：bot 天气简版等待 ============ */
describe('bot weather settle (E3)', () => {
  it('bot 换布景等待 400ms，远小于真人整圈 1500ms', () => {
    expect(botWeatherSettleMs()).toBe(400);
    expect(botWeatherSettleMs()).toBeLessThan(weatherCardDelayMs(false));
  });
});

/* ============ E2：Deck 翻牌时长 ============ */
describe('deckFlipMs (E2)', () => {
  it('正常 560ms，reduced 120ms', () => {
    expect(deckFlipMs(false)).toBe(560);
    expect(deckFlipMs(true)).toBe(120);
  });
});

/* ============ E6：BoardMount fallback 不带 children ============ */
describe('BoardMount fallback (E6)', () => {
  it('外层 Boundary/Suspense 共用不带 children 的 fallbackBoard', () => {
    expect(boardMount).toContain('children={undefined}');
    expect(boardMount).toContain('fallback={fallbackBoard}');
    expect(boardMount).toContain('<Suspense fallback={fallbackBoard}>');
    // 带 children 的 Board2D 只剩「真回退」一条路径（!use3d）
    expect(boardMount).toContain('if (!use3d) return <Board2D {...props} />');
  });
});

/* ============ E2：三段可点击跳过 + CameraRig reduced 兜底 ============ */
describe('cinematic skip (E2)', () => {
  it('EventPanel：spin 段点击清定时器并按 landed 推进', () => {
    expect(eventPanel).toContain('const skipSpin = () =>');
    expect(eventPanel).toContain("nextWeatherPhase(p, 'landed')");
    expect(eventPanel).toContain("onClick={moment === 'spin' ? skipSpin : undefined}");
  });
  it('CookPanel：等待段点舞台立即显示成品大卡', () => {
    expect(cookPanel).toContain('const skipDishWait = () =>');
    expect(cookPanel).toContain('onClick={skipDishWait}');
    expect(cookPanel).toContain('cook-stage--waiting');
  });
  it('CameraRig：reduced-motion 时 focus 恒 auto（组件内兜底）', () => {
    expect(cameraRig).toContain("reducedMotion ? 'auto' : focusProp");
  });
  it('Deck：翻牌中点击清定时器立即回调（源码分支在位）', () => {
    const deck = readSrc('components/cards/Deck.tsx');
    expect(deck).toContain('if (flipping)');
    expect(deck).toContain('window.clearTimeout(timerRef.current)');
  });
});

/* ============ E3：bot 简版接线（Scene / Game / BotCard） ============ */
describe('bot lite mode wiring (E3)', () => {
  it('Scene：weatherQuick 或 reduced 时不推近；quick 传给 3D 转盘', () => {
    expect(scene).toContain('!board.weatherQuick');
    expect(scene).toContain('quick={board.weatherQuick ?? false}');
  });
  it('Game：自动高光 ~1s 且只点亮角落小卡（全屏帘仅 manual）', () => {
    expect(gameTsx).toContain('spot?.manual &&');
    expect(gameTsx).toContain('autoSpot={spot?.id === b.id && !spot.manual}');
    expect(gameTsx).toContain('botWeatherSettleMs()');
    expect(gameTsx).not.toContain('}, 1900);');
    expect(gameTsx).not.toContain('2600,');
  });
  it('Game：点正在行动的 bot 小卡发快进信号', () => {
    expect(gameTsx).toContain('fastForwardBotTurn(id)');
    expect(gameTsx).toContain('onOpen={openBotSpot}');
  });
  it('角落高光样式在位（桌面 + 手机）', () => {
    expect(boardCss).toContain('.bot-card--spot {');
    expect(phoneCss).toContain('.phone-bot--spot {');
  });
});

/* ============ E4：bot 三处可见数字 ============ */
describe('bot coin numerals (E4)', () => {
  it('BotCard 金币点旁有可见数字 span', () => {
    expect(botCard).toContain('bot-coin-num');
    expect(botCard).toContain('{player.coins}');
  });
  it('Game 的 order-chip 与 phone-bot 各补数字 span', () => {
    expect(gameTsx).toContain('order-chip-num');
    expect(gameTsx).toContain('phone-bot-num');
  });
  it('数字样式等宽（tabular-nums）', () => {
    expect(boardCss).toContain('.bot-coin-num {');
    expect(boardCss).toContain('.order-chip-num {');
    expect(phoneCss).toContain('.phone-bot-num {');
  });
});

/* ============ E7：栏内主按钮不溢出 ============ */
describe('phone primary buttons (E7)', () => {
  it('.phone-turn .btn 与 .panel-actions .btn 统一 white-space: normal', () => {
    expect(phoneCss).toContain(
      '.game-screen--phone-land .phone-turn .btn,\n.game-screen--phone-land .panel-actions .btn {\n  white-space: normal;\n}',
    );
  });
  it('.phone-turn 内 kbd 提示不渲染盒', () => {
    expect(phoneCss).toContain('.phone-turn .btn-kbd-hint {\n  display: none;\n}');
  });
  it('Game：board-enter 主文案与 kbd 提示已拆成同级盒', () => {
    expect(gameTsx).toContain('board-enter-label');
    expect(gameTsx).toContain('strings.game.enterStationKbd');
  });
});

/* ============ E9：ProfileCard 出处登记 ============ */
describe('ProfileCard provenance (E9)', () => {
  it('THIRD_PARTY_NOTICES：ProfileCard 与 ReflectiveCard 各立一条、同许可证', () => {
    expect(notices).toContain('ProfileCard →');
    expect(notices).toContain('ReflectiveCard →');
    expect(notices).toContain('MIT + Commons Clause');
    expect(notices).toContain('@hugeicons');
    expect(notices).toContain('WebGL2');
    expect(notices).not.toContain('自身无新借用');
  });
  it('ProfileCard.tsx 头注与登记互相指引，许可证写法一致', () => {
    expect(profileCard).toContain('MIT + Commons');
    expect(profileCard).toContain('THIRD_PARTY_NOTICES.md');
    expect(profileCard).toContain('48px 方块接触钮');
    expect(profileCard).not.toContain('44px');
  });
});


/* ============ R2-9：「+数字」口径统一（这一圈拿到的钱） ============ */
describe('lapGainOf (R2-9)', () => {
  const entry = (
    id: number,
    playerId: string,
    lap: number,
    kind: string | undefined,
    coins = 0,
  ): LogEntry =>
    ({
      id,
      text: 'x',
      playerId,
      lap,
      spend: kind ? { kind, coins } : undefined,
    }) as LogEntry;
  const stateWith = (log: LogEntry[], lap: number): GameState =>
    ({ log, lap }) as unknown as GameState;

  it('只累计当前圈、本人、gain 条目', () => {
    const s = stateWith(
      [
        entry(1, 'p-bot', 2, 'gain', 2),
        entry(2, 'p-bot', 2, 'gain', 1),
        entry(3, 'p-bot', 1, 'gain', 5), // 上一圈，不算
        entry(4, 'p-bot', 2, 'ingredient', 3), // 花费，不算
        entry(5, 'p-human', 2, 'gain', 4), // 别人，不算
        entry(6, 'p-bot', 2, undefined), // 无记账，不算
      ],
      2,
    );
    expect(lapGainOf(s, 'p-bot' as PlayerId)).toBe(3);
    expect(lapGainOf(s, 'p-human' as PlayerId)).toBe(4);
  });
  it('没有 gain 条目 → 0（角标不显示）', () => {
    const s = stateWith([entry(1, 'p-bot', 1, 'bus', 1)], 1);
    expect(lapGainOf(s, 'p-bot' as PlayerId)).toBe(0);
  });
  it('角落卡与顺序片同源：两处都经 lapGainOf 渲染 +n', () => {
    expect(botCard).toContain('lapGain');
    expect(botCard).toContain('bot-lap-gain');
    expect(gameTsx).toContain('lapGainOf(state, p.id)');
    expect(gameTsx).toContain('order-chip-gain');
  });
  it('金币点溢出尾徽在带数字的宿主全部关掉（+ 只表示得币）', () => {
    expect(botCard).toContain('hideExtra');
    expect(profileCard).toContain('hideExtra');
    expect(gameTsx).toContain('coin-dots--xs" hideExtra');
    expect(gameTsx).toContain('coin-pile-dots" hideExtra');
  });
});

/* ============ R2-3 / R2-4 / R2-6 / R2-12 / R2-17 源码断言 ============ */
describe('round-2 HUD batch (source assertions)', () => {
  it('R2-3 ProfileCard：桌面宽 ≥280px、标签不截断', () => {
    const m = tokensCss.match(/--pc-w:\s*(\d+)px/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(280);
    const cardsCss = readSrc('components/cards/cards.css');
    const badgeBlock = cardsCss.slice(cardsCss.indexOf('.pc-badge {'));
    expect(badgeBlock.slice(0, 600)).not.toContain('text-overflow: ellipsis');
    expect(boardCss).toContain('.game-screen--phone-land .pc');
  });
  it('R2-4 Toast：4s 自动消失、层级在弹窗之下', () => {
    expect(toastTsx).toContain('TOAST_VISIBLE_MS = 4000');
    expect(tokensCss).toContain('--toast-visible-ms: 4000ms');
    // R3 修复（ww 第 5 轮）：层级断言改关系式——不写死 z 数值，解析
    // 各层实际 z-index 断言相对次序：提示条必须在手机浮层（装着卡片
    // 与按钮）、右栏、站点弹窗、高光帘之下，任何一层的数值将来调整
    // 都不该让提示条爬到卡片/按钮上面去
    const zOf = (css: string, selector: string): number => {
      const i = css.indexOf(selector);
      expect(i, `selector ${selector}`).toBeGreaterThanOrEqual(0);
      const m = css.slice(i, i + 1500).match(/z-index:\s*(\d+)/);
      expect(m, `z-index under ${selector}`).not.toBeNull();
      return Number(m![1]);
    };
    const toastZ = zOf(hudCss, '.toast-stack {');
    expect(toastZ).toBeLessThan(zOf(phoneCss, '.phone-market-float,'));
    expect(toastZ).toBeLessThan(zOf(phoneCss, '.phone-rail {'));
    expect(toastZ).toBeLessThan(zOf(hudCss, '.popup-backdrop {'));
    expect(toastZ).toBeLessThan(zOf(boardCss, '.spotlight-veil {'));
    // (b) 提示条不拦点击：整层 pointer-events: none，按钮照常可点
    const toastBlock = hudCss.slice(hudCss.indexOf('.toast-stack {'), hudCss.indexOf('.toast-stack {') + 1500);
    expect(toastBlock).toContain('pointer-events: none');
    // (c) 提示条显示时不得被右栏/浮层整条遮住：基础规则不藏条；
    //     手机端只在浮层打开期间让位（:has 条件式隐藏，浮层关条即回），
    //     且手机定位锚在棋盘区中央（left 按 --rail-w 扣栏），不压右栏
    expect(toastBlock).not.toContain('display: none');
    expect(toastBlock).not.toContain('visibility: hidden');
    expect(phoneCss).toContain(':has(.phone-market-float:not(:empty)) .toast-stack');
    expect(phoneCss).toContain('calc((100vw - var(--rail-w)) / 2)');
  });
  it('R2-6 市场浮签：定稿站名 + 金币角标 ×N + 市场顶部撤 Practice 标签', () => {
    expect(gameTsx).toContain('strings.hud.marketTitle');
    expect(gameTsx).toContain('popup-coin-badge');
    expect(gameTsx).toContain('marketBuysLeft');
    expect(enDict).toContain("marketTitle: 'The Market'");
    expect(zhDict).toContain("marketTitle: '菜市场'");
  });
  it('R2-12 单一信息源：overlay 不再有轮次文字，board-log 与 Toast 同口径本地化', () => {
    expect(gameTsx).not.toContain('board-status');
    expect(gameTsx).toContain('localizeLogText(shownLog.text)');
    expect(gameTsx).toContain('data-testid="action-primary"');
  });
  it('提议浮签（R2 定稿）：文案写清提议内容 + Yes/No 按钮走既有回应命令', () => {
    expect(enDict).toContain('wants your {want} for its {give}. Yes or No?');
    expect(zhDict).toContain('想用{give}换你的{want}，换吗？');
    expect(proposalPill).toContain('board-await');
    expect(proposalPill).toContain('proposal-yes');
    expect(proposalPill).toContain('proposal-no');
    expect(gameTsx).toContain("type: 'RESPOND_SWAP'");
    expect(gameTsx).toContain("type: 'RESPOND_INVITE'");
  });
  it('R2-17 触屏隐藏键盘提示文字（pointer: coarse）', () => {
    expect(hudCss).toContain('@media (pointer: coarse)');
    expect(hudCss).toContain('.panel-keyhelp--kbd');
  });
});
