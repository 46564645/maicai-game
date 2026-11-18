# R10 设计文档：卡片化交互重构（炉石式手牌 / 拖拽打出 / 翻牌揭示）

> 轮次：R10（设计阶段，本文档只做设计，不含代码改动）
> 下单人：项目负责人（2026-11-17 20:40）——「把任务卡和交互形式变成主要依赖卡片形式动交互，例如炉石传说；reactbits.dev 的动效素材大量参考使用，可以直接 copy 源码」
> 执行：Devin CLI（SWE-2），分 Slice A / Slice B 两片（见 §5）；PM 验收。
> 前置：R9（三修：家长站状态点 / fallbackLine 本地化 / 自动重试）先落地并提交，R10 再开工，避免同文件冲突（ParentPanel、tokens.css 两轮都碰）。
> 核实时间：2026-11-17。React Bits 组件结论以当日从 `reactbits.dev/r/<Name>-TS-CSS` 抓取的 registry 源码为准（站点组件近期改版过，第三方旧文档的依赖表已过期，不可信）。

---

## 0. 红线（先说死）

1. **引擎零改动**：`src/game/`（engine、stations、types、selectors）、`cards.json` 内容、ADAPTATION 14 条规则全部不动。R10 只换「玩家怎么点/拖/看」，派发的 Command 必须是现有词表里的（§2 逐站列明）。验收时 `git diff --stat src/game src/data` 必须为空。
2. **只借炉石的「形」**：手牌扇、悬停放大检视、拖拽打出、翻牌揭示、可打出发光——不借任何暴雪美术、字体、音效、纹理。卡面美术继续用游戏现有 emoji/图标（`CardIcon`）。
3. **令牌不换**：奶油底 `#FFF6EC`、橙 `#FF6B2C`、藏青字 `#1E1E2A`、玩家四色、黄 `#FFC93C`、薄荷 `#7ED9B5`、AI 家长紫 `#B9A3F0`（`src/theme/tokens.css`）。R10 只允许**新增**令牌，不改现有值。
4. **动效只用 transform / opacity**；例外只有 §4.4 列明的 Canvas 2D 迸溅（非 WebGL）。**禁止 WebGL/GLSL 着色器类组件**（Board3D 已占用 WebGL，且 REQUIREMENTS 性能预算不允许第二个 3D 上下文）。
5. **零新增运行时依赖**（本轮核实后可做到，见 §0.1）。从 React Bits 抄来的代码必须记入 `THIRD_PARTY_NOTICES.md`（MIT + Commons Clause：可用于本游戏内，不得单独售卖组件本身）。
6. **触屏优先**：目标用户 6–9 岁。拖拽永远有「点选—点目标」的等价路径（tap-tap），触摸目标 ≥48px（REQUIREMENTS §10.3 不变：鼠标/触摸/键盘全支持、数字键 1/2/3、Esc 关最上层、焦点陷阱、hover 效果只在 `(hover:hover) and (pointer:fine)` 下）。

### 0.1 组件核实结论（2026-11-17 抓取 registry 源码逐个核对）

