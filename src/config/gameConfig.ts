/**
 * gameConfig.ts —— 全项目唯一放可调数字与规则开关的地方。
 * 注释约定：【待试玩】＝数字参数，需试玩调整；【待确认】＝规则没定稿。
 * 代码里不得硬编码这些值；UI 一律从这里读。
 */

const startCoins = 12; // 【待试玩】起始币，四个人完全一样
const recipeTotal = 6; // 【待试玩】每张菜谱材料市场价之和（加载时校验）
const busFeeByLap: readonly number[] = [2, 0, 0]; // 【待确认】默认只在第 1 圈收 2 币，后两圈「已买过车票」直接通过；可改为每圈都收

/**
 * 【待确认】一起买（联合购买）怎么分钱：
 * - 'eachPaysOwnShare'：各付各的份（卡面写的「每人 n 币」），绝不替别人付 —— 当前唯一实现
 * 其它分法（如一人垫付后分摊、按人头平摊总价等）待 Thong 决定后再加入本联合并在引擎实现。
 */
export type JointBuySplit = 'eachPaysOwnShare';

export const gameConfig = {
  /* —— 整局设置（REQUIREMENTS §3）—— */
  playerCount: 4, // 【待试玩】总人数：1 真人 + 3 电脑
  humanCount: 1, // 【待试玩】真人玩家数
  startCoins,
  recipeTotal,
  laps: 3, // 【待试玩】圈数，8 站走一圈
  /** 自由安排的钱 ＝ 起始币 − 菜谱价 − 车费合计（展示用，由上面推出） */
  freeCoins: startCoins - recipeTotal - busFeeByLap.reduce((a, b) => a + b, 0),

  /* —— 公交站 —— */
  busFeeByLap,

  /* —— 菜市场 —— */
  market: {
    faceUp: 6, // 【待试玩】摊位翻开张数
    maxBuyPerVisit: 2, // 【待试玩】每次到站最多买几张
    maxHold: 1, // 【待试玩】「先等等」夹最多放几张
    minNeededGuarantee: 1, // 【待试玩】每玩家回合保证摊位至少有 n 张其所需材料（防卡死）
    holdKeepsOriginalPrice: true, // 【待确认】先等等夹里的卡保留市场价，下次到菜市场/小卖部可原价买或放弃
  },

  /* —— 伙伴站 —— */
  partner: {
    jointBuySplit: 'eachPaysOwnShare' as JointBuySplit, // 【待确认】一起买＝各付各的份，不代付
  },

  /* —— 小卖部 —— */
  store: {
    markup: 1, // 【待试玩】每样比菜市场贵 n 币；只卖材料、无限供应
  },

  /* —— 随机事件站 —— */
  events: {
    maxPaidPerPlayer: 2, // 【待试玩】每人花钱事件上限，超过后改抽不花钱/好事卡
    goodRatio: 1 / 3, // 【待确认】牌堆中好事约占三分之一
  },

  /* —— AI 家长站 —— */
  parent: {
    maxUsePerGame: 1, // 【待试玩】每人每局可用次数
    maxCoins: 2, // 【待试玩】最多得币数（1 币档 / 2 币档）
    mustApproveCompliantPlan: true, // 【待确认】方案合规就必须同意；为 false 时 demo 行为不变，仅保留开关
  },

  /* —— 结局盘子 —— */
  plates: {
    simpleMaxMissing: 1, // 【待确认】缺 0 样→完整版；缺 ≤n 样→简化版；缺更多→剪影盘
  },

  /* —— 电脑玩家 —— */
  bots: {
    // 【待确认】性格 id 与线框 G1 对齐：稳妥型 / 冲动型 / 跟风型（cards.json bots 同名引用）
    personalities: ['steady', 'impulsive', 'follower'] as const,
  },

  /* —— 电脑玩家节奏 —— */
  timing: {
    botDelayMs: 800, // 【待试玩】bot 动作间隔
    fastDelayMs: 0, // 【待试玩】?fast=1 时的延迟
  },

  /* —— 8 个站点（顺序固定；「练·」是该站学习目标标签）—— */
  stations: [
    { id: 'drawTask', name: 'Recipe Stop', goal: 'Practice: remember your dish' },
    { id: 'market', name: 'The Market', goal: 'Practice: notice temptations' },
    { id: 'partner', name: 'Friends Stop', goal: 'Practice: trade and share' },
    { id: 'bus', name: 'Bus Stop', goal: 'Practice: needs vs wants' },
    { id: 'event', name: 'Surprise Stop', goal: 'Practice: leave room for surprises' },
    { id: 'parent', name: 'Parent Stop', goal: 'Practice: ask and look back' },
    { id: 'store', name: 'The Shop', goal: 'Practice: planning matters' },
    { id: 'cook', name: 'Home for Dinner', goal: 'Practice: see your choices' },
  ] as const,
} as const;

export type GameConfig = typeof gameConfig;
