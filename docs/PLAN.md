# PLAN.md —《一起去买菜》实施计划

> 依据：`docs/REQUIREMENTS.md`（规则与验收，冲突时以它为准）、`docs/DEVELOPMENT.md`（技术栈与目录约定）、`docs/figma/boardgame_flow_493-2.reference.tsx.txt`（Figma 493:2 原文）。
> 本文件只规划，不含业务代码实现；第 3 节的类型为草案，实现时可微调。

> **2026-11-12 17:54 更新（Thong 批准 3D 方向；里程碑编号以第 2 节表格为准，马教授已更新）**：
> - **M3（当前目标）2D 棋盘整局可玩**：DOM/SVG 小镇环路棋盘、无骰子逐站移动、ww 线框 G1–G5、临时色板（待确认）、bot ≈1s 延迟、演示条。棋盘放在 `BoardView` 接口后，作为 3D 的永久兜底。按 Thong 要求，M3 已包含竖屏 390×844 基础布局，以及 Playwright 鼠标 / 纯键盘 / 390×844 触屏整局 e2e；**M4 在此基础上细化**交互、竖屏与 a11y。
> - **M4.5 3D 棋盘**：three + @react-three/fiber + drei（`React.lazy`），Kenney Mini 等 CC0 素材（`/workspace/maicai-3d-assets/ASSETS.md`），棋子逐站走、天气转盘、跟随相机 + 拖转/捏合 + 回默认、画质档、WebGL 不可用自动退 2D。
> - **M5**：e2e 冒烟（含 3D 截图冒烟）、动画与打磨、投屏大屏布局（`?display=1`）。

## 0. 总原则

- **参考优先（Thong 2026-11-12 18:19）**：能参考成熟项目的地方尽量照着做（MIT 等许可的可借代码，闭源或无许可证的只借形式）；只在必须贴合本项目（Figma 8 站规则、金钱教育目标、1 真人 + 3 电脑人、儿童可用性）时才改，由 ww 把关哪里必须改。

- 一局 = 3 圈 × 8 站；1 真人 + 3 bot；无人出局、无排名、无分数。
- 所有卡牌内容只进 `src/data/cards.json`（全部带 `"status": "待确认"`）；所有数字/开关只进 `src/config/gameConfig.ts`（`待试玩`/`待确认` 注释）。
- `src/game/` 纯 TS（禁 import React），reducer 为纯函数 `(state, action) => state`，随机数全部走 state 内的种子。
- 视觉 token 只在 `src/theme/tokens.css`，默认灰阶；组件 CSS 禁裸色值/裸字号。
- 每个里程碑结束：`npm run build && npm run test` 全绿 → `git commit`。

## 1. 环境说明

- Node **v24.22.1**、npm 11.21.1，位于 `/usr/local/bin`（PATH 默认已命中）。
- 系统已装 Chrome：`/usr/bin/google-chrome`（156.x）。Playwright **不下载浏览器**：
  - 安装依赖时设 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`；
  - `playwright.config.ts` 用 `use: { channel: 'chrome' }`，失败时回退 `launchOptions.executablePath = '/usr/bin/google-chrome'`；
  - 若容器内 sandbox 报错，launch 参数加 `--no-sandbox`。
- 无后端、无外网请求；卡牌/插画全部本地占位（emoji / 简单 SVG）。

## 2. 里程碑总览

| 里程碑 | 内容 | 主要验收 |
|---|---|---|
| M1 ✅ | 脚手架 + tokens + 配置 + cards.json + 类型 | `build`/`test` 绿（已复核） |
| M2 ✅ | 纯 TS 引擎：8 站规则 + bot + 单测 | 50 测试全绿、2400 局模拟跑完（马教授 2026-11-12 17:41 复核） |
| M3 ✅ | 2D 界面：屏幕流程整局可玩（ww 灰度稿 + 暂定配色），同时作 3D 兜底 | 手动从头玩到尾（M3.7 c229da2，马教授 2026-11-12 23:37 复验通过；手机事件站裁切、AI 家长首屏、邀请卡多两行文字转 M4） |
| M4 | 交互补全 + 竖屏 + 键盘/触屏 + a11y | 键盘-only 可玩、竖屏可用 |
| M4.5 | 3D 棋盘（React Three Fiber）：8 站环路摆成小镇街道、菜市场最显眼；天气转盘；相机默认跟随可拖转/捏合 + 回默认；画质档、手机关阴影、跑不动自动退 2D | 低端机流畅或自动降级；操作仍全是按钮 |
| M5 | e2e 冒烟 + 动画与打磨 + 投屏大屏布局 | `npm run e2e` 绿 |

> 2026-11-12 17:54 Thong 批准「全按默认」：PLAN §5 默认值 + 清单 15 条（不加骰子只做天气转盘；不拷 AdriaIsland/discover-china 代码与美术；多人大屏+手机手柄本次不做）。3D 素材见 `/workspace/maicai-3d-assets/ASSETS.md`（Kenney Mini 家族，CC0）。
> M4.5 代码参考（MIT，可借代码，须在 `THIRD_PARTY_NOTICES.md` 保留原版权与许可声明）：Closing Quest（环形棋盘、结果先定的 3D 转盘、画质档、键盘；插画不用）、monopoly-3d（R3F + 纯 TS 引擎，逐格走动画、跟随相机）。仅看不拷：Eco Mountain Party、AdriaIsland、discover-china。详见 `/workspace/game-research/REPORT-3D.md` §10。

## 3. 核心类型草案（`src/game/types.ts`）

```ts
// —— 基础 ——
type PlayerId = string;            // 'p0'..'p3'，真人固定 p0
type CardId = string;
type CharacterId = string;
type BotPersonality = 'steady' | 'impulsive' | 'follower'; // 稳稳型/心动型/跟跟型

type StationId =
  | 'drawTask'   // 01 抽任务卡
  | 'market'     // 02 菜市场
  | 'partner'    // 03 伙伴站
  | 'bus'        // 04 公交站
  | 'event'      // 05 随机事件站
  | 'parent'     // 06 AI 家长站
  | 'store'      // 07 小卖部
  | 'cook';      // 08 回家做饭

type Phase =
  | 'intro'            // 开场动画
  | 'chooseCharacter'  // 选角色
  | 'station'          // 站内（含站点卡展示 + 轮流行动）
  | 'basket'           // 圈末「我的篮子」
  | 'feast'            // 一起开饭（仅第 3 圈末）
  | 'reflection'       // 最满意的决定
  | 'finished';        // 再玩一局入口

interface Player {
  id: PlayerId;
  seatIndex: number;              // 0..3，环形座位，真人固定 0（底部）
  characterId: CharacterId | null;
  name: string;
  isHuman: boolean;
  personality: BotPersonality | null;
  coins: number;
  recipeId: CardId | null;        // 菜谱（第 1 圈第 1 站抽）
  collected: CardId[];            // 已插进菜谱的材料
  extras: CardId[];               // 赠品菜/多余材料（可交换）
  temptations: CardId[];          // 已买诱惑品
  holdClip: CardId | null;        // 先等等夹（≤1 张）
  busDebt: number;                // 待付夹：欠的车费
  paidEventCount: number;         // 已遇花钱事件数（≤2）
  parentUsed: boolean;            // AI 家长站已用
}

interface GameState {
  rng: { seed: number; cursor: number };  // mulberry32，cursor 单调递增
  phase: Phase;
  players: Player[];                      // 按 seatIndex 排序
  humanId: PlayerId;
  lap: number;                            // 1..3
  stationIndex: number;                   // 0..7
  turn: TurnState | null;                 // 当前站进度（见下）
  market: MarketState;                    // 摊位 6 格 + 牌堆
  proposals: Proposal[];                  // 伙伴站待回应的交换/邀请
  parentDialog: ParentDialog | null;      // AI 家长站对话进度
  plates: PlateResult[] | null;           // 开饭后填
  helpUsed: number;                       // 求助次数（只记录不展示）
  flags: { fast: boolean; demo: boolean };
  log: LogEntry[];                        // 动作提示「小明买了鸡蛋」
}

interface TurnState {
  order: PlayerId[];       // 本站行动顺序（起始玩家轮换后的排列）
  orderIndex: number;      // 当前轮到 order[orderIndex]
  stage: 'intro' | 'act' | 'done'; // intro=站点卡等待 ACK
  sub: StationSub;         // 各站子状态
}