| React Bits 组件 | 结论 | 在本游戏的岗位 | 依赖 | 规模/备注 |
|---|---|---|---|---|
| BounceCards | ✅ 采用（改造） | **Hand 手牌扇**：弹入、扇形展开、悬停时邻卡让位、被悬停卡回正放大 | 无（自研 rAF 弹簧引擎） | ~450 行 TSX + ~40 行 CSS；原版只渲染 `<img>`，须改造为渲染任意 ReactNode 卡面；自带 reduced-motion 与键盘（Enter/Space）支持 |
| TiltedCard | ✅ 采用（裁剪） | **TiltCard 检视+翻面引擎**：指针 3D 倾斜、glare 光泽、弹簧回正；自带翻面（backContent + 点击翻）同时承担抽卡/事件的翻牌 | 无（自研弹簧） | 原版 700+ 行含陀螺仪/字幕/视差层，裁剪至倾斜+glare+翻面约 450 行 |
| BorderGlow | ✅ 采用（改造） | **PlayableGlow 可打出发光**：用其 `animated` 一次性扫光变体做「新可打卡」的召唤提示；静态发光部分改令牌色（橙/黄） | 无 | ~230 行 TSX + ~110 行 CSS；默认紫粉深色配色必须换成项目令牌 |
| Magnet | ✅ 采用 | **拖拽吸附辅助**：桌面指针下，卡接近投放区时轻微被「吸」向中心（弹簧） | 无 | ~330 行单文件；只响应指针、不响应触摸——正合分工：触屏的吸附在松手判定里做 |
| ClickSpark | ✅ 采用（改造） | **PlaySpark 打出/购买迸溅**：命令派发成功瞬间在卡/金币处迸出短线火花 | 无 | ~430 行；每迸溅一个小 Canvas 2D（非 WebGL），有 MAX_BURSTS 上限与 reduced-motion 处理；须再加全局并发上限（§4.4） |
| Counter | ✅ 采用（裁剪） | **CoinCounter 金币滚动数**：老虎机式逐位滚动到新总数，带无障碍朗读文本 | 无（源码仅 import react；落地时以 registry `dependencies` 字段再复核一次） | ~600 行含货币/多语言格式化，金币只需 0–99 整数，可裁剪至 ~300 行 |
| GlareHover | ✅ 采用（裁剪） | **平面元素扫光**：主按钮、站点弹窗标题条的入场扫光（`intro` 一次）与 hover 扫光——只用在没用 TiltCard 的平面元素上，与 Tilt 的 glare 二选一不叠加 | 无 | ~340 行；有 hover/follow/loop/click 四种模式，只用 hover+intro |
| SpotlightCard | ◐ Slice B 可选点缀 | 站点弹窗面板的聚光氛围（指针处柔光、键盘焦点 `:focus-visible` 也亮） | 无 | ~380 行 + CSS；触屏无指针时无效应，纯桌面加分项，排最后，有预算才做 |
| FlipCard | ❌ 不采用 | （原岗位：翻牌） | **motion@^12** | 翻面能力已被零依赖的 TiltedCard 覆盖；不为它引入第二个动画运行时 |
| Stack | ❌ 不采用 | （原岗位：抽牌堆） | **motion@^12** | ~800 行的甩牌堆对手牌游戏过重；牌堆只需「顶卡被点→翻出」，用 §1.5 的轻量自研 Deck（Hand+Tilt 组合）实现 |
| HoloCard | ❌ 拒绝 | （原岗位：闪卡） | **WebGL2 GLSL 着色器** | 触犯红线 4（着色器 + 第二个 WebGL 上下文）。替代：CSS foil 层（借 TiltCard 的 glare CSS 变量驱动 conic-gradient + `mix-blend-mode: screen`），只用在完成菜谱/盛宴盘卡上，见 §3.3 |
| CountUp | ❌ 不采用 | （原岗位：金币数） | **motion** | Counter 零依赖已覆盖同一岗位 |
| SplitText | ❌ 不抄 | （原岗位：标题逐字弹入） | **gsap@^3.13 + @gsap/react** | 为一句标题引入 GSAP 不值；自研 `TitlePop`：按词切 span + CSS `--ease-spring` 阶梯延迟，效果等价、零依赖 |
| AnimatedList | ❌ 不抄 | （原岗位：列表入场） | **@hugeicons/react + core-free-icons** | 图标包与本游戏 emoji 美术冲突；只借模式：钱包抽屉/消费回顾的行「逐行弹入 + 选中环滑动」，用现有 CSS 实现（§2.8） |
| StarBorder | ❌ R10 不做 | （原岗位：主按钮星光描边） | 无（但 Canvas 2D 常驻 rAF） | 常驻动画画布与 Board3D 争帧预算；「看这里」的职责已由 BorderGlow 扫光覆盖 |

**拖拽层说明（重要）**：React Bits 没有「拖到目标区打出」的现成组件（BounceCards 是点击/悬停，Stack 是甩牌堆）。`useDragPlay` 拖拽 hook 为**自研**：Pointer Events + `setPointerCapture`，位移超 8px 判定为拖（以下算点按），矩形命中测试投放区，松手无效 → 弹簧回手牌位；桌面端叠加 Magnet 吸附。预计 200–300 行。

---

## 1. 交互模型

### 1.1 手牌区（Hand）

屏幕底部既有底栏（`.game-bottom`）升级为**手牌区**：常驻卡 + 当前站点的情境卡在同一扇形里。扇形规则（BounceCards 改造）：

- 卡数 ≤7 时全扇展开；每卡旋转角按位置分布（中心 0°，两侧递增至 ±10°），弧形下沉；
- 悬停/聚焦/点选一张：该卡**回正、放大 1.06、上抬**，邻卡按距离让位（pushDistance）；
- 入场：新卡从右侧/牌堆方向弹入扇形（stagger 60ms，`--ease-spring`）；
- AI 回合或非待决策态：手牌整体降亮（opacity .55、无发光），不可拖——沿用现有回合门控，手牌只反映 `availableCommands(state)`。

各站手牌内容：

| 时机 | 常驻卡 | 情境卡（本站可打） |
|---|---|---|
| 抽任务（第 1 圈） | — | 抽到的菜谱卡翻入后成为常驻 |
| 市场 | 菜谱卡、留菜卡（如有） | 摊位 6 张食材卡（扇形陈列） |
| 好朋友 | 菜谱卡 | 邀请回应 2 张选择卡 / 我方食材卡（换菜时选出）/ 对方提案卡 |
| 公交车 | 菜谱卡 | 车票卡 1 张 |
| 惊喜站 | 菜谱卡 | 翻开后的事件卡 + 2 张选项卡（花钱/免费） |
| 家长站 | 菜谱卡 | 图卡一组（扇形，TiltCard） |
| 商店 | 菜谱卡、留菜卡（如有） | 缺货食材卡（货架扇）+ 留菜决断卡 |
| 回家做饭/晚餐 | 菜谱卡飞入灶台 | 食材卡逐张组装；反思站为选项卡组 |

### 1.2 打出语义：拖拽 + 点选双通道（等价）

每个可打动作都有**投放区**（DropZone）：买入→篮子区；留着→留菜夹区；换菜→伙伴头像区；上车→车门区；选图卡→对话区。规则：

