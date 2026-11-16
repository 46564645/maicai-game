/**
 * types.ts —— 游戏引擎核心类型（纯 TypeScript，禁止 import React）。
 * 对应 PLAN.md 第 3 节草案。
 *
 * 命令式引擎约定：
 *   - 唯一入口签名：`(state: GameState, command: Command) => EngineResult`
 *   - 非法命令 → 返回原状态 + `error` 错误码，不抛异常到 UI；
 *   - 引擎通过 `turnPhase`（站内回合阶段）与 `pendingDecision`（当前等待的
 *     输入）告诉界面「现在可以做什么」。
 */

/* —— 基础 —— */

export type PlayerId = string; // 'p0'..'p3'，真人固定 p0
export type CardId = string;
export type CharacterId = string;
export type BotPersonality = 'steady' | 'impulsive' | 'follower'; // 稳妥型/冲动型/跟风型（线框 G1 命名；文档旧称 稳稳/心动/跟跟）

export type StationId =
  | 'drawTask' // 01 抽任务卡
  | 'market' // 02 菜市场
  | 'partner' // 03 伙伴站
  | 'bus' // 04 公交站
  | 'event' // 05 随机事件站
  | 'parent' // 06 AI 家长站
  | 'store' // 07 小卖部
  | 'cook'; // 08 回家做饭

/** 屏幕级阶段（整场游戏走到哪一步） */
export type Phase =
  | 'intro' // 开场动画
  | 'chooseCharacter' // 选角色
  | 'station' // 站内（站点卡展示 + 轮流行动）
  | 'basket' // 圈末「我的篮子」
  | 'feast' // 一起开饭（仅第 3 圈末）
  | 'reflection' // 最满意的决定
  | 'finished'; // 再玩一局入口

/** 站内回合阶段：intro=站点卡等待 ACK；act=按 order 轮流行动；done=本站结束 */
export type TurnPhase = 'intro' | 'act' | 'done';

export interface Player {
  id: PlayerId;
  seatIndex: number; // 0..3，环形座位，真人固定 0（底部）
  characterId: CharacterId | null;
  name: string;
  isHuman: boolean;
  personality: BotPersonality | null;
  coins: number;
  recipeId: CardId | null; // 菜谱（第 1 圈第 1 站抽）
  collected: CardId[]; // 已插进菜谱的材料
  extras: CardId[]; // 赠品菜/多余材料（可交换）
  temptations: CardId[]; // 已买诱惑品
  holdClip: CardId | null; // 「先等等」夹（≤1 张）
  busDebt: number; // 「待付夹」：欠的车费
  paidEventCount: number; // 已遇花钱事件数（上限见 gameConfig.events）
  parentUsed: boolean; // AI 家长站已用
}

export interface TurnState {
  order: PlayerId[]; // 本站行动顺序（起始玩家轮换后的排列）
  orderIndex: number; // 当前轮到 order[orderIndex]
  turnPhase: TurnPhase;
  sub: StationSub; // 各站子状态
}

export type StationSub =
  | { kind: 'drawTask' }
  | { kind: 'market'; buysLeft: number; holdUsed: boolean; boughtIds: CardId[] } // boughtIds：本站已买过的卡（同一张卡一次到站只买一次）
  | {
      kind: 'partner';
      inviteCardId: CardId | null; // 本站翻出的邀请卡（进 act 时抽）
      inviteAccepted: PlayerId[]; // 已加入一起买的玩家（各付各的份）
      inviteResponded: PlayerId[]; // 已回应邀请卡的玩家
      humanOffered: boolean; // 本站已有 bot 向真人发过交换提议（每站至多 1 次）
      declinedSwaps: string[]; // 已被拒绝的交换签名，防止 bot 重复提同一个
    }
  | { kind: 'bus' }
  | { kind: 'event'; weatherId: CardId | null; eventCardId: CardId | null }
  | { kind: 'parent' }
  | { kind: 'store'; holdResolved: boolean; boughtIds: CardId[] } // boughtIds：本站已补买过的材料
  | { kind: 'cook' };