type StationSub =
  | { kind: 'drawTask' }
  | { kind: 'market'; buysLeft: number; holdUsed: boolean }
  | { kind: 'partner' }
  | { kind: 'bus' }
  | { kind: 'event'; weatherId: CardId | null; eventCardId: CardId | null }
  | { kind: 'parent' }
  | { kind: 'store'; holdResolved: boolean }
  | { kind: 'cook' };

interface MarketState {
  stall: (CardId | null)[];  // 6 格
  deck: CardId[];            // 补牌堆（初始化时预洗好的材料+诱惑品）
}

interface Proposal {        // 引擎保证：任何 Proposal 不发生币转移
  id: string;
  kind: 'swap' | 'invite';
  from: PlayerId;
  to: PlayerId;              // 真人收到时以气泡弹出
  giveCardId?: CardId;       // swap：from 给出的卡
  wantCardId?: CardId;       // swap：from 想要的卡
  inviteCardId?: CardId;     // invite：邀请卡 id（各自付自己的钱）
}

interface ParentDialog {
  playerId: PlayerId;
  step: 0 | 1 | 2 | 3;       // 当前问第几问
  cleared: boolean[];        // 每问是否"说清"
}

interface PlateResult {
  playerId: PlayerId;
  kind: 'full' | 'simple' | 'shadow';  // 完整/简化/剪影
  missing: CardId[];
}

interface LogEntry { id: number; text: string; }

// —— Action（UI 按钮与 bot 决策都归约为它；引擎校验非法动作原样返回）——
type ParentAnswer =
  | { mode: 'card'; optionId: string }   // 图卡（option 带 tags 判定"说清"）
  | { mode: 'text'; text: string }       // 打字 → 关键词判断
  | { mode: 'voice' };                   // 占位

type Action =
  | { type: 'START_GAME' }
  | { type: 'CHOOSE_CHARACTER'; characterId: CharacterId }
  | { type: 'ACK' }                                   // 通用"下一步/知道了"（站点卡、任务卡、车票、结果卡）
  | { type: 'DRAW_RECIPE' }
  // 菜市场
  | { type: 'STALL_BUY'; cardId: CardId }
  | { type: 'STALL_HOLD'; cardId: CardId }
  | { type: 'END_TURN' }                              // 本站行动完毕
  // 伙伴站
  | { type: 'PROPOSE_SWAP'; to: PlayerId; giveCardId: CardId; wantCardId: CardId }
  | { type: 'RESPOND_SWAP'; proposalId: string; accept: boolean }
  | { type: 'RESPOND_INVITE'; proposalId: string; accept: boolean }
  // 公交站（投币/确认待付）
  | { type: 'PAY_BUS' }
  // 事件站
  | { type: 'CHOOSE_EVENT_OPTION'; option: 'spend' | 'free' }
  // AI 家长站
  | { type: 'PARENT_BEGIN' }                          // "现在用"
  | { type: 'PARENT_SKIP' }                           // "这次先不用"/已用过
  | { type: 'PARENT_ANSWER'; answer: ParentAnswer }
  | { type: 'PARENT_SETTLE' }                         // ①②后"就这样吧"→ 1 币
  // 小卖部
  | { type: 'STORE_BUY'; ingredientId: CardId }
  | { type: 'RESOLVE_HOLD'; buy: boolean }            // 按原价买 / 放弃
  // 结局
  | { type: 'CHOOSE_REFLECTION'; optionId: string; freeText?: string }
  // 通用/演示
  | { type: 'RESTART' }
  | { type: 'TOGGLE_HELP' }                           // 求助牌开/关（只记录 helpUsed）
  | { type: 'DEMO_JUMP'; lap: number; stationIndex: number }
  | { type: 'DEMO_SET_PERSONALITY'; playerId: PlayerId; personality: BotPersonality }
  | { type: 'SET_FLAG'; flag: 'fast' | 'demo'; value: boolean };
```

### 状态机：phase 如何推进

```
intro ──START_GAME──▶ chooseCharacter ──CHOOSE_CHARACTER──▶ station(lap=1, stationIndex=0)
station: turn.stage='intro'(站点卡) ─ACK─▶ 'act'
  'act'：按 turn.order 依次行动；每个玩家完成本站子状态后 orderIndex++
  orderIndex 走完全员 ─▶ stationIndex++，重建 turn（stage 回 'intro'）
  stationIndex 到 8：
    lap<3 ─▶ phase='basket'（我的篮子） ─ACK─▶ lap++, stationIndex=0, phase='station'
    lap=3 ─▶ phase='feast'（结算 plates） ─ACK─▶ 'reflection' ─全部交完─▶ 'finished'
finished ─RESTART─▶ 新种子 initGame → intro
```

- **每站起始玩家轮换**：`offset = ((lap-1)*8 + stationIndex) % 4`，`order = seatOrder` 左旋 `offset`。相邻两站起始人必不同；24 站每人各先 6 次。
- **真人回合 vs bot 回合**：`activePlayer = turn.order[turn.orderIndex]`。
  - 引擎不含定时器。React 侧 `useBotDriver`：当 `phase==='station' && stage==='act' && activePlayer 是 bot && 没有等待真人回应的 Proposal/对话` 时，`setTimeout(botDelayMs)` 后 `dispatch(botAct(state))`；bot 的一个 Action 解决后若仍轮到他（如菜市场可多买），继续走同一循环，实现"动作间隔 800ms"。
  - 真人回合：UI 按 `selectors.availableActions(state)` 渲染按钮，点击即 dispatch；任何等待真人输入的状态（含发给真人的 Proposal）都会阻断 bot 推进。
  - 单测/快速模式：同一驱动逻辑在 `src/game/simulate.ts` 里同步循环（无 setTimeout），`?fast=1` 时延迟取 `fastDelayMs=0`。
- **得钱先补车费**：统一在引擎内部 `gainCoins()` 处理——任何来源（事件、家长站）加币先扣 `busDebt`，并写 log「先付了车费」。

## 4. 里程碑明细

### M1 脚手架 + 配置 + 数据 + 类型

**新建文件**

- 根：`package.json`（react 18、react-dom、vite、@vitejs/plugin-react、typescript、vitest、@playwright/test；均取发布 ≥7 天的稳定版；`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`）、`tsconfig*.json`（strict）、`vite.config.ts`（`base:'./'` + vitest 配置）、`index.html`、`.gitignore`
- `src/main.tsx`、`src/App.tsx`（占位渲染）
- `src/theme/tokens.css`（灰阶 token；Figma 绿 `#46a171`/`#f1f7f0` 写注释备选）、`src/theme/base.css`、`src/theme/layout.css`（横/竖屏媒体查询骨架）
- `src/config/gameConfig.ts`：`playerCount`、`startCoins=12`、`recipeTotal=6`、`laps=3`、`busFeeByLap=[2,0,0]`【待确认】、`market{faceUp:6,maxBuyPerVisit:2,maxHold:1,minNeededGuarantee:1}`【待试玩】、`store.markup=1`、`events{maxPaidPerPlayer:2,goodRatio:1/3}`、`parent{maxUsePerGame:1,maxCoins:2,mustApproveCompliantPlan:true}`【待确认】、`plates.simpleMaxMissing=1`【待确认】、`timing{botDelayMs:800,fastDelayMs:0}`、8 站名称与"练·XX"标签
- `src/data/cards.json`：菜谱≥6、材料、诱惑品（贴纸2/棉花糖1/冰棍1）、事件≥9（约1/3好事，各带 `spendOption`/`freeOption`/关联天气）、天气、邀请卡、parentStation（4 问 + 各问图卡选项 + keywords）、characters、reflections；全部 `"status":"待确认"`
- `src/data/cards.ts`：类型 + 加载校验（菜谱材料价和=6 否则 `console.warn`；事件好事比例检查）
- `src/data/strings.ts`：界面文案集中（中文短句）
- `src/game/types.ts`（第 3 节草案）、`src/game/rng.ts`（mulberry32）
- `tests/unit/cards.test.ts`：cards.json 校验测试

**验收**：`npm install` → `npm run build` → `npm run test` 全绿 → `git commit`。

### M2 纯 TS 引擎 + bot + 单测

**新建文件**