- **拖拽**：按住卡拖动（卡跟随指针、按速度轻微倾斜），进入投放区时投放区发光放大（scale 1.05 + BorderGlow 边），松手命中 → 卡飞入投放区 + PlaySpark + 派发命令；未命中/中途取消 → **弹簧弹回**原手牌位（§4 弹簧参数）。
- **点选（tap-tap）**：点一下卡 = 选中（回正上抬、藏青描边），此时所有合法投放区变为大按钮态（≥48px）并轻微脉动；点投放区 = 打出；再点卡本身或 Esc = 取消选中。**现有面板的「选中→点动作按钮」流程就是这条路径，逻辑不变、只是按钮变成投放区**，因此所有现有面板改造都是表现层替换。
- **键盘**：Tab 聚焦卡 → Enter/Space 选中 → Tab 到投放区 → Enter 打出；数字键 1/2/3 快捷对应现有 KeyHint 语义不变。
- **不可打的卡**（钱不够/不在 `availableCommands` 内）：不发光、置灰（§3.2），可点选检视但投放区不亮，拖过去松手必弹回 + 卡身轻 shake（translateX 关键帧，≤200ms）提示——不弹任何文字报错（低龄友好，沿用现有无惩罚基调）。

### 1.3 检视（Inspect）

- 桌面 hover：上抬 12–16px + TiltCard 倾斜（≤10°）+ glare 跟随；
- 触屏长按 250ms：进入同一检视态（不触发选中），松手恢复；
- 键盘 `:focus-visible`：上抬 + 描边（与 SpotlightCard 的焦点亮边一致语义）；
- 菜谱卡检视 = 现有 RecipeCard 展开（食材清单），不新造弹层。

### 1.4 金币反馈

- HUD 总数换 **CoinCounter**：任何金币变化逐位滚动（duration ~0.7s，bounce 0.2），同时保留现有金币图标排（`Coins` 组件）与 `coins-bump` 作为降级；
- 买入/结算成功：PlaySpark 在金币 HUD 处小迸溅一次 + 浮动 `+N`/`−N`  chip（transform 上浮淡出，900ms 内结束）；
- 钱不够时金币数不滚动、不变色惩罚，只在卡上呈置灰态（§1.2）。

### 1.5 抽卡/揭示仪式

- **Deck（自研轻量）**：3 张卡背错位叠放（CSS transform 偏移 2px/4px），位于站点弹窗一侧；抽任务与惊喜站共用。
- 抽菜谱（第 1 圈）：点牌堆（或入场 400ms 后自动）→ 顶卡边翻（TiltCard 翻面引擎，rotateY，540–600ms）边平移落入常驻手牌位 → 派发时机与现有 `DRAW_RECIPE` 完全一致（动画只是现有 `.card-reveal` 的升级，命令在翻面开始时派发还是落位后派发由实现保持现状语义：**状态先行、动画跟随 state 变化**，与现有面板一致）。
- 惊喜站：点牌堆 → 事件卡翻开停在面前（WeatherSpinner 保留在卡头位置）→ 2 张选项卡从事件卡下方弹入情境手牌 → 打出其一派发 `CHOOSE_EVENT_OPTION`。
- 第 2–3 圈到抽任务站：现有流程是 ACK + 展示已有菜谱；视觉改为菜谱卡在手牌位做一次小翻提醒（rotateY 15° 回正），命令仍为 `ACK`。

### 1.6 家长站选卡飞入

图卡在扇形手牌中以 TiltCard 呈现（倾斜检视看清图）；选中后走 **selection flight**：量取卡与对话区目标位的 `getBoundingClientRect`，卡以 fixed 定位克隆沿两点间 transform 平移+缩小（420ms，`--ease-spring`）落入对话区，随后派发 `PARENT_ANSWER{answer:{kind:'card',optionId}}`；其余图卡淡出下沉。R7 真对话模式与 R9 状态点（`data-testid="parent-status"`）布局不动，飞行终点避开状态点。自由文字/语音入口保持现有形态（不是卡，不强行卡化）。

---

## 2. 八站映射（现状 → 新交互 → 组件 → 命令）

> 命令列均为现有引擎命令（`src/game/types.ts`），R10 不新增、不改名。

### 2.1 抽任务站 DrawTaskPanel
- 现状：第 1 圈点按钮 `DRAW_RECIPE`；2–3 圈 `ACK` + `.card-reveal` 展示菜谱。
- 新交互：Deck 抽卡翻牌仪式（§1.5），菜谱卡落入常驻手牌。
- 组件：Deck（自研）+ TiltCard 翻面 + Hand。
- 命令：`DRAW_RECIPE` / `ACK`（不变）。

### 2.2 市场站 MarketPanel
- 现状：6 卡网格（CardView 按钮），点选→点买/留按钮；`STALL_BUY` / `STALL_HOLD` / 跳过=本地取消选中；留菜待决 `RESOLVE_HOLD`；结束 `END_TURN`。
- 新交互：6 张食材卡成扇形手牌；拖卡到篮子区=`STALL_BUY`、拖到留菜夹=`STALL_HOLD`；tap-tap 等价（选中→点投放区大按钮）；买不起的卡置灰不发光（可用性仍读 `availableCommands`）；留菜待决时留菜卡翻起为决断卡（买/不买两张小卡）。
- 组件：Hand + TiltCard + useDragPlay + Magnet + PlayableGlow + PlaySpark + CoinCounter（HUD）。
- 命令：`STALL_BUY{cardId}` / `STALL_HOLD{cardId}` / `RESOLVE_HOLD{buy}` / `END_TURN`（不变）。