export interface MarketState {
  stall: (CardId | null)[]; // faceUp 格
  deck: CardId[]; // 补牌堆（初始化时预洗好的材料+诱惑品）
}

/** 引擎保证：任何 Proposal 不发生币转移（不能借钱/送钱/代付） */
export interface Proposal {
  id: string;
  kind: 'swap' | 'invite';
  from: PlayerId;
  to: PlayerId; // 真人收到时以气泡弹出
  giveCardId?: CardId; // swap：from 给出的卡
  wantCardId?: CardId; // swap：from 想要的卡
  inviteCardId?: CardId; // invite：邀请卡 id（各自付自己的钱）
}

export interface ParentDialog {
  playerId: PlayerId;
  step: 0 | 1 | 2 | 3; // 当前问第几问（共 4 问）
  cleared: boolean[]; // 每问是否「说清」
  offerSettle: boolean; // ①②都说清后，正在等「就这样吧(1币)/继续回答」
}

export interface PlateResult {
  playerId: PlayerId;
  kind: 'full' | 'simple' | 'shadow'; // 完整版/简化版/剪影盘
  missing: CardId[];
}

/** 反思页每人提交的一句「最满意的决定」 */
export interface ReflectionRecord {
  playerId: PlayerId;
  optionId: string;
  text: string;
}

/** 钱的去向分类（G6「看看钱花到哪了」分组小计用） */
export type SpendKind =
  | 'ingredient' // 买菜（菜市场/小卖部/先等等夹）
  | 'temptation' // 诱惑品（贴纸/棉花糖/冰棍/一起买）
  | 'bus' // 车费（投币与待付夹补缴）
  | 'event' // 意外（事件站花钱方案）
  | 'gain'; // 得币/退回（家长站补币、好事、一起买退款）

export interface LogEntry {
  id: number;
  text: string;
  playerId?: PlayerId; // 该动作属于谁（钱包流水过滤/气泡归属用，PLAN 4.1.8.1）
  lap?: number; // 发生在第几圈（流水里标出来，同名的两笔才看得出是两次，不是记重了）
  /** 记账（G6 流水用，纯展示元数据，不影响规则）：spend 类为正数花费，gain 为正数得币 */
  spend?: { kind: SpendKind; coins: number };
  /** true = AI 家长说的话（家长站对话区才把它放进气泡；系统提示一律不放） */
  asAi?: boolean;
}

/**
 * 引擎当前等待的输入（界面据此渲染按钮；凡是等待真人输入的状态都会阻断
 * bot 自动推进）。引擎在状态变化时维护该字段。
 */
export type PendingDecision =
  | { kind: 'ack'; playerId: PlayerId } // 站点卡/任务卡/车票/结果卡确认
  | { kind: 'drawRecipe'; playerId: PlayerId } // 抽菜谱
  | { kind: 'marketTurn'; playerId: PlayerId } // 买 / 先等等 / 结束
  | { kind: 'swapResponse'; proposalId: string; playerId: PlayerId }
  | { kind: 'inviteResponse'; proposalId: string; playerId: PlayerId }
  | { kind: 'proposeSwap'; playerId: PlayerId } // 真人主动发起交换
  | { kind: 'payBus'; playerId: PlayerId } // 投币/确认待付
  | { kind: 'eventOption'; playerId: PlayerId } // 花钱方案 / 不花钱方案二选一
  | { kind: 'parentUse'; playerId: PlayerId } // 现在用 / 这次先不用
  | { kind: 'parentAnswer'; playerId: PlayerId; step: number }
  | { kind: 'parentSettle'; playerId: PlayerId } // ①②后「就这样吧」或继续
  | { kind: 'storeTurn'; playerId: PlayerId } // 补买 / 处理先等等夹
  | { kind: 'reflection'; playerId: PlayerId } // 最满意的决定
  | { kind: 'none' }; // 无事可做（等 bot / 等推进）