- `src/game/engine.ts`：`initGame(seed)` + `reducer` + `gainCoins`（先补车费）等内部工具
- `src/game/stations/`：`drawTask.ts`、`market.ts`（买≤2/先等等≤1/补满6/每玩家回合保证≥1 张所需材料）、`partner.ts`（一换一、邀请卡、禁转钱校验）、`bus.ts`（扣费/待付夹/按 `busFeeByLap`）、`event.ts`（天气→抽卡、花钱上限改抽、钱不够禁选花钱项）、`parent.ts`（一问一答、图卡/关键词判"说清"、1/2 币分档、一局一次、合规必批开关）、`store.ts`（+1 价、处理先等等夹）、`cook.ts`（放盘、三种结局判定）
- `src/game/bots.ts`：`botAct(state): Action`，三种性格规则（稳稳/心动/跟跟），平局用 `(seed, lap, stationIndex, playerId, log.length)` 哈希定序，保证确定性
- `src/game/selectors.ts`：`activePlayer`、`missingIngredients`、`canAfford`、`plateKind`、`availableActions`、`helpHints`（求助牌内容也走这里）
- `src/game/simulate.ts`：无定时器的同步驱动（4 bot 跑整局），供单测/e2e 思路验证
- `tests/unit/`：`startCoins`、`busDebt`（欠费→得钱先补）、`paidEventCap`、`parentStation`（一局一次 + 分档）、`storeMarkup`、`partnerNoTransfer`（任何 Action 序列不产生币转移）、`marketLimits`、`lapFlow`（3 圈→feast）、`endings`（三种盘）、`fullGameSim`（固定种子 4 bot 完整局不报错、无人出局）

**验收**：`npm run build && npm run test` 全绿（含种子局到 `reflection`）→ `git commit`。

### M3 界面：屏幕流程整局可玩（横屏为主）

**新建文件**

- `src/ui/useGame.ts`（`useReducer` + `initGame(?seed=)` + URL flags `seed/fast/demo`）、`src/ui/useBotDriver.ts`（bot 定时推进 + `LogEntry` toast）、`src/ui/useSpeech.ts`（`speechSynthesis` 朗读，不可用则隐藏 🔊）
- `src/components/`：`BigButton`（≥56px）、`Wallet`（一枚枚硬币图）、`Coin`、`CardView`、`RecipeCard`（材料槽位点亮）、`HoldClip`/`BusDebtClip`（深灰斜纹标签）、`BasketPanel`、`PlateView`、`PlayerPanel`（头像/币/材料小图标）、`BoardRing`（8 站环路 + 当前站高亮 + 棋子）、`StationDialog`（一次一件事、2–3 大按钮）、`Toast`
- `src/screens/`：`IntroScreen`（标题 + 4 数字卡 + 可跳过动画）、`CharacterSelectScreen`、`GameScreen`（棋盘 + 弹窗宿主 + 常驻顶条/钱包/求助按钮）与各站面板：`DrawTaskPanel`、`MarketPanel`、`PartnerPanel`（基础同意/不了气泡）、`BusPanel`、`EventPanel`（转盘占位→二选一）、`ParentPanel`（本里程碑先只做图卡输入）、`StorePanel`、`CookPanel`、`BasketReviewScreen`（自己详情 + 他人进度只读）、`FeastScreen`（4 盘同屏，先无动画）、`ReflectionScreen`（预设选项 + 自由输入 + bot 台词 + 再玩一局）
- 布局：`layout.css` 横屏栅格（真人底部大区；bot 左/上/右）；竖屏媒体查询先打通"组件纵向堆叠"，精修留 M4

**验收**：`npm run build && npm run test` 绿；`npm run dev` 手动完整玩一局无报错 → `git commit`。

### 4.1 M3 详细计划（2D 整局可玩）

> 依据：REQUIREMENTS §1.2/§4/§5/§8/§10、REPORT §5.5–5.6（三种输入、竖屏断点）、REPORT-3D §5（3D 只换视图层 → 棋盘必须藏在 `BoardView` 接口后）、Figma 线框 G1–G5。
> M2 引擎已就绪且不动：`initGame({seed,humanCharacterId?,botPersonalities?})`、`applyCommand(state,cmd)→{state,events?,error?}`（非法命令原样返回+错误码）、`selectors.availableCommands / helpHints / pendingActorId / missingIngredients / marketPriceOf`、`bots.chooseBotCommand`、`state.pendingDecision` + `turn.turnPhase` 告诉 UI「现在能做什么」。本节全部是界面层规划，不改任何规则。

#### 4.1.1 组件树与文件清单

```
src/
  ui/
    useGame.ts        // useReducer 包装 initGame/applyCommand；读 URL ?seed= ?fast= ?demo=；
                      // 暴露 { state, send(cmd)→EngineResult, lastEvents }（send 存 error 供提示）
    useBotDriver.ts   // pendingDecision.playerId 是 bot 且不在站点卡 ACK 时，
                      //   setTimeout(delay) 后 send(chooseBotCommand(state, pid))；
                      //   delay = state.flags.fast ? timing.fastDelayMs(0) : timing.botDelayMs(≈800ms)
    useHotkeys.ts     // 全局键位（4.1.3）；焦点在 input/textarea 时只放行 Esc/Enter 提交
    useFocusTrap.ts   // 弹窗/抽屉打开时焦点进入并圈禁，关闭还原到原元素
    useLayerStack.ts  // 可 Esc 覆盖层栈：求助卡 > 钱包抽屉 > 演示条；Esc 只关最上层
    useSpeech.ts      // speechSynthesis 朗读；探测不可用则隐藏 🔊（不作必要路径）
  board/
    BoardView.ts      // 棋盘视图接口 + BoardViewProps（见下）
    boardModel.ts     // GameState → BoardViewProps 纯函数（2D/3D 共用，引擎零改动）
    Board2D.tsx       // DOM/SVG 小镇街道环路（本里程碑实现；同时是 3D 永久兜底）
    Board3D.tsx       // M4.5 才实现；Game 内 React.lazy + Suspense + ?board=3d 预留切换位
  screens/
    Intro.tsx          // 标题 + tagline + 4 数字卡 + 开始（复用现 App.tsx 结构）
    CharacterSelect.tsx// 4 角色卡（cards.characters），真人选 1，余下自动给 bot
    Game.tsx           // G1 主界面：顶条 + 棋盘 + bot 左2右1 + 圈序卡 + 底部真人区 + 弹窗宿主
    BasketReview.tsx   // 圈末「我的篮子」：自己详情 + 他人进度只读（不比较不排序）
    Feast.tsx          // 一起开饭：4 盘同屏（横屏一排 / 竖屏 2×2）
    Reflection.tsx     // 最满意的决定：预设选项 + 自写 + bot 台词 + 再玩一局
  components/
    StationPopup.tsx   // 站点弹窗壳：横屏居中 dialog / 竖屏底部抽屉（同一组件，媒体查询）
    BottomSheet.tsx    // 抽屉壳（钱包 G3、竖屏站点弹窗、竖屏气泡复用）
    MarketPanel.tsx    // G2：6 卡 + 选中信息 + 买下/先等等/跳过
    PartnerPanel.tsx   // 邀请卡回应 + 真人主动发起交换（两步选卡）
    SpeechBubble.tsx   // G4：bot→真人提议气泡（swap/invite），锚定对应 bot 卡
    BusPanel.tsx       // 车票卡 + 投币/记待付夹；「车费开局就说过，不是惩罚」
    EventPanel.tsx     // 事件卡 + 花钱/不花钱二选一
    WeatherSpinner.tsx // 天气转盘占位动画（CSS 旋转→停在 sub.weatherId，reduced-motion 直显）
    ParentPanel.tsx    // G5：聊天气泡 + 4 问图卡 + 打字框 + 语音占位 + 就这样吧/继续
    StorePanel.tsx     // 缺的材料优先 + 全部材料（+1 价签）+ 先等等夹结算
    CookPanel.tsx      // 放盘确认（轻量，复用 StationPopup）
    WalletDrawer.tsx   // G3：左菜谱槽位进度 / 右币数+流水+先等等+待付+自由额度提示
    RecipeCard.tsx     // 菜谱卡：材料槽位，买到点亮（底栏与钱包抽屉共用）
    Coins.tsx          // 一排硬币图 + 币数（不只是数字）
    BotCard.tsx        // bot 头像/名字/性格/币数/已买小图标；轮到它时「正在想…」高亮
    HelpCard.tsx       // 求助牌弹卡：缺哪些菜/几个币/本站能做什么/温和建议（helpHints）
    KeyHint.tsx        // 圆形数字键徽标（已有 .key-hint 样式）
    Button.tsx         // ≥56px 主/次按钮 + keyHint + icon + 可选 🔊 朗读
    CardView.tsx       // 通用卡面（icon+名+价+标签），市场/小卖部/赠品菜共用
    AutoPanel.tsx      // 兜底面板：把 availableCommands 逐条渲染成按钮——
                       // 任何 pendingDecision 都立即可玩，正式面板逐站替换它
  demo/
    DemoBar.tsx        // ?demo=1 或 D 开合：跳站(圈1–3+站1–8→DEMO_JUMP)/重开(RESTART)/
                       // 逐 bot 切性格(DEMO_SET_PERSONALITY)/fast 开关(SET_FLAG)
  App.tsx              // useGame + useBotDriver + 按 phase 路由屏幕 + 覆盖层宿主 + DemoBar
```