### 2.3 好朋友站 PartnerPanel
- 现状：邀请为 `.feature-card` + 同意/拒绝按钮（`RESPOND_INVITE`）；换菜提案以 SpeechBubble 出现（`RESPOND_SWAP`）；我方提议=两步 chip 选择器（`PROPOSE_SWAP`）；`END_TURN`。
- 新交互：邀请卡翻入情境手牌，「一起玩 / 下次吧」两张选择卡打出回应；收到提案时提案卡从伙伴方向飞入面前，接受=拖向伙伴区、拒绝=点拒绝卡；我方提议改为：从手牌选出我方食材卡拖到伙伴区 → 再点对方一张想要的卡（对方卡组以小扇呈现）→ 确认卡打出。
- 组件：Hand + TiltCard + useDragPlay + PlayableGlow。
- 命令：`RESPOND_INVITE{proposalId,accept}` / `RESPOND_SWAP{proposalId,accept}` / `PROPOSE_SWAP{to,giveCardId,wantCardId}` / `END_TURN`（不变；两步选择仍是两次本地选择、一次派发）。

### 2.4 公交车站 BusPanel
- 现状：车票卡展示 + 单个 `PAY_BUS` 按钮；票价 `gameConfig.busFeeByLap[lap-1]`，欠费以 chip 显示。
- 新交互：车票卡在情境手牌中发光，拖到车门投放区（或点选→点车门大按钮）上车；打出时车票卡翻面打孔效果（翻面+PlaySpark 小迸溅）；欠费 chip 保留原样贴在车票卡角上。
- 组件：Hand + TiltCard（翻面）+ useDragPlay + PlaySpark。
- 命令：`PAY_BUS`（不变）。

### 2.5 惊喜站 EventPanel
- 现状：WeatherSpinner + `.feature-card` 展示事件 + 两个按钮（`CHOOSE_EVENT_OPTION{option:'spend'|'free'}`，spend 不可用时禁用）。
- 新交互：Deck 翻牌揭示事件卡（§1.5）；选项变成 2 张卡（花钱卡带价格宝石、免费卡）入情境手牌，打出其一；钱不够时花钱卡置灰、拖出必弹回。
- 组件：Deck + TiltCard 翻面 + Hand + PlayableGlow + PlaySpark。
- 命令：`CHOOSE_EVENT_OPTION{option}`（不变）。

### 2.6 家长站 ParentPanel
- 现状：图卡为 CardView 网格 → `PARENT_ANSWER` card 模式；另有自由文字、语音占位；R7 真对话 + R9 状态点/重试在本轮之前落地。
- 新交互：图卡组改扇形 TiltCard 手牌 + 选卡飞入对话区（§1.6）；文字/语音入口与真对话流程原样保留。
- 组件：Hand + TiltCard + selection flight（自研 FLIP 量测） + PlayableGlow（当前可答时图卡发光）。
- 命令：`PARENT_BEGIN` / `PARENT_ANSWER{answer}` / `PARENT_SETTLE` / `PARENT_SKIP`（不变）。

### 2.7 商店站 StorePanel
- 现状：与市场同构的点选购买（`STORE_BUY`，价格 = 市价 + `gameConfig.store.markup`），分缺货/其他两组网格；`RESOLVE_HOLD`、`END_TURN`。
- 新交互：缺货组为货架扇形手牌（优先组），其他组保持紧凑网格但卡面换新卡剖面（§3.1）；拖/点到篮子区购买；留菜决断同市场（§2.2）。
- 组件：Hand + TiltCard + useDragPlay + PlaySpark + CoinCounter。
- 命令：`STORE_BUY{ingredientId}` / `RESOLVE_HOLD{buy}` / `END_TURN`（不变）。

### 2.8 回家（做饭 CookPanel + 晚餐 Feast + 反思 Reflection + 篮子回顾 BasketReview）
- 现状：CookPanel 菜谱卡 + `ACK`；Feast 四盘 + `ACK` 进消费回顾、 `RESTART`；Reflection 选项卡 → `CHOOSE_REFLECTION`（含自由文字项）、`RESTART`；BasketReview `ACK`。
- 新交互：做饭时手牌里的食材卡逐张飞入锅/盘（组装动画，stagger 120ms）后菜谱卡盖印完成（CSS foil 闪一次，§3.3）；Feast 四张盘卡扇形弹入，标题用 TitlePop + 一次性 CSS 流光（ShinyText 思路的 CSS 化简版）；反思选项改为手牌选择卡，打出一张即选定；消费回顾与钱包抽屉的清单行改为逐行弹入 + 选中环滑动（AnimatedList 模式，纯 CSS 实现）。
- 组件：Hand + TiltCard + TitlePop（自研）+ PlaySpark（完成时刻一次）。
- 命令：`ACK` / `CHOOSE_REFLECTION{optionId,freeText?}` / `RESTART`（不变）。

---

## 3. 视觉系统

### 3.1 卡剖面（Card Anatomy）

统一卡面（CardView 按此重构，props/API 不变以免各面板大改）：