export interface GameState {
  rng: { seed: number; cursor: number }; // mulberry32，cursor 单调递增
  phase: Phase;
  players: Player[]; // 按 seatIndex 排序
  humanId: PlayerId;
  lap: number; // 1..3
  stationIndex: number; // 0..7
  turn: TurnState | null; // 当前站进度
  market: MarketState; // 摊位 + 牌堆
  recipeDeck: CardId[]; // 剩余可抽的菜谱（不放回抽取）
  proposals: Proposal[]; // 伙伴站待回应的交换（发给真人）
  parentDialog: ParentDialog | null; // AI 家长站对话进度
  plates: PlateResult[] | null; // 开饭后填
  reflections: ReflectionRecord[]; // 已提交的「最满意的决定」
  pendingDecision: PendingDecision; // 引擎当前等待的输入
  helpUsed: number; // 求助次数（只记录不展示）
  flags: { fast: boolean; demo: boolean };
  log: LogEntry[]; // 动作提示「小明买了鸡蛋」
}

/* —— Command（UI 按钮与 bot 决策都归约为它）—— */

export type ParentAnswer =
  | { mode: 'card'; optionId: string } // 图卡（option 带 tags 判定「说清」）
  | { mode: 'text'; text: string } // 打字 → 关键词判断
  | { mode: 'voice' }; // 占位

export type Command =
  | { type: 'START_GAME' }
  | { type: 'CHOOSE_CHARACTER'; characterId: CharacterId }
  | { type: 'ACK' } // 通用「下一步/知道了」
  | { type: 'DRAW_RECIPE' }
  // 菜市场
  | { type: 'STALL_BUY'; cardId: CardId }
  | { type: 'STALL_HOLD'; cardId: CardId }
  | { type: 'END_TURN' } // 本站行动完毕
  // 伙伴站
  | { type: 'PROPOSE_SWAP'; to: PlayerId; giveCardId: CardId; wantCardId: CardId }
  | { type: 'RESPOND_SWAP'; proposalId: string; accept: boolean }
  | { type: 'RESPOND_INVITE'; proposalId: string; accept: boolean }
  // 公交站（投币/确认待付）
  | { type: 'PAY_BUS' }
  // 事件站
  | { type: 'CHOOSE_EVENT_OPTION'; option: 'spend' | 'free' }
  // AI 家长站
  | { type: 'PARENT_BEGIN' } // 「现在用」
  | { type: 'PARENT_SKIP' } // 「这次先不用」/已用过
  | { type: 'PARENT_ANSWER'; answer: ParentAnswer }
  | { type: 'PARENT_SETTLE' } // ①②后「就这样吧」→ 1 币档
  // 小卖部
  | { type: 'STORE_BUY'; ingredientId: CardId }
  | { type: 'RESOLVE_HOLD'; buy: boolean } // 按原价买 / 放弃
  // 结局
  | { type: 'CHOOSE_REFLECTION'; optionId: string; freeText?: string }
  // 通用/演示
  | { type: 'RESTART' }
  | { type: 'TOGGLE_HELP' } // 求助牌开/关（只记录 helpUsed）
  | { type: 'DEMO_JUMP'; lap: number; stationIndex: number }
  | { type: 'DEMO_SET_PERSONALITY'; playerId: PlayerId; personality: BotPersonality }
  | { type: 'SET_FLAG'; flag: 'fast' | 'demo'; value: boolean };

/* —— 引擎入口结果 —— */

/** 非法命令错误码：返回原状态 + error，不抛异常到 UI */
export type EngineError =
  | 'ERR_PHASE' // 当前 phase/turnPhase 不接受该命令
  | 'ERR_NOT_YOUR_TURN' // 不是该玩家的回合
  | 'ERR_NO_CARD' // 卡不存在/不在摊位/不在夹里
  | 'ERR_NO_COINS' // 币不够
  | 'ERR_LIMIT' // 超过次数/上限（买满、夹满、事件上限、家长站已用）
  | 'ERR_NO_PROPOSAL' // 提议不存在或已被处理
  | 'ERR_INVALID'; // 其他非法命令

export interface EngineResult {
  state: GameState;
  /** 本次命令产生的日志条目（供 UI toast/展示），无新增时为 [] */
  events?: LogEntry[];
  error?: EngineError;
}

/** 引擎唯一入口：`(state, command) => { state, events?, error? }` */
export type Engine = (state: GameState, command: Command) => EngineResult;