`BoardViewProps`（全部由 state 派生，2D/3D 一致；M4.5 只换实现）：

```ts
interface BoardViewProps {
  stations: { index: number; id: StationId; name: string; goal: string; isCurrent: boolean }[];
  pawns: { playerId: PlayerId; name: string; icon: string; colorVar: string }[]; // 无骰子，棋子同站
  lap: number; laps: number; stationIndex: number;
  order: PlayerId[];                 // 本站行动顺序（turn.order）
  activePlayerId: PlayerId | null;   // 当前行动者（轮到谁谁亮）
}
```

#### 4.1.2 phase / pendingDecision → 屏幕/面板/按钮/Command 映射

bot 回合（`pendingDecision.playerId` 是 bot）：对应 bot 卡「正在想…」+ log toast；不给真人按钮（常驻的求助/钱包/演示条除外）。

| state / pendingDecision | 屏幕 / 面板 | 按钮（键位） | Command |
|---|---|---|---|
| phase=`intro` | `Intro` | [Enter/Space] 开始（primary） | `START_GAME` |
| phase=`chooseCharacter` | `CharacterSelect` | [←→/1–4] 角色卡 ×4 | `CHOOSE_CHARACTER{characterId}` |
| `turnPhase='intro'`（站点卡） | `StationPopup` 站点卡（站名+练·标签+一句话说明） | [Enter/Space] 进入这一站（primary） | `ACK`（约定：站点卡永远真人确认，见 4.1.8） |
| `drawRecipe` | `StationPopup`+抽任务卡内容 | [1/Enter] 抽菜谱卡 | `DRAW_RECIPE` |
| `ack`（站内：看任务卡/放盘/买菜结果类） | `CookPanel` 或通用确认卡 | [Enter] 好的 | `ACK` |
| `marketTurn` | `MarketPanel`（G2） | [←→] 选卡；[1] 买下→`STALL_BUY{cardId}`（primary）；[2] 放进先等等→`STALL_HOLD{cardId}`；[3] 走完这一站→`END_TURN`；有先等等夹时追加 [4] 按原价买→`RESOLVE_HOLD{buy:true}` / [5] 放弃→`RESOLVE_HOLD{buy:false}`。可不可点以 `availableCommands` 为准 | 见左 |
| `inviteResponse` | `PartnerPanel` 邀请卡区（卡面 text + splitNote + 已加入 n/minPlayers） | [1] 好呀（primary，币不够时 disabled） | `RESPOND_INVITE{accept:true}` |
| | | [2] 不用了 | `RESPOND_INVITE{accept:false}` |
| `swapResponse` | `SpeechBubble`（从 from 的 bot 卡冒出，G4） | [1] 好呀 | `RESPOND_SWAP{accept:true}` |
| | | [2] 不用了 | `RESPOND_SWAP{accept:false}` |
| `proposeSwap` | `PartnerPanel`：我的赠品菜 chips + 各 bot 赠品菜行 | 先点我的赠品菜再点对方赠品菜→[确认提议]；[1] 走完这一站（primary） | `PROPOSE_SWAP{to,giveCardId,wantCardId}` / `END_TURN` |
| `payBus` | `BusPanel` 车票卡 | [Enter] 投币 n 币 / 钱不够时「先记进待付夹」（均 primary） | `PAY_BUS` |
| `eventOption` | `EventPanel`+`WeatherSpinner` | [1] {spendOption.label}（没钱/已满 2 次 disabled） | `CHOOSE_EVENT_OPTION{option:'spend'}` |
| | | [2] {freeOption.label} | `CHOOSE_EVENT_OPTION{option:'free'}` |
| `parentUse` | `ParentPanel` 开场（intro 文案+每人每局 1 次） | [1] 现在用（primary） | `PARENT_BEGIN` |
| | | [2] 这次先不用 | `PARENT_SKIP` |
| `parentAnswer{step}` | `ParentPanel` 聊天（G5：问题 x/4 + 已答历史气泡） | [1..n] 图卡→`PARENT_ANSWER{mode:'card',optionId}`；打字框+提交→`{mode:'text',text}`；[语音占位]→`{mode:'voice'}`（toast voiceHint，不推进） | `PARENT_ANSWER{answer}` |
| `parentSettle` | `ParentPanel` | [1] 就这样吧（拿 1 币） | `PARENT_SETTLE` |
| | | [2] 继续回答 | `ACK`（→ parentContinue） |
| `storeTurn` | `StorePanel` | [1..n] 材料（缺的排前，标 +1 价）→`STORE_BUY{ingredientId}`；有先等等夹 [原价买/放弃]→`RESOLVE_HOLD{buy}`；[最后] 走完这一站 | `STORE_BUY` / `RESOLVE_HOLD` / `END_TURN` |
| phase=`basket` | `BasketReview` | [Enter] 进入下一圈（primary） | `ACK` |
| phase=`feast` | `Feast`（4 盘：名字+完整版/简化版/下次补上，不比较） | [Enter] 一起说决定（primary） | `ACK` |
| `reflection`（真人） | `Reflection` | [1..n] 预设选项→`CHOOSE_REFLECTION{optionId}`；rho-6 自己写→输入框+提交→`{optionId:'rho-6',freeText}` | `CHOOSE_REFLECTION` |
| `reflection`（bot） | `Reflection` | 无按钮；driver 提交后把 botLine 气泡贴上 | `CHOOSE_REFLECTION`（bot） |
| phase=`finished` | `Reflection` 末态 | [Enter] 再玩一局（primary） | `RESTART` |
| `none` | — | 无（等 bot/等推进），常驻件仍可点 | — |

#### 4.1.3 输入：统一 `useHotkeys`

- **键位**（`e.target` 为 input/textarea/select/contenteditable 时除 Esc 外一律不拦截，空格留给打字）：
  | 键 | 行为 |
  |---|---|
  | Enter / Space | 点 `[data-testid="action-primary"]:enabled`（无则交给原生焦点按钮） |
  | 1–9 | 点 `[data-testid="action-<n>"]:enabled`（面板选项按 G2 顺序编号） |
  | ← →（↑ ↓） | 卡片网格内移动选中项（市场/小卖部/图卡/角色卡，roving tabindex） |
  | Esc | 关闭 layerStack 最上层（求助卡 > 钱包抽屉 > 演示条；站点弹窗不进栈、不可 Esc） |
  | W | 钱包抽屉开关（G3） |
  | H | 求助牌开合（打开时 dispatch `TOGGLE_HELP` 计次一次） |
  | D | 演示条开合（`SET_FLAG demo`） |
- **焦点陷阱**：`StationPopup`/`BottomSheet`/`HelpCard` 打开 → `useFocusTrap` 聚焦首个 button、Tab/Shift+Tab 在内部循环、关闭还原到原元素；`role="dialog"` + `aria-modal="true"` + 中文 `aria-label`；`:focus-visible` 粗描边（已有）。
- **原生元素**：一切可交互物用原生 `<button>`（卡片也是 button + `aria-pressed` 表选中）；不用 div onClick。
- **data-testid 规范**（e2e 驱动只依赖它）：
  - 屏幕：`screen-intro` `screen-characters` `screen-game` `screen-basket` `screen-feast` `screen-reflection`
  - 面板：`panel-<stationId>`（如 `panel-market`）
  - 动作：`action-primary`（唯一主按钮）+ `action-1…n`（编号选项）；细粒度再加语义 id：`action-buy-<cardId>` `action-hold-<cardId>` `action-store-<ingredientId>` `action-parent-<optionId>` `action-reflect-<optionId>` `action-char-<characterId>`
  - 其它：`station-<1..8>`（棋盘站点）、`bot-<playerId>`、`plate-<playerId>`、`drawer-wallet`、`card-help`、`toast-log`、`bubble-proposal`、`btn-help` `btn-wallet` `btn-demo`