- **卡框**：圆角 `--radius-card`（16px），奶油渐变面 `--gradient-card`，内描边 2px（自己回合=玩家色，其他=藏青 12%），外阴影 `--shadow-md`（暖棕系，与现有令牌一致）；
- **美术区**：上 55% 为美术区，现有 emoji/图标（`CardIcon`）居中放大（44–56px），衬玩家色/类别色 12% 底圆；
- **价格宝石**：左上角圆形宝石（炉石法力水晶的「形」），`--gradient-primary` 橙渐变底、白粗体数字，宝石内嵌小金币点；无价格卡（事件/选择卡）不显示宝石，改为类别小标签；
- **名牌带**：底部名牌带（藏青字、奶油深一档底），名称单行，超长缩小字号不换行溢出；
- **卡背**：藏青底 + 橙色同心星纹（纯 CSS 渐变，无图片），Deck 与未翻事件卡共用；
- **尺寸**：手牌卡桌面 104×144px 起，手机横屏按容器缩放至 ≥72×100px；扇形重叠时每卡露出 ≥48px 宽可点带，选中卡完整露出。

### 3.2 状态样式

| 状态 | 样式 |
|---|---|
| 可打出 playable | BorderGlow 扫光一次（入场/变为可打时）+ 持续柔光外晕（黄 `#FFC93C` 55% 的 box-shadow）+ 卡位微抬 4px |
| 买不起 unaffordable | 美术区 `grayscale(.6)`、整卡 opacity .65、价格宝石转灰；不发光、拖出必弹回+shake |
| 已选中 selected | 回正、scale 1.06、上抬 16px、藏青 3px 描边、阴影升 `--shadow-pop` |
| 刚打出 just-played | 沿飞入轨迹缩小至投放区 + PlaySpark 迸溅 + 150ms 后淡出（状态已由引擎更新，手牌随之重排） |
| 检视 inspecting | TiltCard 倾斜 ≤10° + glare 高光 + scale 1.04（不改变选中态） |
| 非己回合 dimmed | 手牌区 opacity .55、无发光、无拖拽 |

### 3.3 CSS foil（HoloCard 的替代）

仅两处：完成菜谱卡（做饭完成瞬间）、Feast 盘卡。用 TiltCard 已输出的 glare CSS 变量（`--tc-gx/--tc-gy`）驱动一层 conic-gradient 彩虹膜（`mix-blend-mode: screen`、opacity ≤.35），倾斜时色带移动。无倾斜设备上静止呈微光。不得扩散到普通食材卡（低龄防干扰 + 性能）。

---

## 4. 动效规范

### 4.1 总则
- 只动 `transform` 与 `opacity`（例外 §4.4）；禁止动 width/height/top/left 做动画（Counter 数字条、BorderGlow 渐变层为 paint-only，见 §4.4 注）。
- 弹簧/缓动优先复用现有令牌：入场与打出 `--ease-spring: cubic-bezier(0.34,1.56,0.64,1)`；hover `--motion-fast` 150ms；打出/飞入 `--motion-med` 300ms 档；翻牌 540–600ms（`--motion-slow` 900ms 为上限参考，翻牌取其 2/3）。

### 4.2 关键动作时长表

| 动作 | 时长 | 曲线/引擎 |
|---|---|---|
| 手牌弹入（每卡） | 450ms，stagger 60ms | BounceCards 弹簧（bounciness 可调） |
| 悬停回正/上抬 | 150–200ms | TiltCard 弹簧平滑 |
| 拖拽跟随 | 实时（rAF 节流至帧） | useDragPlay 自研；桌面近目标 Magnet 吸附（padding 24px） |
| 无效弹回 | 380–450ms | 弹簧（stiffness ~170 / damping ~22 量级，与 BounceCards 手感对齐） |
| 打出飞入投放区 | 300ms | `--ease-spring` |
| 翻牌揭示 | 540–600ms | TiltCard 翻面弹簧 |
| 家长选卡飞入 | 420ms | FLIP 量测 + `--ease-spring` |
| 金币滚动 | 700ms | Counter（bounce 0.2、stagger 0.04） |
| PlaySpark 迸溅 | ≤500ms | Canvas 2D，单次 ≤14 条线 |
| 标题 TitlePop | 每词 280ms，stagger 45ms | CSS keyframes + `--ease-spring` |

### 4.3 reduced-motion 降级
`@media (prefers-reduced-motion: reduce)`（且各抄来组件自带同名检测，保留不删）：
- 扇形入场 → 直接就位（opacity 120ms 淡入）；翻牌 → 正反面交叉淡化 120ms；飞入 → 150ms 直线淡移；金币 → 直接显示终值（Counter/CoinCounter 引擎内已处理）；PlaySpark/扫光/流光 → 关闭；拖拽保留（功能），弹回改 120ms ease-out 滑动。

### 4.4 性能预算
- **零新增依赖**；新增/改造代码总量控制在 ~1800 行 TS/CSS 内（各组件按 §0.1 裁剪后估算），全部进主包；主包 gzip 增幅目标 ≤ +25KB，超了先裁 TiltedCard/Counter 的闲置功能，不许动 Board3D 分包（REQUIREMENTS §14 的 ~300KB gzip 预算与 R10 无关、不得侵占）。
- 所有 rAF 引擎必须**静止自停**（短名单组件均已如此：无运动即停帧），同屏持续动画只允许「可打出柔光呼吸」一处且用 CSS。
- `will-change: transform` 只挂在正被拖/正翻/正飞的单张卡上，结束即摘。
- PlaySpark 全局并发 ≤3 个画布、每个 ≤500ms 自毁（在 ClickSpark 的 MAX_BURSTS 之上再加我方上限）。
- 注：BorderGlow/Counter 内部会写 CSS 变量驱动 paint（背景渐变/数字条位移仍是 transform），不触发 layout；验收以真机帧率为准：中端手机全程 60fps 目标，Board3D 场景帧率不得因 R10 下降（同设备 R8 基线对比截图+录屏各一）。

---

## 5. 实施切片（Devin CLI / SWE-2）

> 通则：每片结束时测试全绿（基线 127 + 新增）、`git diff --stat src/game src/data` 为空、双视口截图存 `shots/`（r10 前缀）、R8 fit 指标复跑不回归（fill 0.658–0.660 / cover 0.0%）、THIRD_PARTY_NOTICES.md 同步更新。两片都**不许改** engine/stations/types/selectors/cards.json。

### Slice A — 卡片原语 + 抽任务 + 市场
**新建**（`src/components/cards/`）：
- `Hand.tsx`（BounceCards 改造：ReactNode 卡面、扇形/让位/弹入、键盘可达）
- `TiltCard.tsx`（TiltedCard 裁剪：倾斜+glare+翻面；含 foil 层开关）
- `useDragPlay.ts`（自研拖拽 + 投放区注册/命中 + 弹回；含 Magnet 吸附接入）
- `PlayableGlow.tsx` + `cards.css`（BorderGlow 改造、令牌化；含 §3.2 全部状态类、卡背、宝石）
- `CoinCounter.tsx`（Counter 裁剪：整数 0–99、滚动+朗读文本）
- `Deck.tsx`（自研：3 卡背叠 + 顶卡翻出，组合 TiltCard）

**改造**：
- `src/components/CardView.tsx`：按 §3.1 卡剖面重构（props 不变）
- `src/components/DrawTaskPanel.tsx`：Deck 仪式接入
- `src/components/MarketPanel.tsx`：扇形手牌 + 双投放区（篮子/留菜夹）+ tap-tap 保留
- `src/screens/Game.tsx`：底栏手牌区承载 Hand；金币总数换 CoinCounter
- `src/theme/tokens.css`：只新增（卡尺寸、发光色、扇形角度等）
- `THIRD_PARTY_NOTICES.md`：登记 BounceCards / TiltedCard / BorderGlow / Magnet / Counter 出处与许可证

**验收**：
- 手感四件：悬停回正上抬、拖拽跟随、命中吸附、无效弹回，桌面+触屏（真机或触屏模拟）各过一遍；tap-tap 全程可买下任意一张市场卡；键盘全程可完成一次购买；
- 截图：抽任务（翻牌中/落位后）、市场（扇形+发光+选中态）× 1280×800 与 874×402；
- 1024×768 底栏不新增换行（R6/R8 已知边界不恶化）。

### Slice B — 其余五站 + 结局 + 果汁道
**改造**：
- `src/components/EventPanel.tsx`：Deck 翻牌揭示 + 选项卡手牌
- `src/components/PartnerPanel.tsx`：邀请/提案/提议全卡化（§2.3）
- `src/components/BusPanel.tsx`：车票卡拖拽上车
- `src/components/ParentPanel.tsx`：图卡 TiltCard 扇 + selection flight（注意与 R9 状态点共存）
- `src/components/StorePanel.tsx`：货架扇 + 新卡面网格
- `src/components/CookPanel.tsx`、`src/screens/Feast.tsx`、`src/screens/Reflection.tsx`、`src/screens/BasketReview.tsx`、`src/components/WalletDrawer.tsx`：组装飞入、盘卡扇、TitlePop + CSS 流光、清单逐行弹入
- `src/components/cards/PlaySpark.tsx`（ClickSpark 改造 + 全局并发上限）：接入买入/上车/结算/完成四处
- `GlareHover` 裁剪版接入主按钮与弹窗标题条；SpotlightCard 仅在帧率验收有余量时接入弹窗面板（可选，做不了不算缺项）

**验收**：
- 全流程 e2e 可通关（现有 e2e + 人工各一遍），每站双视口截图各一（r10 前缀）；
- 家长站：真对话模式下选卡飞入不遮挡 R9 状态点、飞入后 `PARENT_ANSWER` 正常触发（沿用 R7/R9 的实测法复验一次）；
- 果汁道克制检查：任一时刻同屏迸溅 ≤1 处、foil 只出现在 §3.3 两处；
- 性能：中端手机录屏对比 Slice A 前基线，Board3D 帧率无可见下降。

---

## 6. 风险与待负责人拍板（仅 3 项真分叉）

1. **小屏市场扇形可读性**：874×402 下 6 张扇形卡每卡露出带较窄，菜名可能读不清。PM 方案：扇形保留，卡面只放图标+价格宝石，**名字在选中/检视时于卡上方浮出大字**。若负责人在 Slice A 截图验收时仍觉得挤，备选是小屏市场退回网格（卡面仍用新剖面）——二选一在 Slice A 验收点定，不返工原语。
2. **拖拽的定位**：拖拽是本轮门面，但 6–9 岁触屏拖拽失败率未知。PM 建议预先定死降级线：**tap-tap 永远是主路径、拖拽是加分项**；若 Slice A 真机手测拖拽手感两轮调不好，本轮即按「点选为主、拖拽仅桌面保留」收口，不无限打磨。需负责人确认这条降级线。
3. **闪卡效果打折**：HoloCard 因 WebGL 着色器被红线否决，CSS foil 的闪烁感弱于真全息闪卡（无棱镜颗粒）。当前方案只在完成菜谱/盛宴两处用微光膜。接受打折（PM 建议）还是宁可不用——负责人一句话即可，不影响切片排期。