#### 4.1.4 布局

**横屏 1280×800（G1，默认）**，`.game-layout` grid：

```
┌──────────────────────────────────────────────────────────┐
│ 《一起去买菜》                              ⚙设置  ?玩法 │
├────────┬────────────────────────────────┬────────┬───────┤
│ 小稳卡 │   ⑧回家    ①抽任务 ②菜市场    ③伙伴 │ 小跟卡 │
│ 稳妥型 │   ⑦小卖部 ┌──────────────┐ ④公交 │───────┤
│        │           │ 小镇插画区    │      │ 第1圈/3 │
│ 小冲卡 │   ⑥AI家长 │ 轮到你了+进入 │ ⑤事件 │ 顺序提示│
│ 冲动型 │           └──────────────┘      │       │
├────────┴────────────────────────────────┴───────┴───────┤
│ 你(头像) │ 菜谱卡(材料槽位) │ 我的钱:硬币排 │ 先等等│待付│求助牌│
└──────────────────────────────────────────────────────────┘
```

- 8 站顺时针环排：上 ①②、右 ③④、下 ⑥⑤、左 ⑧⑦；**菜市场②地块最大最显眼**；当前站加粗描边；4 枚棋子同站显示（玩家色）。
- bot：**左 2**（小稳上、小冲下）**右 1**（小跟上），右下 = 圈数 + 行动顺序卡。
- 站点弹窗居中遮罩（G2 样式）。

**竖屏 390×844（≤900px 单列、≤640px 极简）**：

```
顶状态条(第X圈·站名)
棋盘压缩版(8站环+4棋子+当前站,减插画)
bot 横排小卡 ×3(头像/币/材料数)
「轮到你」卡 + 大按钮 / 站点动作区
钱包·菜谱入口条(币数+进度缩略) + 先等等/待付/求助 图标钮
```

- 站点弹窗→**整宽底部抽屉**（按钮纵排全宽，复用 `StationPopup`+`BottomSheet`）；气泡从 bot 小卡下冒出；开饭 2×2 盘；钱包抽屉全宽。
- 同一套组件，只在 `layout.css` 媒体查询切换，不复制逻辑；禁止横向滚动（验收断言）。

#### 4.1.5 颜色：`tokens.css` 换 ww 临时色板【待确认】

```
--color-primary:        #FF6B2C  /* 暖橙·主色（主按钮底、强调） */
--color-accent-yellow:  #FFC93C  /* 黄·待付夹/提醒 */
--color-blue:           #5B7CFA
--color-mint:           #7ED9B5
--color-purple:         #B9A3F0  /* 淡紫·AI 家长/强调 */
--color-bg:             #FFF6EC  /* 奶油底 */
--color-text:           #1E1E2A  /* 墨色 */
--player-you:      var(--color-primary)   /* 你=橙 */
--player-steady:   #5B7CFA                /* 小稳=蓝 */
--player-impulsive:#FFC93C                /* 小冲=黄 */
--player-follower: #7ED9B5                /* 小跟=薄荷 */
```

- `--color-warning` 改指黄板（待付夹=黄底墨字）；`--button-primary-bg` 改暖橙【待确认】；其余 token 名不变 → 组件零改动，ww 正式 UI 来了再整体换。
- 原灰阶值留在注释里作回退参考；组件 CSS 继续禁裸值。

#### 4.1.6 Playwright e2e 设计

`playwright.config.ts` 已就绪（`channel:'chrome'`、`--no-sandbox`、webServer=build+preview:4173）。新增：

- `tests/e2e/helpers.ts`：
  - `openGame(page, extra='')` → `/?seed=1&fast=1`（fast=1 时 bot 延迟 0，整局秒级推进）。
  - **通用驱动 `stepOnce(page)`**：优先点 `[data-testid="action-primary"]:enabled`，否则点第一个 `[data-testid^="action-"]:enabled`；都没有 → 等 200ms（bot 回合自动推进）。`playToEnd(page, maxSteps≈800)` 循环到 `[data-testid="action-replay"]` 出现。
  - `assertClean(page)`：`body` 文本不含 `排名|第一名|分数|成绩单|淘汰|排行榜`；收集 `pageerror` 必须为空。
- `tests/e2e/fullgame.spec.ts`（1280×800，鼠标）：`playToEnd` 走完整局；断言途经 `screen-basket`×2、`screen-feast` 且 `plate-*` 恰 4 个、`screen-reflection`；`assertClean`。
- `tests/e2e/keyboard.spec.ts`：**纯键盘整局**——驱动只发按键：`page.evaluate` 读取当前 enabled 的 `action-N` 后 `press(N)` 或 `Enter`；途中验证：W 开钱包→Tab 焦点困在抽屉→Esc 关闭且焦点还原；H 开关求助卡；D 开演示条→跳站→Esc；输入框聚焦时按 Space/数字不误触发。断言同 fullgame。
- `tests/e2e/mobile.spec.ts`：`use:{viewport:390×844, hasTouch:true, isMobile:true}`；同驱动改 `page.tap`；多处断言 `document.scrollingElement.scrollWidth <= 390`；走完整局。
- 截图：`scripts/shot-m3.mjs`（playwright + channel chrome，`?seed=1&fast=1&demo=1`）：正常驱动 + 演示条跳站定位画面，desktop 1280×800 与 mobile 390×844 各存 `screenshots/m3_{intro,characters,board,market,wallet,parent,basket,feast,reflection}_{desktop,mobile}.png`。

#### 4.1.7 子步骤（每步各自 build+test 绿 → commit）

| 子步骤 | 内容 | 验收 |
|---|---|---|
| **M3.1 底座与骨架** | tokens.css 换 4.1.5 色板；`ui/`(useGame/useBotDriver/useHotkeys/useFocusTrap/useLayerStack)；Button/KeyHint/CardView/Coins/RecipeCard/BotCard/**AutoPanel**/StationPopup 壳；`board/`(BoardView/boardModel/Board2D 八站环+当前站+棋子)；Intro/CharacterSelect/Game(G1 布局)+占位 BasketReview/Feast/Reflection；竖屏单列媒体查询 | `npm run build && npm run test` 绿；`npm run dev` 开 `?seed=1` 全走 AutoPanel 能从开场玩到 `finished` |
| **M3.2 常驻件+面板(一)** | WalletDrawer(G3)/HelpCard(H)/Toast(events)/SpeechBubble(swap+invite 回应)/useSpeech；DrawTask/Market(G2 完整)/Bus/Cook/Store 正式面板；StationPopup 焦点陷阱与 Esc 规则 | build+test 绿；手动验证菜市场买/先等等/跳过、+1 价、待付夹显示 |
| **M3.3 面板(二)+圈末结局屏** | PartnerPanel(邀请+两步提议)/EventPanel+WeatherSpinner/ParentPanel(图卡+打字+语音占位+settle 分支)；BasketReview/Feast/Reflection 正式屏；竖屏底部抽屉与 2×2 盘细化 | build+test 绿；手动横屏+390 竖屏各玩一局；`rg '排名|分数|成绩单|淘汰|排行榜' src/` 无命中 |
| **M3.4 演示条+e2e+截图** | DemoBar 实装；tests/e2e/{helpers,fullgame,keyboard,mobile}.spec.ts；scripts/shot-m3.mjs → screenshots/m3_* | `npm run build && npm run test && npm run e2e` 全绿；纯键盘整局、390 无横向滚动 |

#### 4.1.8 引擎 API 缺口 → 最小补充（不改规则）