---

## 附：实施清单（Devin 每片自查）

- [ ] 抄入的每个 React Bits 组件在 `THIRD_PARTY_NOTICES.md` 有条目（组件名、来源 URL、MIT + Commons Clause、改造说明）
- [ ] `package.json` 依赖零新增（`git diff package.json` 为空）
- [ ] `git diff --stat src/game src/data` 为空；派发命令与 §2 逐站一致
- [ ] tokens.css 只增不改；新色值全部来自现有令牌或其透明度变体
- [ ] 每个拖拽动作有 tap-tap 与键盘等价路径，且真机/模拟各验一次
- [ ] reduced-motion 下全流程可玩（抽查市场购买 + 家长选卡）
- [ ] rAF 引擎静止自停；PlaySpark 并发 ≤3；will-change 用后即摘
- [ ] 截图与 fit 指标按 §5 存档；测试全绿

---

## 附记：Slice A 落地记录（2026-11-17，PM 验收）

- 实现由 Devin CLI（SWE-2 Max）完成主体：`src/components/cards/` 八件原语齐备（Hand / TiltCard / useDragPlay / PlayableGlow / CoinCounter / Deck / cardArt / cards.css），CardView 按 §3.1 重构（props 不变），DrawTaskPanel 抽卡仪式、MarketPanel 扇形手牌 + 双投放区、Game 底栏与 CoinCounter 接入；三张 v3 卡图（番茄 / 番茄炒蛋 / 卡背）已入 `src/assets/cards/` 并登记 cardArt。
- Devin 在收尾验证阶段因运行环境重启中断（日志佚失），PM 接手验收：build 干净、**152/152 测试全绿**（133 基线 + 19 新增）、`git diff src/game src/data` 为空、R8 fit 复跑 fill 0.660 不回归、桌面市场扇/发光/选中态截图核对通过、手感四件（回正上抬/跟随/吸附/弹回）与键盘购买在 Devin 中断前的日志中均已实测通过。
- 遗留小项（转 Slice B 一并处理）：① 抽卡落位手机截图被演示条污染、桌面 draw 截图与 market 串名，需重拍一组干净的抽卡图；② 面板内扇形展开幅度偏紧（§6 风险 1 的实物），等负责人看试玩版后定是否放大扇面/改底栏手牌区；③ 触屏拖拽的 CDP 模拟验证未及留档，真机手测时补。

---

## 附记：Slice B 落地记录（2026-11-18，PM 验收）

- 实现由 Devin CLI（SWE-2 Max）完成主体，收尾时运行环境重启中断（日志佚失，进程已死），PM 接手验收并代提交：build 干净、**155/155 测试全绿**（152 基线 + 3 新增：PlaySpark 2、cardArt 扩展）、`git diff e6634bb..HEAD -- src/game src/data` 为空、R8 fit 复跑 fill 0.660 不回归（手机四档与 1280×800 均为 0.660）、package.json 与 tokens.css 零改动。
- 33 张 v3 卡图全部入 `src/assets/cards/` 并登记 cardArt（食材 13、菜谱 5、事件 9、诱惑 4、天气 3；`rec-tomato-egg-2` 复用番茄炒蛋图，两张邀请卡复用棒冰/贴纸图；未登记 id 仍走 emoji fallback，测试覆盖）。
- 各站落地：EventPanel 牌背 Deck 翻牌揭示事件卡、天气亦为卡面；PartnerPanel 选项成 TiltCard 小扇（点选/焦点即选中）；BusPanel 车票卡拖拽上车（useDragPlay）+ tap-tap 点票→点「上车」双路径，同发 `PAY_BUS`；ParentPanel 图卡 TiltCard 扇 + 选中飞入，R9 Live/Offline 状态点原样保留；StorePanel 货架 Hand 扇 + 新插画；Cook/Feast/Reflection 飞入集齐、Feast 币总计用 CoinCounter、foil 只在菜谱集齐与开饭两处；PlaySpark（ClickSpark 改 DOM+CSS 零 rAF 版，已登记 THIRD_PARTY_NOTICES）接在买入/上车/集齐/开饭四处，全局并发 ≤3；BasketReview/WalletDrawer 仅轻卡面（新增 MiniCardRow），流程不动。
- 截图 `shots/r10b_*` 共 22 张：抽卡翻牌/落位（演示条已关闭，干净重拍）、事件盖牌/翻牌/揭示、好友扇、家长扇、商店扇、车票、做菜、开饭 × 桌面 1280×800 与手机 874×402。PM 抽查两张通过：事件翻牌桌面（天气卡「晴」+ 事件卡「多送一」+ 两张选项卡在位）、开饭手机（四道菜 v3 图齐整，无演示条污染）。
- 遗留（转 Slice C / 待负责人）：① Slice A 遗留②③仍未定——扇形展开幅度、触屏拖拽真机手测；② 五透镜 critique 已出（`critique/LENS-*.md`），优化项见 Slice C 简报，不属本片范围。

---