1. **`LogEntry` 建议加可选 `playerId?: PlayerId`**（`pushLog` 多传一个参数）：G3 钱包流水按人过滤、bot 气泡归属、将来按人回放都用得上；不依赖规则。备选：UI 用名字前缀匹配（脆，不推荐）。
2. **新增纯 selector `walletSummary(state,pid)`**：`{coins,busDebt,missingCost,freeEstimate,holdClip,recipeName,recentLogs}`，钱包抽屉与求助牌共用；纯派生不改引擎行为。
3. **无需引擎改动的派生**（UI/board 层计算）：`boardModel`（放 `src/board/`）、bot 回合判定（`pendingDecision.playerId`→`player.isHuman`）、市场卡标签「食材·菜谱里有/食材/诱惑/买不起」（`missingIngredients`+`isTemptation`+`coins`）、「买完还剩 n 币」、邀请进度（`sub.inviteAccepted`）、转盘结果（`sub.weatherId`/`eventCardId`）。
4. **约定（非代码）**：`turnPhase='intro'` 的站点卡其 `pendingDecision` 记在 `order[0]`（可能是 bot）——UI 约定**站点卡永远由真人按 Enter/按钮 ACK**（`ACK` 不校验发起者），`useBotDriver` 跳过该 pending。保证孩子每站都看得见站点卡，也给 e2e/键盘统一的「进入这一站」入口。
5. **已确认够用的接口**：`events`→toast；`state.proposals`→气泡；`PARENT_ANSWER{mode:'voice'}`→占位提示不推进；`rho-6`+`freeText`→自写反思；`TOGGLE_HELP` 只计次（开合是 UI 本地态）；`RESTART` 内部续种子（e2e 复现靠首局 `?seed=`）；`DEMO_JUMP` 已含补菜谱前置。

### M4 交互补全 + 竖屏 + 三种输入

**新建/修改文件**

- AI 家长站：`PictureCardPicker`（3–4 图卡/问）、`TextAnswerInput`（关键词判定，判不出回退图卡）、语音占位按钮（点击提示"还在做"）；bot 脚本化对话展示
- 伙伴站：`ProposalBubble`（从头像冒出的气泡，带同意/不了）、真人主动发起交换 UI（选赠品菜→选对象）、邀请卡流程、bot↔bot 交换 toast
- `src/components/HelpCard.tsx`：缺哪些菜/几个币/本站能做什么/温和建议（读 `selectors.helpHints`）；`TOGGLE_HELP` 计次不展示
- `src/demo/DemoBar.tsx`：`?demo=1` 或 `D` 键开合；跳站（圈+站，`DEMO_JUMP` 自动补抽菜谱、清瞬态）、重开、逐 bot 切性格、fast 开关
- `src/ui/useFocusTrap.ts`（弹窗焦点圈禁，关闭还原）、`src/ui/useHotkeys.ts`（Esc 关闭、H 求助、D 演示条；输入框聚焦时屏蔽快捷键）
- a11y：全 `<button>` + 中文 `aria-label`；`role="dialog"`/`aria-modal`；`:focus-visible` 粗描边；`touch-action: manipulation`；可点目标 ≥48px
- 竖屏（`layout.css`，§10.2）：顶状态条 → bot 横排小卡（可点开详情）→ 中部棋盘缩略/场景卡 → 底部固定真人区；站点弹窗改底部抽屉（按钮全宽纵排）；气泡从 bot 小卡下冒出；结局 2×2 盘
- 新增单测：关键词判定、交换合法性、helpHints

**验收**：`npm run build && npm run test` 绿；手动验证键盘-only 一局、390px 竖屏无横向滚动 → `git commit`。

### 4.2 M4.5 详细计划（3D 棋盘）

> 依据：REQUIREMENTS §14、DEVELOPMENT §9、ART_3D.md（ww，§8 逐条验收）、m4_5_addendum.txt、REPORT-3D.md §5/§10。
> 引擎、规则、钱、菜谱、色板一概不动；3D 只是 `BoardView` 的新实现。MIT 可借：closing-quest（转盘「结果先定只演出」、cameraRig 阻尼/焦点/画质档）、monopoly-3d（Piece 逐站小跳、OrbitControls 轻跟随、positions 格子坐标思路）；借用片段登记 `THIRD_PARTY_NOTICES.md`。只看不拷：Eco Mountain、Craft、HeapPlay、AdriaIsland、discover-china。

#### 4.2.1 组件树与文件清单

```
src/board/
  BoardView.ts            // 既有接口；追加可选 weather 字段（Board2D 忽略，向后兼容）
  boardModel.ts           // toBoardView 追加 weather 派生（引擎零改动）
  Board2D.tsx             // 既有 2D，永久兜底，不改
  BoardMount.tsx          // 新：?board=2d|3d|auto 选择 + WebGL 检测 + lazy + Suspense + ErrorBoundary
  three/
    Board3D.tsx           // <Canvas> + 布局壳（同 BoardViewProps&{children}），DOM overlay 盖在画布上
    Scene.tsx             // 暖色主光+环境光、天空渐变背景、雾；组装下列全部
    Island.tsx            // 圆角有厚度的小岛基座（挤出圆角矩形/超椭圆），奶油侧面
    StreetLoop.tsx        // 环路：站点地砖 + 站间 2–3 块过渡圆角地砖，沿街摆放
    StationTile.tsx       // ×8：圆角厚地块 + 当前站微抬/发光圈；菜市场 scale 1.5–2×
    StationProps.tsx      // 各站道具：菜棚摊位/邮筒/长椅树/站牌小车/问号牌/大手机/小店面/小房子+饭桌
    Piece.tsx             // ×4：Kenney Mini 角色 GLB 换色 + 头顶 emoji 图标(sprite) + 逐站弧跳动画
    WeatherSpinner3D.tsx  // 岛正中央平放转盘：分区天气图标 canvas 贴图 + 指针；spin(weatherId)
    CameraRig.tsx         // drei OrbitControls + 每帧 target.lerp 跟随（借 monopoly-3d），
                          // 焦点模式 overview/pawn/spinner（借 closing-quest 焦点切换），回正按钮
    QualityProvider.tsx   // high/low 档 context；手机/低端默认 low；PerformanceMonitor 降档
    positions.ts          // 环形路径纯函数：站中心坐标、棋子 2×2 站位偏移、弧跳插值（可单测）
    materials.ts          // 统一玩具风材质（toon/standard + 柔和 roughness），调色板只认 tokens 色值
    gltf.ts               // useGLTF 封装、模型换色（材质 color 乘算玩家色）、克隆工具
    webgl.ts              // detectWebGL()、首帧看门狗、webglcontextlost → 回退回调
public/models/            // 只拷用到的 GLB（清单见 4.2.3），引用 ./models/xx.glb
tests/e2e/board3d.spec.ts // 3D 冒烟（见 4.2.4）
scripts/shot-m4_5.mjs     // 截图脚本（见 4.2.4）
THIRD_PARTY_NOTICES.md    // MIT 片段 + CC0 素材登记
```

`BoardViewProps` 追加（boardModel 派生，向后兼容）：
```ts
weather?: { id: CardId | null; nonce: number }; // nonce = turn.orderIndex；id 由引擎先定
```
Board3D 与 Board2D 同签名 `props + children`：`children`（「轮到你了/进入这一站」+ log）以绝对定位 DOM overlay 盖在画布中下部，`aria-hidden` 只加在 canvas 上，DOM 层照常可读屏。

#### 4.2.2 状态 → 3D 映射（全部派生自 BoardViewProps，不读引擎内部）

| state | 3D 表现 |
|---|---|
| `stations[i].isCurrent` | 该站地砖微抬 + 底部发光圈（emissive），其余常态 |
| `stationIndex` 变化 | 4 枚棋子按座位序各延迟 ~0.1s 依次沿弧跳到新站（每站 ~0.4–0.5s，落地压扁回弹 + 小星星/尘土）；`prefers-reduced-motion` 直接落位 |
| `pawns`（4 个） | 站内地块上 2×2 错位站（`tileAnchor(index, slot)` 思路借 monopoly-3d positions.ts） |
| `activePlayerId` | 该棋子上下轻晃 + 玩家色光环；相机 `target.lerp` 轻跟随到它；轮到真人时镜头必须对准真人棋子（ww 验收条） |
| `weather.id` 由 null→非空（nonce 变） | 相机推近转盘 → 转盘多转几圈缓停到对应分区（结果先定只演出，借 closing-quest spin 逻辑：算目标角 + 加整圈）→ 停后回俯视；事件面板 DOM 照旧 |
| `phase==='feast'`（可选打磨） | 相机飞一圈到「回家做饭」站再回总览；不做盘子 3D（结局仍是 DOM 屏） |
| 买入成功（log 增量，可选） | 对应棋子播 emote-yes/pick-up 动画片段（GLB 自带）；做不到就跳过，不阻塞 |
| 面板打开（StationPopup 出现） | 可选：相机 `setViewOffset` 式偏移让画面重心上移（竖屏抽屉）；做不到先不做 |

#### 4.2.3 用的 GLB 文件（拷进 `public/models/`，全部 Kenney CC0）

棋子（Mini Characters，按玩家色调色，名字待确认）：
`character-female-a.glb`（你·橙）、`character-male-a.glb`（小稳·蓝）、`character-female-c.glb`（小冲·黄）、`character-male-b.glb`（小跟·薄荷）

菜市场摊位（Mini Shop + Food Kit，体量 1.5–2×）：
`display-fruit.glb` ×2、`display-bread.glb`、`display-small.glb`、`shopping-basket.glb`、`cash-register.glb`；
食材摆台（对应 cards.json 材料）：`tomato.glb`(番茄)、`egg.glb`(鸡蛋)、`leek.glb`(葱)、`cabbage.glb`/`broccoli.glb`(青菜)、`carrot.glb`(胡萝卜)、`mushroom.glb`(蘑菇)、`meat-raw.glb`(猪肉)、`fish.glb`(鱼)、`cheese.glb`(豆腐·染白)；缺口（土豆/黄瓜/姜/蒜）用程序化几何体补或不摆。诱惑品点缀：`popsicle.glb`(冰棍)、`ice-cream.glb`(棉花糖·染粉，近似)。

其它站道具（能拼则用，缺则程序化）：
`gacha-machine.glb`（⑤随机事件·问号牌备选）、`display-flowers.glb`（③伙伴站花）、`bag.glb`/`bag-flat.glb`（②/⑦购物袋）、`floor.glb`/`wall.glb`/`shelf-boxes.glb`/`cash-register-self.glb`（⑦小卖部备选）、`pot.glb`/`pan.glb`/`bowl.glb`/`plate.glb`/`cup.glb`/`frying-pan.glb`（⑧回家做饭的饭桌）。

程序化（同风格几何体，不混第三套）：岛基座、地砖、菜市场彩色布棚（条纹帆布+支架）、公告板/邮筒(①)、长椅+棒棒糖树(③)、公交站牌+橙色小面包车(④)、问号牌(⑤备选)、大手机(⑥)、小房子+烟囱+烟sprite(⑧)、树/石/花/水面圈/云。
转盘盘面：canvas 画 3 扇形分区 + 矢量天气图标（☀ 圆+光芒 / 🌧 云+雨滴 / 🌬 风纹，**不依赖 emoji 字体**，无头环境也可控）。

#### 4.2.4 截图脚本与 3D 冒烟 e2e

- `scripts/shot-m4_5.mjs`（仿 shot-m4.mjs，launch args 加 `--enable-unsafe-swiftshader`）：`?board=3d&seed=1&fast=1&demo=1`
  - `m4_5_board`：进入主棋盘（全景小岛 + 8 站 + 4 棋子就位）
  - `m4_5_market`：演示条跳第 1 圈 ②菜市场 → 拍菜市场大棚特写 + 面板
  - `m4_5_spinner`：跳 ⑤随机事件站 → 等 `weatherId` 出现 → 转盘停到位后拍（含相机推近位）
  - `m4_5_zoom`（可选）：拖拽/捏合后点「回默认视角」前后对比
  - `m4_5_mobile_*`：390×844 同拍；desktop 1280×800 同拍
  - 每张亲自看：是否精美（ART_3D §8 清单），不行就调再继续。
- `tests/e2e/board3d.spec.ts`（playwright.config `launchOptions.args` 追加 `--enable-unsafe-swiftshader`）：
  - `?board=3d&seed=1&fast=1` → `<canvas>` 存在；`pageerror` 收集为空；console 无 `WebGL`/`THREE.`/`Error` 报错
  - DOM 驱动照旧走 ≥5 步（进 2–3 站）证明 3D 下操作不变
  - `page.screenshot()` buffer 字节数 > ~30KB（纯色空白 PNG 极小）判非空白
  - `?board=2d` 断言无 `<canvas>`；`?board=3d` + 拦截 WebGL（`page.addInitScript` 让 `getContext('webgl2'/'webgl')` 返回 null）→ 断言自动回退 2D 且无 canvas
- 既有 `fullgame/keyboard/mobile` spec 默认 `?board=` 不设 → 走 auto；无 WebGL 环境自动落 2D，测试不破。

#### 4.2.5 子步骤（每步各自 build+test 绿 → commit）

| 子步骤 | 内容 | 验收命令 | 截图检查点（亲自看） |
|---|---|---|---|
| **M4.5.1 依赖+壳+岛** | 装 9.2 依赖；`three/` 骨架：Island 基座、StreetLoop+StationTile×8（程序化、菜市场加大）、暖光+天空渐变、CameraRig（OrbitControls 限俯角/远近 + 跟随 + 「回默认视角」DOM 钮）、QualityProvider、dpr 上限、frameloop demand；`BoardMount`（lazy/Suspense/ErrorBoundary/webgl 检测/?board=）；棋子=彩色胶囊占位；`aria-hidden` + 文字状态行 | `npm run build && npm run test`；`?board=3d&seed=1` 进主界面见小岛 | `m4_5_board_*`：岛有厚度圆角、8 站环成形、菜市场明显大、暖奶油色调不刺眼 |
| **M4.5.2 棋子+走站+站景** | 4 个 Kenney 角色 GLB 换色 + 头顶图标；stationIndex 变化 → 弧跳动画（落地回弹）；active 棋子高亮；各站道具按 4.2.3 拼装（菜市场棚+食材、大手机、小房子+烟、站牌+小车等）；树/水/云点缀 | `npm run build && npm run test`；`?board=3d&seed=1&fast=1` 连走几站看动画；新增 positions 单测 | `m4_5_board/market_*`：棋子是小人不是胶囊、跳站有弹跳、8 站道具可辨认（邮筒/菜棚/长椅/站牌/问号/手机/店/家） |
| **M4.5.3 转盘+推近+默认3D** | WeatherSpinner3D（canvas 盘面+指针，spin 到 `weather.id`）；相机推近/回位；慢首帧看门狗；默认 auto：WebGL 可用即 3D；`board3d.spec.ts` + playwright flag | `npm run build && npm run test && npm run e2e` 全绿 | `m4_5_spinner_*`：转盘在岛正中、质感分区、相机推近后回俯视；WebGL 拦截用例确认回退 2D |
| **M4.5.4 打磨+登记+交付** | 低档贴片影、烟/树摇/水波微动效、emote（可选）、gltf-transform 压缩、`THIRD_PARTY_NOTICES.md` 登记（closing-quest MIT、monopoly-3d MIT、Kenney 三包 CC0）、`shot-m4_5.mjs` 全量截图双端、`maicai-game-dist.zip`+README、ADAPTATION 14 条自查 | `npm run build && npm run test && npm run e2e` 全绿；`ls -la dist public/models` 看预算 | 全套 `m4_5_*_{desktop,mobile}` 对照 ART_3D §8 九条逐一看：45° 斜俯、圆角厚砖软影、弧跳回弹、转盘质感、相机平滑、场景有活气、面板浮层协调 |

#### 4.2.6 风险与默认

- SwiftShader 软渲染下帧率仅作相对比较；真机 GPU 更好。截图脚本报 WebGL 错就先查 `--enable-unsafe-swiftshader` 是否生效。
- drei 9 的 `Html`/`OrbitControls` 会拉 three-stdlib；若 3D 分包超 300KB：先确认只 import 用到的 drei 组件（避免 `import * as drei`），再考虑自定义 OrbitControls 或 three 官方 examples 路径。
- 角色 GLB 各含 32 条动画（~250KB），只用 idle/walk/jump/emote-yes；若体积敏感可用 gltf-transform 剔除未用动画。
- 「棋子同站」是本项目规则（无先后走位）：4 枚一起跳、座位序错峰 0.1s；不逐人分站。
- 任何引擎字段不够用时**只扩展 BoardViewProps/selector**，不改规则（参考 4.1.8 的先例）。

### M5 e2e 冒烟 + 动画 + 打磨

**新建/修改文件**