## 附记：Slice C 落地记录（2026-11-18，PM 验收）

- 实现由 Devin CLI（SWE-2 Max）完成主体，收尾验证阶段运行环境重启中断（进程已死，日志仅存 `~/workspace/maicai-r10c.log` 前半段），PM 接手验收并代提交：build 干净、**171/171 测试全绿**（155 基线 + 16 新增：`tests/unit/r10c.test.ts`）、`git diff a029979..HEAD -- src/game src/data` 为空、package.json 零改动。R8 fit 未复跑：本构建无 `__fitD` 测点（`probe-fitd.mjs` 返回 null；`dist` 内亦无该钩子）；C 片未动 Board3D/相机/棋盘几何（`board.css` 仅改 bot 思考光晕与气泡样式，`Game.tsx` 无 3D 接线改动），fill 无回归路径。
- 逐项（P0/P1 14 项 + P2 3 项全部落地，逐项代码核对见下）：
  1. CoinCounter 不过冲：新增 `--ease-roll: cubic-bezier(0.23, 1, 0.32, 1)`，个位列错峰 40ms（CSS 验收测试覆盖）。
  2. 常驻动画预算：可打光晕改静态 + 700ms 一次性扫光，foil 一次性 900ms，bot 思考脉冲只动 opacity（`::after` 光圈）；事件牌堆待机 bob 为面板等待时唯一循环。
  3. 扇形可辨认：去名带（仅图 + 价码），选中卡名 ≥28px hero pill 全视口；≤3 张扇不重叠。
  4. 手机横屏扇不裁切：固定扇区 overflow 可见，露出 48px（`--fan-expose-sm` 35→48）。
  5. Tap-rescue：触屏起拖阈值 18px（鼠标 8px 不变），松手位移 <26px 且 <300ms 仍算点按（纯函数测试）。
  6. 后悔窗口：`PendingChip` + `usePending`/`pendingCommit`，1500ms 挂起可撤销（点飞卡亦可撤），用于家长图卡答案与市场/事件买入；命令集与 engine 不动。
  7. 事件牌堆提示：指示语「点一下，翻开看看」+ 待机微光/轻 bob。
  8. 不剧透：结果 toast/log 只在翻开完成后上屏（`revealed` 门控）；揭示态一大故事卡 + 两选项卡完整可读。
  9. 做菜高潮：CookPanel 食材卡飞入大盘/碟（220ms 错峰，<500ms 总预算）→ 菜谱图 + 蒸汽/火花 → foil 盖章。
  10. 家长站对话化：常驻家长形象 + 语音气泡提问，撤掉前置评分规则文（币释移至结算后表扬），每答复述孩子需求整句，可跳过「示范」对话，句首启口片「我想买…/我还差…」；R9 Live/Offline 状态点与 parentLive 流程原样保留。
  11. 一屏一主动作：买下/收下为唯一填充渐变主钮，虚线框只留给投放区与「先等等」。
  12. CoinBar：新加坡条形图（菜谱还差/车费/自由花），选中卡点亮自由花端格子，溢出警示脉动；「12 − 2 → 10」式余数同步显示。
  13. Bot 心里话：`botThink.ts`（按既有 log 事件出短理由气泡）+ 首圈首次进市场教练句（按孩子实际缺菜拼出）。
  14. Reduced-motion：去掉全局 0.01ms 清零，改为仅禁循环（`animation-iteration-count: 1`）+ 指定装饰动画 none；`cards.css` 内 120ms 减动效值生效。
  15. 对比度（P2）：`--color-muted` #6b6572→#55505e（奶油底 ≈7:1），功能文字地板 14→15px，主按钮字白→墨蓝（橙底 ≈6.4:1）；新增 `--color-purple-soft`（家长淡紫衬）、`--wheel-ms` 1300ms。
  16. Reflection 个性化：`reflectionPick.ts` 按孩子开饭账本排序选项。
  17. 触屏 hover 粘滞防护（hover 仅真指针设备）+ 转盘死区收紧（`--wheel-ms` 1300ms 起步快收尾慢）。
- Token 改动（红线要求列出）：`--color-muted`、`--font-size-xs`、`--button-primary-fg`、`--fan-expose-sm` 四处改值（见上）；其余为新增 token。无新依赖，无网络请求，`.env.local` 未动。
- 截图 `shots/r10c_*` 共 4 张（PM 自拍，Devin 未及出图）：市场扇/选中 × 桌面 1280×800 与手机 874×402。PM 抽查通过：桌面选中（hero pill「豆腐」+ CoinBar「12 − 2 → 10」+ 唯一主钮「买下（2币）」）、手机选中（CoinBar + 买下主钮 + bot 气泡「我也要！」）。
- 遗留（待负责人/后续）：① e2e 未跑完——本轮 e2e 在 8 项中 2 项失败后被运行环境重启打断（board3d canvas 渲染超时、fullgame 3.0m 超时；Devin C 日志中同类失败曾归因于并行 R8 截图抢占 CPU，另有一处真实 safearea 问题已由 Devin 修 scroll/pin 恢复逻辑——未及复跑验证）；② R8 fit 无测点未复跑（见上）；③ 事件揭示/做菜/家长入口等其余简报要求截图未拍（仅市场 4 张）；④ Slice A 遗留②③仍未定——扇形展开幅度、触屏拖拽真机手测。