- `playwright.config.ts`：`webServer` 先 `npm run build` 再 `npm run preview`；`use:{channel:'chrome'}`（回退 `executablePath:'/usr/bin/google-chrome'`，必要时 `--no-sandbox`）
- `tests/e2e/fullgame.spec.ts`：`?seed=1&fast=1` 自动玩完整局 → 断言 4 盘同屏、到反思页、页面无"排名/第一名/分数/成绩单/淘汰"字样（靠 `data-testid`：`btn-next`、`btn-buy-*`、`station-*`、`btn-help` 等）
- `tests/e2e/keyboard.spec.ts`：纯键盘（Tab/方向键/Enter/Esc/H）推进 ≥1 圈，检查弹窗焦点圈禁与还原
- `tests/e2e/mobile.spec.ts`：390×844 竖屏玩完整局、`document.scrollingElement.scrollWidth <= 390`
- 动画（仅此两处，全部走 token + `prefers-reduced-motion`）：付钱硬币飞/扣减；开饭锅盖开+灯亮
- 打磨：全仓 grep 禁用词；组件 CSS 裸值检查；文件 <300 行；`cards.json` 全带 `status`；PLAN/AGENTS 更新

**验收**：`npm run build && npm run test && npm run e2e` 全绿 → `git commit`。

## 5. 歧义与风险 → 默认处理（不改 REQUIREMENTS.md）

| # | 位置 | 歧义/风险 | 默认处理 | 配置项 |
|---|---|---|---|---|
| 1 | §3 | 公交费收几次 | `busFeeByLap=[2,0,0]`，第 1 圈收 2 币、后两圈直接过 | `busFeeByLap` |
| 2 | §5.08 | 简化 vs 剪影分界 | 缺 0→完整；缺 1→简化；缺 ≥2→剪影 | `plates.simpleMaxMissing` |
| 3 | §5.02 | 「先等等」细节 | 保留市场价；下一次到菜市场**或**小卖部可原价买/放弃；放弃即移出游戏；夹满不能再放 | `market.maxHold` |
| 4 | §4.4 | 起始玩家轮换方式未定义 | `offset=((lap-1)*8+stationIndex)%4` 左旋座位序，相邻站必不同人 | — |
| 5 | §5.02 | 摊位"保证有所需材料"的实现 | 每个玩家回合开始时检查 6 格，无则从牌堆换入 ≥`minNeededGuarantee` 张所需材料 | `market.minNeededGuarantee` |
| 6 | §5.03 | 1 真人+3 bot 的交换细节 | bot 每站至多向真人发 1 个提议（有可换才发）；真人可主动发起；bot 按性格应答：想要/需要→接，给出自己需要的→拒，跟跟型更常接；bot↔bot 自动 | — |
| 7 | §5.03 | 邀请卡规则不全 | 每站翻 1 张邀请卡，按行动顺序各自选"一起/不了"；卡面有 `minPlayers`，达成人数才各自扣各自的币 | cards.json `invite.minPlayers` |
| 8 | §5.05 | 谁转天气/抽几张 | 每玩家回合自己转一次天气、抽对应天气的 1 张事件卡；花钱事件数≥2 后改抽免费/好事卡 | `events.maxPaidPerPlayer` |
| 9 | §5.06 | bot 的家长站表现 | 脚本化 2–3 句台词（按性格）；得币档由"是否缺钱+性格"决定 | — |
| 10 | §5.06 | 打字判定的边界 | 关键词表放 cards.json `parentStation.questions[].keywords`；判不出→AI 给图卡兜底；`mustApproveCompliantPlan` 默认 `true`（为 `false` 时 demo 行为不变） | 同名开关 |
| 11 | §5.07 | 小卖部卖什么 | 只卖材料（无限供应，市场价+1）；诱惑品不进小卖部；先等等夹在此可原价结算 | `store.markup` |
| 12 | §4.6/§5.08 | "区别只有孩子自己看得见"与"4 盘显示三种结局" | 4 盘同屏标注角色名与结局种类（需求 §4.6 要求），但不出现任何比较/排序/名次文案 | — |
| 13 | §6 | 求助是否计次 | 内部计 `helpUsed` 不展示；内容走 `selectors.helpHints` 动态生成 | — |
| 14 | §8 | 跳站的前置补齐 | 只补：人人有菜谱（缺则自动抽）、清瞬态（proposals/parentDialog/turn.sub）；**不**伪造购买历史 | — |
| 15 | §10.2 | 竖屏布局标【待确认】 | 仍按 §10.2 实现（媒体查询同组件，不复制逻辑），ww 定稿后只调 CSS | — |
| 16 | — | 刷新页面进度 | 不持久化（无 localStorage），刷新即重开；如需保持再加 | — |
| 17 | — | 菜谱是否可重复 | 抽菜谱按不放回抽取，4 人不同菜（6+ 张够用） | — |
| 18 | — | bot 决策随机性 | 规则优先，平局用稳定哈希定序——同种子整局完全可复现 | — |
| 19 | 风险 | cards.json 全是占位内容 | 引擎只依赖结构化字段（价格/effect/keywords/tags），不依赖文案；事件 effect 用有限枚举 `{coinsDelta?, gainIngredient?}` | — |
| 20 | 风险 | `speechSynthesis` 不可用（部分 Linux Chrome） | `useSpeech` 探测，不可用隐藏 🔊，不做为必要路径 | — |
| 21 | 风险 | 文件 <300 行约束 vs 8 站规则 | 一站一文件 + `stations/shared.ts` 工具；屏幕组件按站拆 Panel | — |

## 6. 技术选择（✅ 已决定：Thong 2026-11-12 16:32 批准自写纯函数引擎，不用 boardgame.io；M1 已批准开工）

> 调研报告：`/workspace/game-research/REPORT.md`。采纳其建议：React DOM + CSS 变量；纯函数命令引擎（`turnPhase` + `pendingDecision`，非法命令返回原状态+错误码）；数据驱动卡牌（待确认）；bot 性格策略表 + 约 0.8–1.2s 延迟；统一输入动作（≥48px、Enter/Space 主动作但打字时不拦截、1/2/3 选项、Esc 关最上层、hover 仅精细指针）；横屏棋盘居中、竖屏单列棋盘在上 + 底部抽屉；仅 CSS 动画；不拷贝闭源/无许可证代码与美术。下面保留原取舍分析供参考。

### 原分析

**当前方案（本计划默认）**：自写纯 TS 引擎 + React `useReducer`。理由：

- DEVELOPMENT.md 已规定纯函数引擎 + 无第三方状态库；引擎 ≈ 3 圈×8 站固定流程 + 每站小子状态机，复杂度可控（估 <1500 行）。
- 单人是bot轮流场景（类 hot-seat），不需要联网同步——boardgame.io 的核心卖点（多人网络、玩家视角隔离、匹配服务器）全部用不上；其 turns/stages/moves 概念映射过来反而绕。
- 零框架依赖 → 种子确定性与单测最直接；演示条跳站（`DEMO_JUMP`）这类"越规"操作框架内做起来别扭。
- 已按"`src/game/` 只暴露 `initGame/reducer/selectors/botAct`、UI 只经 Action 驱动"的接口隔离，**即使日后换框架，M1（数据/配置/类型）与 M4–M5（界面/e2e 断言层）基本不动**。

**若调研结论改用 boardgame.io 等框架**：

- 影响最大：**M2**——状态机要重写成框架的 moves/turns/phases；bot 从"返回 Action"改为框架 AI 接口；`GameState` 形状基本可保留。
- 次要影响：M1 增依赖；M3 的 driver 改接框架 client；M4 演示条跳站需走框架的 state 注入；M5 e2e 断言层不变（仍按 testid 驱动 UI）。
- 关注点：bg.io 近年更新节奏放缓；包体积；strict TS 契合度；"纯静态无后端"下只能走单机模式。
- ~~建议决策点：M2 开工前~~ → 已决定：自写引擎。

## 7. 验收标准对照（REQUIREMENTS §12 → 落点）

| 验收条 | 落点 |
|---|---|
| 1 build/dist | M1 起每次里程碑 |
| 2 手动完整一局 | M3 |
| 3 站点规则单测 | M2 `tests/unit/*` |
| 4 bot 全程 + 演示条 | M2 bot；M4 DemoBar |
| 5 禁用词 | M5 e2e 断言 + grep |
| 6 数据/配置集中 | M1 结构 + M5 grep |
| 7 token 集中、引擎无 React | M1 结构 + M5 检查 |
| 8 test + e2e | M5 `npm run e2e` |
| 9 键盘整局 + 竖屏整局 | M4 手工 + M5 keyboard/mobile spec |
| 10 布局形态 | M3 横屏 + M4 竖屏/弹窗/灰度 |
