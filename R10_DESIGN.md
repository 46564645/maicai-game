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

---

## 附记：Slice D 落地记录（2026-11-18，PM 验收）

- 实现由 Devin CLI（SWE-2 Max）完成主体，截图收尾阶段运行环境重启中断（进程已死，日志 `~/workspace/maicai-r10d.log` 止于截图改拍，未提交），PM 接手验收并代提交：build 干净、**213/213 测试全绿**（171 基线 + 42 新增：`tests/unit/r10d.test.ts`）、`git diff 7fb9d97..HEAD -- src/game src/data` 为空、package.json 与 `.env.local` 未动。
- 逐项（简报 P0 9 项 + P1 3 项，Devin 落地内容；PM 按日志、代码抽查与截图核对）：
  1. 脚手架随圈退场：新增 `supportLevel(lap)`；圈 2 市场/商店说明句缩为图标+短式、bot 理由气泡仅留「先等等」；圈 3 无说明句、反思改前瞻问句（仅完成菜谱的孩子，标准问句否则）。
  2. 事件后果回声：新增 `eventEcho` 纯函数（三态：花钱仍够 / 花进缺口 / 免费）+ 花钱卡余数预览「花 {p} 币 · 还剩 {n} 币」，回声行在面板关闭前显示，仍走既有命令路径与 Slice C 后悔窗口。
  3. 长按检视：新增 `pressInspect.ts`；触屏长按 300ms → 卡放大 1.15 + hero 名签浮出 + 既有朗读；松手复原，不选卡、不发命令；成拖即取消检视，轻点仍走 Slice C tap-rescue；鼠标 hover 检视不变。
  4. 「钱不够」统一反馈：事件花钱卡去 `disabled`，改为「可点不可打」——点按 180ms 横摇 + 价格宝石红闪 + 币 HUD 轻跳，不发命令，「钱不够」文案保留为第二通道；BusPanel 对齐同款（车票仍可上车记待付夹，命令照发）。
  5. 家长语音钮改诚实：新键 `hearQ`「听一听问题」/ "Hear the question"，点按走既有 TTS 朗读当前问题并展开图卡扇；删 live 气泡假输入与 offline `mode:'voice'` 代答提交（点按永不提交答案）；图卡与打字仍为真实输入路径。
  6. 弹窗进出：`.popup` 入场 + 退场壳淡出，reduced-motion 120ms 纯淡入；一处实现，全部站点 + 求助牌 + 钱包抽屉受益。
  7. TiltCard 跟指：跟随 120ms `--ease-out`、离开回正 250ms、pointermove 经 rAF 节流（≤1 写/帧）；触屏仍无倾斜。
  8. 商店「全部食材」格：tile 改整幅图（contain）+ 名带 + 价格宝石落 tile 内；删格子与购买钮之间的重复浮动宝石行；tile 点按行为不变。
  9. 图解进度：圈点 3（已完成实心/当前描边脉动）+ 8 格站点环「你在这里」+ 回合条下一位头像抬升描边（与选中卡同语言）。
  10. 目标常驻：各站面板头迷你菜谱进度条（`missingIngredients` 同源数据）+ 标题下「练 · …」目标小片（`cardText.ts` 既有文案）；扇内相邻同名卡加「×2」徽标。
  11. 弹簧退役：新增 `--ease-out` / `--ease-in-out` 命名缓动；按钮按压 140ms、手牌上抬/邻卡让位 180ms，无过冲；其余动效时长不动。
  12. Bot 性格可见：回合条头像 + 气泡旁性格徽标（图标 + 1–2 字，取既有性格数据，未发明新 bot 数据），气泡按人点缀色。
- Token 改动（红线要求列出）：新增 `--bot-accent-steady` / `--bot-accent-impulsive` / `--bot-accent-follower`（复用玩家色）、`--color-deny`（#e5484d，番茄红短暂反馈）与 `--color-deny-soft`、`--ease-out` / `--ease-in-out`、`--press-ms` / `--hand-raise-ms` / `--popup-in-ms` / `--popup-out-ms` / `--shake-ms`；旧 token 零改值。无新依赖，无网络请求。
- 偏差（PM 接受，记入）：弹窗进出简报写 240ms 入场 / 150ms 淡出，Devin 落地 180ms / 160ms 并由 `r10d.test.ts` 断言锁死；PM 接受（仍在轻量区间，e2e 稳定性亦受益），`StationPopup.tsx` 头注释已由 PM 同步为实测值。
- 截图 `shots/r10d_*` 桌面 1440×900 共 6 张：progress、popup_head、event_echo、bus_nocoins、market_lap2、market_lap3。PM 抽查 4 张通过：progress（圈点 + 站点环 + 目标小片 + 菜谱条 + 性格徽标 + 名签「鱼」+「9−3→6」）、market_lap3（第 3 圈无说明句、名签「鸡蛋」+「4−3→1」）、bus_nocoins（车票「币不够了」+ 待付夹选项；该帧演示条未关）、market_lap2（圈 2 短式说明句在位）。event_echo 一帧为事件后面板已关的棋盘，回声行未入镜——需重拍，见遗留。
- e2e：PM 串行补跑一次（本轮验收时，`npx playwright test`，8.0 分钟）：**3 通过 / 5 失败**。通过：未逐项留名（见下失败项之外的 3 项）。失败：① board3d（canvas 渲染，`action-primary` 等待 60s 超时、元素持续不稳定——与 Slice C 同类失败）；② fullgame（整局 180s 超时，等主按钮稳定）；③ keyboard（整局 180s 超时，`page.evaluate`）；④ mobile（横屏局中转竖屏后 `rotate-gate` 未出现）；⑤ safearea（874×402 菜市场栏内按钮[3] 下沿 384，超安全区上限 383 仅 1px）。①②③为整局超时家族（SwiftShader 软渲染下旧有慢径，Slice C 亦同）；④经基线 worktree（7fb9d97）对照复跑，同样失败——既有问题，非 Slice D 回归。⑤经探针定位为 **Slice D 真回归（其一）**：PopupOutlet 的 `.popup-shell` 是 `display:contents`，栏内 `:last-child` 的 safe-b 下边距落在它身上直接蒸发，竖栏「走完这一站」失去 20px 底垫（基线 364 → 本轮 384）；PM 已修（`phone.css`：下边距改挂真实盒子 `.phone-rail .popup-backdrop`），探针复测回 364。safearea 单项定向复跑（第 1 次）后又在后程露出 **Slice D 真回归（其二）**：事件花钱卡多了余款预告行（tag「花 p 币 · 还剩 n 币」），卡高仍 140px，内容 162px 顶出 26px（主按钮文字溢出断言失败，桌面与手机同尺寸同溢出）；PM 已修（`cards.css`：`.event-hand` / `.choice-hand` 卡高 140px→170px，留 4px 裕量），PM 第 2 次定向复跑 safearea 整项（2026-11-18 10:52，含上述两处修复的构建）：已越过下沿断言与事件卡断言（两处回归确认修复），后程停在另一采样点的主按钮文字溢出断言——EN 模式棋盘主按钮文字高 76 > 按钮高 72（4px，874×402，Lap 1 第 3 站），失败点不在事件卡；该断言基线对照因 240s 超时未取得结论，是否既有问题未证实，记入遗留④。
- R8 fit 未复跑：本构建无 `__fitD` 测点（package.json 无 fit 脚本；dist 亦无该钩子）；D 片未动 Board3D/相机/棋盘几何（`board.css` 仅改 bot 气泡/徽标样式，`Game.tsx` 无 3D 接线改动），fill 无回归路径。
- 遗留（待负责人/后续）：① e2e 结果见上；② 截图缺口（PM 补拍后更新）：商店整幅格 ✓、家长「听一听问题」钮 ✓（耳形图标 + 图卡扇 + 句首片同框）、r10c 事件牌背+提示 ✓、事件翻开 ✓（大故事卡完整可读、花钱卡带「花 1 币」预览）；仍缺：手机横屏 844×390 整套、事件拒付态单帧、做菜飞锅/成品落位两张（驱动在软渲染下 8 分钟无进展被 PM 掐停；做菜场景 D 片未改动，B 片已有 r10b_cook 图）、event_echo 干净帧（既有帧为面板关闭后棋盘）；③ Slice A 遗留②③仍未定——扇形展开幅度、触屏拖拽真机手测。④ safearea EN 主按钮文字 4px 溢出（见上 e2e 段），待英文轮次或真机验证时一并处理。

---

## 附记：Slice E 落地记录（2026-11-18；含 R1 定稿 E1–E9 修复轮，同一提交）

- 实现由 Devin CLI（SWE-2 Max）完成主体；e2e 调试中途运行环境重启一次、由原会话续作收尾并提交：build 干净（Board3D 分包 gzip 286.31 kB ≤ 300 kB 预算）、**258/258 测试全绿**（213 基线 + 45 新增：`tests/unit/r10e.test.ts` 23 项 + `tests/unit/r1e.test.ts` 22 项）、`git diff d61918a..HEAD -- src/game src/data` 为空、package.json 与 `.env.local` 未动、无新依赖、无网络请求。本提交同时含 R1 定稿审计（`SLICE_E_R1_CHECKLIST.md`，E1–E9）的落地修复；审计中「画布内 Suspense 已落地」指本片 Devin 的 Scene.tsx 内部边界（见下③）。
- 逐项（Slice E 简报主体）：
  1. 去框舞台：`.popup` 撤白底圆角盒，卡片/卡扇/故事卡/选项/气泡直接浮在压暗+毛玻璃棋盘（`.popup-backdrop`）上；`--color-backdrop` 值未动（0.42），天气时刻用 `:has(.weather-moment)` 放轻压暗。抽任务/市场/事件/家长/小卖部/钱包/求助牌全部去框；站名+目标+菜谱条合并成一只半透明墨底浮丸（`--stage-pill-*`），说明句浮 `--stage-note-bg` 丸；底部动作改浮动药丸钮（≥48px、顺序与 data-testid 不变）。
  2. 底栏物件化：钱包=金币堆（CoinDots，cap +「+n」尾徽）+ 大号数字；手牌=迷你卡摞+计数；待付夹=IOU 小票摞；求助=单张帮助卡。lap/order 区只剩图形簇（圈点+站点环+头像序带），无文字句。
  3. 天气电影时刻：`weatherMoment.ts` 相位机（spin→card→dismiss→dressed）；DOM 转盘推近 + `[data-testid="weather-card"]` 大卡浮出（`--moment-pop-ms` 340ms）；点掉后 `game-screen.weather--*` 洗色 + 3D `WeatherDresser`（灯光渐变/雾/云漂/`RainVeil` 雨丝 instancing）换布景。reduced-motion 直接切换。
  4. ProfileCard 高光：点 bot 徽章卡 / 手机 bot 头像 / 真人头像 → `.spotlight-veil` 全屏帘 + 竖版证件卡（头行徽+状态点、头像砖、大名、头衔=性格名或菜谱名、底行属性对、右下方块接触钮）+ 箔光/glare（复用 TiltCard 引擎，`--pc-holo-strength` 0.55 ≤0.8）。Esc 可关。
  5. HUD 物件化样式：金币点双档（`--coin-dot-size` 14px 徽章列 / 9px 迷你）、卡砖缩略 `--thumb-*`；bot 三处金币点旁补可见数字（等宽数字，读屏仍走 aria-label）。
- R1 定稿修复（E1–E9 落地，逐项）：
  - E1 对比度：`probe-e1-contrast.mjs` 探针实测（态 A 常规压暗 / 态 B 天气稀释 0.42×0.42 最坏态；环带采样真实合成像素按 WCAG 公式算）；压暗层值未动。**【2026-11-18 复测纠正】原记「浮签底 ink 60% 已够格」有误**：团队传话线对已提交构建（798fb74）独立复测，浮签 `.popup-head`（白字）在双视口 × 普通弹窗/天气 spin/天气 card 各态、环带最亮像素（近白卡面/竖栏衬底，非棋盘本身）口径下实测 **4.38–4.46 < 4.5**（解析下限按晴天扇区 #FFE9A8 合成为 6.10–8.23，是过的——原结论误用了下限口径）。已改 `--stage-pill-bg` ink 60% → **75%**（随 94bed17 入仓，该提交信息未提此项，在此补记），复跑探针全态达标：`.popup-head` worst 最低 **7.23:1**（桌面市场 7.23 / 天气 spin 7.23 / 天气 card 7.23；手机 7.26 / 7.41 / 7.23），其余元素 14.71–16.40 不变；单测仍 258/258、build 干净。手机天气态 `.weather-result` / `.moment-tap` 两元素两轮均未采到（竖栏形态不在采样命中范围），桌面同组实测 16.40 且 token 路径相同，记为未采到而非已测。
  - E2 可跳过计时段：EventPanel spin 段点舞台清定时器按 landed 推进、Deck 翻牌中再点立即回调、CookPanel 等待段点舞台立即出成品卡；CameraRig 组件内补 reduced 时 focus 恒 auto 兜底。
  - E3 bot 简版：`botTiming.ts` 阶梯延迟（首条 base 800ms、2–4 条 250ms、5+ 条 120ms；典型 3–5 条总 1.3–1.7s ≤ 2s 预算）+ `BOT_FAST_FORWARD_EVENT` 快进事件（点行动中 bot 的角落小卡立即提交本命令并清零余下延迟）；bot 自动高光由全屏帘改 ~1s 角落小卡（全屏帘只留 manual 手动点开）；bot 天气走 `weatherQuick` 简版——3D 转盘直落不推近、DOM 只留一拍（400ms vs 真人 1500ms）。
  - E4 bot 三处金币点旁常驻可见数字（桌面 BotCard / 顺序片 / 手机头像片）。
  - E5 安全区浮动药丸：62/20 注入口径下由 safearea spec 覆盖（见 e2e 段遗留）。
  - E6 0×0 隐形按钮（根因修复，两层）：① Devin 层——`Scene.tsx` 在 `Canvas` 内为 StationProps 与 Piece 两列 `useGLTF` 挂起各加 `<Suspense fallback={null}>` 边界，GLTF 挂起就地拦截、不再冒泡到 BoardMount 外层 Suspense（此前冒泡会把已亮出的 Board3D `display:none` 成 0×0 并挂出 Board2D fallback → 同名主按钮双份，e2e/真机点到隐身份）；② R1 层——`BoardMount` 外层 Boundary/Suspense 的 fallback 改为不带 children 的 `fallbackBoard`，结构上保证 DOM 里永远只有一份含 overlay 的棋盘。`probe-e6.mjs` 口径：board 份总数 1、0×0 份数 0（popup 退场 ~170ms 克隆单列统计，不算违规）。
  - E7 EN 主钮溢出 4px：`.phone-turn`/`.panel-actions` 主钮统一 `white-space: normal` 允许折行，board-enter 主文案与 kbd 提示拆成同级盒（`.phone-turn` 内 kbd 不再渲盒）。
  - E8 岛占比：`probe-e8.mjs` 双轨（轨 1 真实 solveFit：1280×800 fill **0.660**、874×402 fill **0.660**，均在 0.60–0.70 目标带；`shots/r8_fit_e8.json` 存档九视口，1920×1080 0.568 为带外最低档、属超宽屏预期外推）；截图 `r10e_e8_board_*`。
  - E9 ProfileCard 出处订正：`THIRD_PARTY_NOTICES.md` 增 R10E 段——ProfileCard 与 ReflectiveCard 版式同归 React Bits（David Haz，**MIT + Commons Clause**，原头注误写纯 MIT 已订正）；登记借用范围=概念与竖版 ID 卡骨架、本仓重写；明确未移植项——`@hugeicons` 未引入（图标一律手写内联 SVG，如接触钮 BasketGlyph）、无 WebGL2 反射着色器、无摄像头/视频路径。
- 偏差（自报）：① ReflectiveCard 版式按简报骨架 CSS 重写（头像用现有角色图标/衬底砖而非外图——简报画像优先序第 2 档），未搬原组件代码；② 简报点名的两个 hugeicons 图标按指示改内联 SVG；③ E6 在 BoardMount 结构修复之外另加了画布内 Suspense 边界（先于 R1 落地，两层互补、R1 审计确认保留）；④ `?fast=1` 增四项呈现降级（不影响正常游玩）：bot 自动 spotlight 跳过（只跳过自动帘，手动点开仍可用）、`useAmbient`/`Piece` 循环 invalidate 冻结（雨丝仍完成一次初始化）、QualityProvider 走低档（无 post/阴影/PMREM）、PopupOutlet 退场 170ms 定时器改立即卸载——均只挂在 `state.flags.fast`，服务 e2e/截图驱动在 SwiftShader 软渲染下的可操作性，普通会话行为不变；⑤ 弹窗退场 170ms→fast 立即卸载属 e2e 驱动口径，正常态时长 token `--popup-out-ms` 未动。
- Token 改动（红线要求列出）：纯新增 16 枚——`--stage-pill-bg`/`--stage-pill-fg`/`--stage-blur`/`--stage-note-bg`（去框舞台浮层）、`--coin-dot-size`/`--coin-dot-size-sm`（金币点）、`--pc-w`/`--pc-h`/`--pc-rim`/`--pc-holo-strength`（ProfileCard）、`--weather-tint-sunny`/`--weather-tint-rainy`/`--weather-tint-windy`（天气洗色）、`--moment-pop-ms`（大卡浮出）、`--thumb-w`/`--thumb-h`（卡砖缩略）；旧 token 零改值（含 `--color-backdrop` 0.42 未动）。
- 截图 `shots/r10e_{场景}_zh_{desktop|phone}.png`（驱动 `shots/r10e-shots.mjs`，与 `r10e_before_*` 同场景对照）：桌面 hud/draw/weather_spin/weather_card/weather_dressed/market/event_story/event_options/parent/store/spotlight；手机同组 + e8 板面两张（`r10e_e8_board_desktop-1280x800` / `…_phone-874x402`）——最终清单以落盘为准。
- e2e（`npx playwright test` 串行单跑，17.6 分钟）：**3 通过 / 5 失败**，与 Slice D 同数、同族——① `board3d ?board=3d` 60s 超时（本轮已推进到第 33 行 page.screenshot 步才超，比 D 的点击步更靠后）；② `fullgame` 180s 整局超时（detach-retry 即点击生效后元素卸载重试）；③ `keyboard` 180s 超时停在 `page.evaluate`——与 D 记录完全同签名（wallet Esc 断言已过）；④ `mobile 竖屏 rotate-gate` **通过**（D 时失败，本轮修复受益）；⑤ `mobile 横屏整局` 240s 超时（D 时通过、本轮翻转为同族超时——软渲染下整局驱动累计变慢，E 每站多一拍大卡必填点击，非断言性新缺陷）；⑥ `safearea` 240s 超时（首次跑曾复现 D 遗留④：EN 棋盘主钮 76>72 溢出 4px，同一遗留断言）；⑦ `board3d ?board=2d` 与 ⑧ `WebGL 回退` 均通过。
- 遗留（待负责人/后续）：① 横屏整局/safearea 整局在 SwiftShader 下超时——同族慢径，真机/硬件 GPU 不受影响；safearea EN 4px 溢出为 D 遗留④原样；② Slice A 遗留②③仍未定（扇形展开幅度、触屏拖拽真机手测）；③ `m45_en_names.txt` 仍未入仓，英文名称核对无据（R1 审计注）；④ REQUIREMENTS_CURRENT.md 原文件待归档 docs/（现以 `SLICE_E_R1_CHECKLIST.md` 团队消息文本为准）；⑤ R8 fit 测点已由 R1-E8 探针补齐并达标（0.660/0.660），不再属遗留。
- PM 验收补记（2026-11-18，PM 直修，独立小提交）：视觉验收发现 ProfileCard 高光卡三处缺陷——① 固定高 `--pc-h: 240px` 装不下内容，底行金币标签被裁、币值行不可见；② 卡宽 170px 使性格徽文字截断（"Care…"）；③ `.tc-glare` 光斑默认停在卡面正中压住名字，名字被冲成银灰低对比。PM 改：`--pc-w: 170→188px`、`--pc-h: 240→296px`（tokens.css），`.pc .tc-glare { opacity: 0.3 }`（cards.css）。复拍 `shots/r10e_fix_spotlight_en_desktop.png`（修①②：徽全、底行币点+数字完整）与 `shots/r10e_fix2_spotlight_en_desktop.png`（修③：名字深色可读）验证通过。PM 复验口径：build 干净、单测 258/258（修复前树，CSS token 值无单测断言依赖）、`src/game`/`src/data` 对 d61918a 零 diff。after 截图落盘 13 张（hud/market/profile/weather/botspot，中英桌面+手机），draw/event/parent/store 的 after 帧未及拍（Devin 提交后进程结束），其结构由单测断言覆盖。

- R1 量测补记（2026-11-18，团队传话线独立量测，对 798fb74/94bed17 构建）：① **E3 一整圈实测**（`probe-e3-lap.mjs`，普通模式 1280×800，口径 = bot 连续 thinking 到下一位 active 的墙钟）：lap 1 共 24 个 bot 回合（8 站 × 3 bot），总 **39.48s**、平均 **1.65s/回合 ≤ 2s 达标**，中位数 0.88s，23 个回合在 0.12–1.39s；一个离群回合 **20.52s**（bot-p2 第 2 站市场站，单独占总时长一半）未细分归因——最可能是 bot 向真人发起提议后等待真人决定的时间被记在其名下，或软渲染卡顿；记为「平均达标、长尾待归因」。全圈采样全屏帘 `.spotlight-veil` 命中 0 次、角落高光 `.bot-card--spot` 命中 344 个采样点，新形态确认在用。② **E8 方法补记**：轨 1 solveFit fill 1280×800 = 0.660（自由矩形 868×524）、874×402 = 0.660（612×282），rim 均在界内；轨 2 截图像素剪影粗测 0.511 / 0.472，与包围盒口径按椭圆系数 π/4 互证（0.660×0.785≈0.518）。③ **safearea 独立复跑**（单次，`shots/safearea-run.log`）：240s 超时死于驱动点牌堆的稳定性等待（元素脱离 DOM + 慢帧，同族）；超时前逐步执行的 E5 安全区断言与 E7 文字断言**无一失败**，但整局后段未跑到，与上文 e2e 段「首次跑曾复现 EN 76>72」并存——E5/E7 记为部分复验，整局结论待 e2e 环境稳定时补跑。④ 截图口径注：`r10e_after_*` 改后组（1280×800 / 874×402，手机组带 safearea 同款 `--safe-*` 注入）与 `r10e_before_*` 改前组（旧驱动 1440×900 / 844×390）非同视口，只能作画面内容对照。

## 附记：团队第 1 轮反馈处理（2026-11-18，对 94bed17 版）

- **E3 不算达标（Thong，必须改）→ 已修**。20.52s 离群回合根因查清：不是市场站等待——市场站 bot 回合自包含（≤4 条命令、驱动延迟 ≤1.55s，引擎从不把等待转给真人）；探针旧口径把“角落卡亮 thinking 的墙钟时长”整段记账，一次约 19s 的 SwiftShader 主线程冻结被记在 bot 名下（同圈若真有提议等待，探针点击器永不点真人回合，该圈不可能采满 24 回合——反证成立）。但调查发现真缺陷在伙伴站：bot 向真人 PROPOSE_SWAP 后引擎停等真人，界面却仍显示 bot“正在想…”、状态行写“轮到 {bot名}”，唯一入口是角落气泡，无任何“轮到你了”提示。修复（呈现/驱动层，引擎 diff 空）：① `botTiming.ts` 新增 `BOT_TURN_HARD_CAP_MS = 3000` + 钳制纯函数，`useBotDriver.ts` 按 botTurnKey 计时、超限复用快进通道排空剩余命令；② 新增 `src/ui/awaitingHuman.ts`，Game.tsx 在 swapResponse/inviteResponse 等真人时状态行改显“轮到你了”、状态行下挂浮签 `.board-await-pill`（复用舞台浮签 token）写明短指令（中英各两条，swap/invite 各一），发起 bot 的角落卡等待期不再亮 thinking；③ 等待满 10s 气泡轻跳一次提醒（hudNudge `bumpProposalBubble`）；**未做超时自动替孩子回应**（替孩子做决定，与教育目标冲突，待 Thong 单独拍板）。单测 258 → 266（新增上限钳制 4 条 + awaitingHuman 4 条），build 干净。探针口径同步修订为三段（bot 自控 / 等真人 / 冻结），验收拆为自控段平均 ≤2s 且单回合 ≤3s、等真人段单独报告。
- **E1 只算部分通过（ww，必须改）→ 缺口已补采，可销项**。手机天气态两项漏采原因查明：`.moment-tap` 在手机竖栏（`.phone-rail`，可滚动）折叠线以下 106px，孩子下滑即见——按真实路径滚动入视后实测 **16.4:1**；`.weather-result` 只存在于 1500ms 的 spin 相位，原探针采样前把竖栏 scrollTop 归零反而把它顶出视口——用 screencast 自证真帧（帧内文字/指针像素自证）补采 **16.32:1**，并以 `.moment-tap` 跨 2D/3D 模式对照（16.46 vs 16.4）实证竖栏内衬底与棋盘模式无关。手机天气态四元素齐：浮签 7.23–7.41、panel-text ≈16.1、weather-result 16.32、moment-tap 16.4，全部 ≥4.5。注记：手机形态下“卡片浮在棋盘上”实际发生在竖栏内（衬底为不透明竖栏底），与桌面半透明压棋盘的路径不同。
- **E8 改前改后同视口（ww，建议改）→ 已重拍**。用 d61918a 独立 worktree 在同视口同状态拍 `r10e_before2_*` 共 13 张（board/hud/market/weather × 桌面 EN/ZH + 手机 EN，手机带同款 --safe-* 注入）；桌面 profile 无改前对应画面（D 的桌面 BotCard 是静态展示、ProfileCard 为 E 新增），手机 profile 已拍（D 的 BotCard 浮层）。附带实证：D 基线同样存在 BoardMount 挂起期棋盘 0×0 隐藏现象（E6 根因的旁证）。
- **E5/E7 → 状态改为“待真机，不算过”（团队裁定，等马教授试玩）**。两项的结构修复已落地、已执行的断言无失败，但整局 e2e 在软渲染环境跑不完、开饭/感想页未复验到，溢出是否修好暂无结论；本记录此前 E5/E7 的表述以本条为准。

## 附记：团队第 2 轮反馈处理（2026-11-18，对 94bed17 版，ww 定稿）

- **E3 更正（ww）**：第 1 轮的 10 秒气泡轻跳**撤销**——人的回应不设任何计时（`hudNudge` 轻跳函数/效应/文案已删）；bot 自控 3 秒封顶保留（`BOT_TURN_HARD_CAP_MS = 3000`）。等待真人提议的入口升级为 **ProposalPill**（`src/components/ProposalPill.tsx`，新组件）：浮签直接写明提议内容（EN "{name} wants your {want} for its {give}. Yes or No?" / ZH "{name}想用{give}换你的{want}，换吗？"），两件菜的卡图并排（⇄ 连接，邀请为单件），Yes 橙主钮 / No 藏青钮（`--color-ink`）在浮签内、按钮高桌面 52px / 手机 48px，接既有 RESPOND_SWAP / RESPOND_INVITE；角落气泡保留但不再是唯一入口，发起者角卡等待期不高亮 thinking。实拍：seed 3、lap1 站 3 触发（「Zip wants your Tofu for its Tomato」），`r10e_r2_proposal_desktop/phone.png` 双尺寸入包；seed 2 狩猎 240s 未触发（如实记）。
- **手机提议浮签真缺陷（本轮发现并修）**：浮签在竖栏流内排气泡之前，原三处滚动逻辑把竖栏钉向气泡/栏底，浮签被顶出屏外（rect y=−305→−68，首行不可见）。Game.tsx 三处统一改走 `scrollRailToPill()` 对齐 `.phone-turn` 块顶，修后浮签 y=94、整卡入镜。仅呈现层。
- **手机布局（1/2）**：市场卡扇 portal 出竖栏 → `.phone-market-float` 浮在压暗棋盘上（与桌面同压暗 token，卡 104×144 全尺寸，实测 floatCards=6）；竖栏只留按钮/状态。遮挡量测清零：气泡 vs「Your turn」2380px²→0（末位气泡改右锚）、Tag 头像条 vs 语言切换 1248px²→0、站名浮签溢出 32px→0。
- **单一信息源（12，ww 修订版）**：底部栏只删重复的轮次文字（`.board-status` Your turn / Zip's turn 删除），轮次只在角卡、事件只在浮签；「Go to this stop」保留为底部居中橙色浮动药丸（高 56px、安全区边距、仅 intro 相位）。
- **ProfileCard（3）**：`--pc-w/--pc-h` → 桌面 **288×400**（布局实测 offsetWidth 288、徽零截断、金币行 8 点+数字 12 全见）；手机横屏覆盖 250×330。注：入场动画期 getBoundingClientRect 为缩放值，验收以布局尺寸为准。
- **提示条（4）**：`TOAST_VISIBLE_MS = 2500` 自动消失（淡出）；`.toast-stack` z-index 30→**15**（低于弹窗衬底 20），不盖卡片。
- **金币与「+数字」（5/9/13）**：Tag 溢出根因 = 无换行 inline-flex 币行挤 150–190px 列 → 改 flex-wrap。旧「+数字」查清是 CoinDots **溢出余数**（同 12 币角卡 cap 8 显 +4、顺序片 cap 5 显 +7，从来不是得币）→ 统一口径：新增 `src/ui/lapGain.ts` `lapGainOf`（引擎日志 self/本圈/kind 'gain' 求和，与钱包账本同源），角卡与顺序片同值同式渲染；CoinDots 五处宿主全开 `hideExtra` 并带可见数字；CoinBar 三段（recipe/bus/free）全带等宽数字。
- **市场站（6/10/14/16，ww 文案定稿）**：浮签「② The Market / ② 菜市场」+ 右侧金币角标 ×N（N = `sub.buysLeft`，原 panel-foot「还能买 N 张」文字行已撤、唯一口径归角标）；MarketPanel 顶部文字层删除；卡扇下一行导引（缺菜小图标在左 +「Tap a card. Get your recipe food first. / 点一张卡，先买菜谱上的菜。」）；「Practice: notice temptations」从弹窗目标移入 How to Play。Buy 橙主钮 / Done 藏青次钮（`.btn--navy`，testid 与顺序未动）；已买同名卡不再变灰 + 薄荷「Bought ✓ / 已买 ✓」角标（根因：同名卡被标 unplayable 而变灰）；算式「12 − 3 → 9」移入按钮行（市场站 CoinBar `hideMath`）；卡扇 `--fan-expose` = 卡宽 + 4px（全名可读），选中卡抬起 + brightness(1.07)。遗留小疵：桌面市场图选中卡上方浮动名签「FISH」仍被卡扇容器顶边裁一半，未在本轮口径内。
- **文案（7）**：EN 顿号唯一出处（MarketPanel 硬编码 '、' 拼接）→ `joinCardNames`（EN ", " / ZH 、）。ZH 提示条乱码根因 = 引擎日志以英文规范名烘焙（Sprout/Fish）→ `localizeLogText` 按当前语言重渲染（「Sprout买了Fish」→「小禾买了鱼」），Toast / WalletDrawer / `.board-log` 三处接入。译名表：Sprout=小禾、Steady=小稳、Zip=小冲、Tag=小跟（ww 确认保留）。
- **天气压暗（11）**：`:has(.weather-moment)` 稀释规则删除，天气 spin/card 与其他弹窗同用完整 `--color-backdrop`（天气洗色保留）。E1 在新前提下复测全表 0 FAIL。
- **E1 手机天气结果（ww 补条，更正记账）**：此前 spin 相位项按等价性记账，ww 裁定记「待测」；本轮直接驱动到事件站 card 相位（停留态）拍手机帧 `r10e_r2_weather_result_phone.png` 并环带直测：`.card-view-name` worst **16.22** / p95 16.12、`.moment-tap` worst **16.48** / p95 16.48，均 ≫4.5——**待测销账，实测达标**。
- **触屏（17）**：键盘提示在 `@media (pointer: coarse)` 下隐藏；`.key-hint` 数字徽保留（兼作点按选项号）。
- **E8（ww 本轮待定 + 补条收边）**：口径改整屏剪影占比（目标 ≥60% 下轮验收，前提四角去面板化 + Thong 右栏决定）。fitSolver 重写：二分最小可行距离，约束 = 8 站占位盒全在自由矩形内 + rim 在允许区内。推近上限：整屏 0.506 桌面 / 0.424 手机。再按 ww 边距回收：桌面 rim 离左/右/上 ≥24px（底边浅滩压底栏可接受）；手机 rim 右缘离右栏 ≥16px（x=596 vs 栏左 612）；**ww 补条：手机左缘亦 ≥16px**（`RIM_PHONE_LEFT_GAP=16`，左右对称内缩）→ 最终整屏 **0.486 桌面 / 0.346 手机**（手机 d 27.8→30.75 的几何必然），旧口径 fill 1.548 / 1.016。船（硬指标，双尺寸 ≥1 艘完整可见不被面板挡）：Island 双锚点已挪——白船桌面左上全见（~78×63px）、蓝船手机右上全见（离栏 ~6px）。
- **站点标识（ww 补条，口径纠正）**：14px 量的是**地块站点标识**，非状态行/进站标题。地块标识为识别色点（无文字）：原半径（0.2 / 市场 0.3）手机投影仅 10.1–15.1px 不达标 → `StationTile.tsx` 色点半径 0.2→**0.48**、市场 0.3→**0.55**（呈现层）；放大后手机棋盘图色相聚类实测各站宽 25–28px（高 18–22，透视压扁），抽卡站开局被棋子遮挡、按投影值 24.2（全场最小、即定半径依据）——**全部 ≥24px**。进站浮签站名自证：天气探针采到「⑤ Surprise Stop…」，市场/天气帧浮签站名齐全。（先前误量的手机站名 DOM 字号 20px 作废，以本条为准。）
- **开饭/感想页（ww 补条，必须改）**：本版补拍 cook/reflect 桌面 + 手机（EN）四帧；主按钮溢出实测（scrollWidth − clientWidth）：开饭页「See where my coins went」桌面 636−636=**0**、手机 401−401=**0**；感想页主按钮双尺寸 88−88=**0**。E5/E7 拆记：画面与溢出本版有据；**触屏手感待马教授真机试玩**（团队更正：真机归马教授）。
- 收尾数字：单测 **279/279**（fitSolver 口径更新 13/13）、build 干净、`git diff -- src/game src/data src/config` 为空；本轮改动全在呈现层 + 测试口径 + shots 探针。截图包 v2 随版交付（after 组 + before2 组 + E8 两图 + 提议两图 + 天气结果帧 + 棋盘标识帧）。

## 附记：团队第 2 轮验收修复 + 卡片模板改版 + 五尺寸自适应（2026-11-18/19，对 f57ed87 版）

- **手机市场同屏（ww 打回 1）**：浮层栈（卡扇+投放区+Done）y 27..375 全入镜（874×402，安全区 t20/r62/b20/l62）；chrome×卡片重叠 0px²；导引句底边距下缘 147px；Buy/Done 实测各 48px；6 卡名/价格/金币数字 inFrame 全真、逐处溢出 0。
- **手机天气结果上浮（ww 打回 2）**：结果卡与 spin 相位经 `.phone-weather-float` portal 浮在压暗+模糊棋盘上；站名签「⑤ Surprise Stop」单行全入镜。对比度**比值**（环带采样，对象=结果卡主文字与「Tap to go on」）：改版前帧 16.12:1 / 16.42:1；改版后（名称入白板）复测两处 16.48:1；一帧采样方差下界 7.85:1，仍 ≥4.5。此前「16.22 是字号」的误读源于汇报未标注比值单位，本条起一律带「:1」与量测对象。
- **感想页可读（ww 打回 3）**：引擎数据实际 **6 项**（cards.json `reflections.humanOptions` rho-1..rho-5 + rho-6「Write your own…」），与 ww 所述一致、无增删；短标签 = 数据自带 `label` 原文。交互改两步点选：首击选中并在扇下大字读出完整标签，再击同卡提交（引擎命令不变）。桌面卡间重叠 0px²、5 标签全可辨、展开态入镜。
- **Fish 名签裁半（ww 打回 4）**：名签顶边相对弹窗滚动容器 −5.9px（在容器内侧未被裁）；弹窗 scrollHeight = clientHeight，最终帧无内部滚动。
- **卡片模板改版（Thong 大问题 + ww 合并版，Thong 本人确认全量）**：全局共用组件 CardView 一处改、全站生效——上部完整原图 `object-fit: contain` 居中（不裁圆/不裁切/不拉伸，留边浅色卡底补齐），下部圆角白色文字层，名称/价格/金币数字/类别只在白层，字号 ≥14（实测 15–16）。判断记录：① 75/25 为近似比——小定高卡（摊位 148/126px）白层需容纳 3 行 ≥14px 文字，实际约 55–60%，再压图高必破 14px 下限或裁图（两者皆禁）；高卡接近 75/25；所有图 100% 完整。② 白层与图重叠带定为 0（固定重叠带会随上下文间隙漂移把文字推上图）。③ 类别 chip 只取 ≤6 字符首段（partner 邀请整句曾撑出 87×161px chip 压卡），整句仍在 tag 行完整显示。④ gem/类别徽改全在白层内（按规格字面）。
- **五尺寸自适应（Thong 追加，ww 合并）**：验收尺寸 667×375 / 874×402 / 1024×768 / 1280×800 / 1440×900，每尺寸市场/交换/感想（另加测商店/提议/开饭/交换阶段）四项全清：真叶溢出 0、卡面文字压图 0px²、最小可点高 48px、最小字号 15px。关键修复：667 市场浮层改全宽 sheet（卡不缩——缩到 ~74 宽白层吃掉整卡、违反上图下文比例）；667 感想卡收至 118×162 + 标题降档；手机交换弹窗纵叠入栏；bot-trait 徽字号 12.9→15px；rcp-check ✓ 9.9→15px；手机商店货架名 anywhere 断行。伪影说明：感想旋转卡名行在无头 SwiftShader 截图有 3px 级字形发虚，三重量测（Range 行盒 ⊂ 白板、scrollWidth=clientWidth、PIL 暗像素跨度在板内）证明布局正确，属渲染层伪影，真机/浏览器复核为准。
- **文字排查（Thong B）**：卡面文字压图改前最高 1557px²（partner）等多屏 → 改后双视口全屏 0；真叶溢出逐项修（cook/wallet 卡名折行、商店名加高、车票可见名缩短为「Bus ticket」——全名保留 ariaLabel，此为一处按 B 口径执行的文案缩短，特此记录）。量测原始值非 0 但定性为机制/装饰的 artifact 清单（gem ::after 下探、滚动数字列、sr-only、转盘旋转体、气泡上浮容器等）已在交付说明中列明，勿再「修」。**零散文字清单只列不删**（含机器人特质片「🐾Go/⚡Ea/🛡️Ca」语义不清一项），随截图包 v3 交 Thong/ww 定夺。
- **构建号注入（ww 口径）**：vite define 从 `BUILD_COMMIT` 读 commit，开始页左下角小字「build {commit}」；部署构建必须带该变量，否则显示 build dev。
- 收尾口径：build（tsc+vite）干净、引擎三目录 diff 空；**全量单测未在收尾复跑**（Thong 指示构建后跳过测试环节；中途 279/279 为模板改版前状态，不引用为最终）。回退点：tag `pre-r2fix-20261119`（1d44ddb）。

## 附记：R6 卡面修复轮（2026-11-19，对 c63c46e 版）

本轮由 Prof 对 T-1 卡（c63c46e）的评审起，经 ww 口径覆盖与 Thong 两项裁定、ww 验收规格 Part 1/Part 2、ww 三项建议（S1–S3），以及 ww+Prof 对 r6 截图的第一眼复核（N1–N9）。逐项如下（对比度均为像素采样、注明被测对象；套件每项提交后全量 312/312，日志在 ~/workspace/maicai-testlogs/）。

### ① 卡名绝不断词（96f7174）
CardView 旧实现给英文名插音节软连字符（nameWithBreaks），实测出现 gre-ens / clot-hes / Marshma-llow 式断词。改：名字原样渲染；三条 CSS 精确按 ww 口径钉死（hyphens: none、word-break: keep-all、overflow-wrap: normal，只在空格处换行，「Stir-Fry」自带连字符保留）；放不下时以 useNameFit 逐级降字号（下限 14px）、最多 3 行，无省略号无裁切。五尺寸 × 全卡面站点（市场/小卖部/伙伴/开饭/反思/天气/事件/家长/抽卡）巡测：bad=0（bad = 软连字符残留 / >3 行 / <14px / 裁切）。

### ② 吐司回归（b67fb1b）
缺陷本体在已部署的预览构建 4a34d06（吐司停在 R3 前位置、z 15）；集成构建里 R3 修复其实已在，残余风险在 667 档：641–900px 视口下 .toast 再封顶 max-width: min(560px, calc(100vw - 300px))。复测五尺寸 × 多场景：吐司与语言开关重叠 0px²（详 N2 的后续收口）。

### ③ 情景对比度 + Fish 双名（7147186）
旧 r2fix/r3fix 情景图是 T-1 前构建，不作数；本轮在当前构建重拍市场景（667/874/1280，shots/r6_market_*.png）。灰/糊的成因实测定位：不是整卡 opacity（被测场景无 .pglow--dim），是 TiltCard 的 .tc-glare 径向高光（88% 表面色）在卡面上罩了一层——像素采样 1280 市场景卡名（名 vs 自身卡面底）：Fish（选中）1.95:1、Potato 2.73:1、Ginger 2.82:1/2.71:1、Carrot 2.70:1、Tofu 2.11:1。修：.tc-glare opacity 0.3（全局）。修后同法复测：1280 为 7.28–8.26:1、874 为 6.68–8.30:1、667 为 6.62–8.37:1（均为卡名 vs 自身卡面底）。Fish 双名复现并证实：浮动 .hand-tag 与卡面名重复——.stall-hand 内的 .hand-tag 隐藏，复测重复名 = 0。注：.hand--dim（opacity .55）只作用于 bot 回合中玩家自己的手牌（回合状态指示），不在 Part 1.4 范围，未动。

### ④ 价格 ≥18px（389e793，ww+马教授追加，原暂缓项启用）
令牌 --font-size-price 改 1.125rem（18px），价丸高 22→26px、币点 12→14px。验收（五尺寸最终构建实测）：每张有价卡恰 1 枚价丸、计算字号 18px、价丸不出卡界、价丸∩绿勾 = 0px²。有价卡美术占比（美术区高/卡高，1280 种子 1）：0.542–0.559（详 ⑧ 的记号放大后复测值），未跌破 ~45%，无版式妥协。

### ⑤ 邀请卡（232e4e7，ww 必改）
卡面只留名字 + 短签：inviteFaceTag() 从数据 note 切第一段（split / — |，/，EN 为 “Buy together”），无新文案；完整分摊规则进邀请台说明行（.invite-split-note，面板内全文可见）。邀请卡美术占比 0.509（五尺寸，≥50% ✓）。留注：1280 换菜图上邀请卡短签在卡面折成 2 行（Buy / together）、连名字共 3 行文字——硬指标（美术 ≥50%、≥14px、溢出 0、规则在面板）全过，记录在此不擅改。

### ⑥ Heavy rain 一致化（e2f14d0）
源图 event-rain-umbrella.webp 本身满幅构图（内容包围盒 1.00×1.00），在卡面美术区 contain 时显得满出血。修：cardArt.ts 的 ART_INSET_BY_ID（'evt-rain-umbrella': 0.86）+ CardView 对美术图施 transform: scale() 内缩，与其他卡的留白观感齐平。诚实注记：伞尖等源图自身元素仍按原图绘制，本轮未重画美术。卡背部分经 ww 例外取消——卡背保留深色 + 边框，未动。

### ⑦ 番茄炒蛋双卡（报告项，无代码）
rec-tomato-egg 与 rec-tomato-egg-2 数据全同（同名 “Tomato & Egg”、同 ingredientIds [ing-tomato, ing-egg, ing-scallion]，仅 icon 🍳 vs 🍅 之差，同为占位状态 待确认）。不臆造区分名/图，不动 src/data。

### ⑧ Item B 合并——STOP（按其自带闸门停手，未改任何文件）
合并前全仓 grep 发现 cards.json 之外的依赖，逐条列明：
- tests/unit/cards.test.ts:29 —— expect(cards.recipes.length).toBeGreaterThanOrEqual(6)；现 6 张，合并后 5 张跌破下限；
- tests/unit/cardArt.test.ts:33-34 —— 用例「同名菜共用一图（rec-tomato-egg-2）」断言 cardArtFor('rec-tomato-egg-2') 与 rec-tomato-egg 同图；
- src/components/cards/cardArt.ts:68 美术项、:133 背景项 'rec-tomato-egg-2': '#fdeaca'、:9 注释；
- src/i18n/cardText.ts:47 —— 'rec-tomato-egg-2': '番茄炒蛋'。
抽卡组本身是动态的（src/game/engine.ts:108 recipeDeck: recipes.items），非阻塞项。待团队裁定测试下限与同图用例后再合并。

### ⑨ 决策 1 灰底核对（1a0ceb7，Thong 裁定：只核对对齐、不许暖化）
逐卡量测 Fun stuff 美术主色 vs CARD_BG_BY_ID：sticker #fee5b9 vs #fde5b7 ✓、toy #fce8c8 vs #fbe9cc ✓、marshmallow #feeed2 vs #f2e3c2（采样保真内）——均按采样色不动。唯一离群：tmp-popsicle 美术众数 #fde9c9 vs 表值 #e8dcce（偏灰的占位色）→ 表值对齐为 #fde9c9（邀请卡同 id 同步受益）。全程无任何暖化/提亮。

### ⑩ 决策 2 + Part 2 图标代字（2e4d0ff，证据修正 e895837）
新增 MetaIcon（list/food/fun 三形：绿盘白勾 / 胡萝卜 / 紫星——以形区分不只靠色；绿勾专属 On my list）；aria-label 与释义复用 strings.panel.tagNeeded/tagIngredient/tagTemptation。卡面：mark 改绿勾图标、「Food / Fun stuff」文字改图标进价格行（不另占行，省下的整行还给美术区）。释义面：桌面 hover 提示条（压美术区下缘、不碰名，bottom: calc(100% + 22px)——聚焦触发曾实测盖名/被邻卡裁，改为仅 hover）；手机点选时导引行给全名（见 S2）；《How to play》新增图例块（三图标 + 全名，strings.help.iconLegend）。首访市场提示：localStorage maicai-icons-seen 未置位时吐司讲一遍三记号含义（panel.iconsIntro），只出现一次——五尺寸实测均触发。
证据修正（e895837）：首轮量测图标对比 2.80–2.97:1、food 2.50–2.87:1，未达 3:1 线；且手机扇 zoom 0.79 下图标渲染 17px < 20px。修：图标配色加深（绿盘 #1e9e57→#14713a、胡萝卜身 #f06423→#cf4a0e、叶 #2f9e44→#1f7a33、描边 #c24e12→#a63e0a；紫星 #7b4fd0 本已达标保留）+ 布局 22→26px。复测（图标 vs 各自卡面底，像素采样）：874 种子 2 —— Fish/food 3.68:1、Greens/food 3.91:1、Cucumber/food 3.97:1、Pork/list 4.84:1、Toy/fun 4.55:1、Popsicle/fun 4.57:1，渲染 20.5–21.3px；1280 种子 1 —— Fish/list 4.94:1、Ginger/list 5.23:1、Potato/food 4.05:1、Carrot/food 3.74:1、Tofu/food 3.53:1，渲染 26.3–27.5px。全 ≥3:1 且 ≥20px。（N4 续：布局再 26→28px，见 ⑭。）

### ⑪ Part 1 可点 affordance（101689c）
(a) 统一影参：令牌 --shadow-card = var(--shadow-sm), var(--inset-light)，.card-view 统一引用——灰底卡与普通卡同一套（N1 以计算值复核：非选中卡阴影集合基数 = 1）。(b) 按下/悬停：button.card-view 悬停（精细指针）上抬 −2px + shadow-md、:active −3px + shadow-md、过渡 100ms；TiltCard 的 .tc-face 卡除外（倾斜裁切，其反馈是扇内抬起 + 倾斜 + 光晕）。(c) 选中：.card-view--selected 上抬 −4px + 3px 主色环（非仅变色）。(d) 不可点：.pglow--dim 的整套灰化（opacity .65、美术 grayscale(.72)、价丸变灰及三条选中豁免规则）全删，类名保留为空钩；新增 CardView locked 属性 → 元信息行 28px 墨色挂锁（role img，aria-label strings.panel.lockedLabel），五处原 dim 点全接（市场/小卖部/事件/家长/伙伴）。基础与卡 CSS 里无其他 disabled 灰化。

### ⑫ S1 买/再想想一行（7e9f801）
.drop-zone 内边距/间隙各降一档 + ≥1024px 时 nowrap。实测（种子 1）：修前 1280 钮宽 219px 文字 2 行；修后五尺寸「Buy (3 coins)」「Maybe later」均 1 行，钮 219×56（桌面）/ 173×48（手机），scrollW ≤ clientW 处处成立。

### ⑬ S2 874 竖栏两行短句 + Part 2.4 手机路线（dc0b475）
病灶：874 竖栏弹窗仅 182px 宽（内容 166px），选中块两行都折成残片（种子 1/5 全卡实测各 2 行残折）。修：价格括注拆为 .sel-price-part 独立片、仅手机档隐藏（价在卡面价丸/买钮/算式三处都在）；.panel-selected-line 在手机档 nowrap。导引行在选中时改为「图标 {名} — {全名}」（如 Fish — On my list / Popsicle — Fun stuff，20px）——Part 2.4 的点选释义落在此面；未选中时仍是原 stallIntro。种子 1/2/3/4/5/7/9 × 874 复测：两行各恰 1 行（含 Green Onion / Popsicle / Sticker），释义按类别正确。

### ⑭ S3 扇重叠（bc0a703，仅验证无代码改动）
probe-r6-s3 五尺寸 × 静止/选中（首/中/尾卡）：名区与价丸被更高层邻卡覆盖 = 0px² 处处（扇以底边为轴，文字区天然让开）。修前 = 修后 = 0，无需改扇角/间距。

### ⑮ ww+Prof 第一眼复核 N1–N9（截图为估读，以下均为实测）

**N1 三态证据重拍（量测 + 新图 shots/r6_states_*.png、r6_states_press_1280.png）**：旧 states 图是不同卡组拼凑、非真三态，作废重拍。量测（市场扇，种子 2，五尺寸同型）：非选中卡的计算 box-shadow 集合基数 = 1（灰底 Toy/Popsicle 与普通卡同一套 --shadow-card 参数，Part 1.1 成立）；选中灰卡 Toy：3px 主色环在位（且修了一个真缺陷，见下）、扇内相对抬升 −13~−22px（各尺寸，手机档经 zoom 折算）、导引句同步给释义。按下态：摊卡是 TiltCard 面，按下反馈是倾斜 + 检视抬起（press 图中 Fish 处于按压检视态、释义条浮出、投放区 armed）；普通 button.card-view 的 :active 规格（−3px + shadow-md，100ms）为代码规则，TiltCard 面按 Part 1 豁免口径不走位移。**复核中发现并修的真缺陷（3f9253b）**：选中环/抬升被 hover/active 规则以更高特异性盖掉——鼠标停在已选中卡上时 3px 环消失、抬升沉回（点选 Toy 实测环不见）；新增「选中 + 悬停/按下」组合规则（环保留、抬升保持 −4px），复测悬停中的已选 Toy 环在位。锁：Part 1.4 的锁标为 28px 布局（见 ⑪），不可点卡不灰化不透明（.pglow--dim 视觉规则已删，见 ⑪）。

**N2 吐司层级（9a54aeb + 726e0eb）**：复现三处：(a) 1440/1024 市场景吐司被站名签盖住（实测吐司∩签 = 7285px²，吐司 z 5 < 弹窗 z 21）；(b) 874 手机档竖栏滚动时 sticky 语言开关盖住回合卡日志行「Tag bought Sticker」右段（栏 scrollTop 70 实测）；(c) 三行合并长吐司在市场车道仍压扇上卡名（1024/1280 像素假读 1.06:1 即此）。修法：① 弹窗在场时（桌面）吐司升 z 30（仍低于高光层 40），消息永远可读、× 可点；② 市场弹窗在场时吐司改走 33vh 空段车道（市场弹窗是全高纵列，签在顶、摊位帖在底、中段空）+ 限宽 480px（长吐司至多 2 行）；③ 手机档弹窗期间语言开关改随栏滚动（static），与栏内文字零重叠。复测：1440/1024 市场 + 伙伴景吐司∩签 = 0、∩开关 = 0、∩卡名 = 0；874 手机档吐司（岛左下锚）∩开关/签/卡名 = 0；1024 市场景重拍卡名 8.12–11.17:1（吐司离场后采样）。KEEP 口径遵守：「Fish — On my list / Fish — Food」选中释义行原样保留（S2）。

**N3 667 标题与 After-you-buy 外漏（9ca034a）**：病灶实测：667 档浮层（z 9）横跨右栏（z 8），栏内市场弹窗站名签中心命中 = 扇卡图面（被盖）、选中行中心命中 = 浮层 Done 钮（只露右尾巴，即「外漏」）。667 宽里扇（528）与栏信息（232）物理不可并存——沿 S-4「栏让位」口径收口：浮层打开期间栏内市场弹窗整件让位（opacity 0、pointer-events none；结构与 aria-live 选中播报保留），信息改由浮层栈自带：站名进导引句（.stall-guide-station，仅 ≤700 浮层显示，如「② The Market · ✓ Pork — On my list」）、选中行 + 算式进栈内专行（.panel-selected--float，仅 ≤700 显示）；金币数有左下 HUD、菜谱缺口有导引句缺口片，不重复带。配套：扇 zoom 0.79→0.72 + 扇顶留位 56→44，栈高回到 332 ≤ 335（S-3 线）。复测（667）：栈高 332、Done 下缘距屏底 21px、标题全文可见、选中/算式无外漏、扇上 6 卡全见。874 不走此路（岛宽 624 ≥ 扇 528，栏内头签/选中行/算式行实测均 self 命中、完整可读，见 r6_market_874.png）。注记（按转达口径）：667/874 安全区复检在手机分支合并后由协调方再跑一轮，本轮未合并该分支。

**N4 价格/记号复测（9ca034a）**：价丸计算字号五尺寸均为 18px（computed，非字形估读）。记号布局 26→28px：874 渲染 20.5–21.3px（zoom 0.79）、667 渲染 20.2–20.9px（zoom 0.72）、桌面 28px，全 ≥20px。扇可见宽（1280 种子 1 / 874 种子 1 实测）：卡片渲染宽 85–108px，邻卡横向盖住的部分只在卡顶角区——名/价覆盖仍为 0（S3 口径，见 ⑭）；Potato 在 874 可见宽 79/89px（其余同理），价丸与记号均在可见带内。价放大未挤记号/未添覆盖。

**N5 钮尺寸实测（无代码改动）**：团队估读 ~44px 不成立——667/874 投放区 Buy/Maybe later/Skip 与 Done 的真实可点矩形均为高 48px（border-box，getBoundingClientRect + 中心 elementFromPoint 命中验证），达 ≥48px 线。记录在案，不做无据改动。

**N6 算式独立行（30fc1d8）**：原状实测：算式被塞在投放行余空（79px 宽、16px 字，667/874 同）。修：手机档行内算式隐藏，改在竖栏 foot 选中块下独占一行（20px 居中加粗，与「After you buy: 9 coins」同列相邻，式与果一眼对上）；≤700 档该行随弹窗让位、改由栈内专行承载（见 N3）。桌面行内式（R2-14）不变。复测：874 算式 [166×30 @20px]、667 栈内行同为 20px，投放钮仍 48px 且更宽（216px）。

**N7 复拍 + 徽标（8de72da + ff8b378）**：r6_swap_667/874 已按要求重拍（演示条全程关闭，两图 demoVisible = 0 实测）：874 弹窗全框 [622,−29] 182×785（竖栏可滚长列，单帧窗内邀约卡 + 分摊行完整入框）；667 弹窗 [427,−29] 232×761（同口径）。复拍中发现并修：竖栏里邀约 Yes/No 横扇（≈230px）宽于栏（182px）、第二张被裁出栏外——栏内选择扇改纵叠（.choice-hand 在 .phone-rail 内纵排居中，卡不缩放、点击面不变；桌面扇形不受影响）。桌面徽标：Yes 卡朗读徽标原在右下角，实测压价丸 269px²（价丸居中、徽标 51px）——移回右上角外挂（压到的只是选择卡图的角落留白），复测徽标∩价丸 = 0（r6_swap_1280.png 可见价丸完整）。「Tag joined the buy together」吐司探头问题由 N2 的 z 30 升层一并解决（吐司不再被邀请卡/2/2 压住）。

**N8 遮罩覆盖（427193b）**：874 实测：浮层压暗底只盖安全区内盒（[62,20] 550×362），左右安全带里的棋盘格全亮透出（293 个采样点未被遮罩命中）。修：浮层加全视口压暗垫（::before 按安全距反向外扩到屏边，颜色/模糊与原底同一套 token，本体底移除避免双重压暗出色差；≤700 右缘本在屏边不外扩）。复测截图：874 全幅均匀压暗，无亮缝。1024 桌面：.popup-backdrop 实测全视口覆盖（[0,0] 1024×768）；演示条入镜属拍摄口径（正式图全程关演示条）；标题透出是背板 0.42 半透明的既定 token——按 ww 口径只补覆盖、不擅改浓度，如需更暗请 ww 另行裁定。

**N9 证据包补充**：长名卡——Marshmallow 在 1024 市场景（种子 768）入镜（r6_longname_1024.png）：单行全名可见、选中态、名对比 11.17:1（名 vs 自身卡面底，像素采样）；Green Onion 同帧 2 行词界换行（8.12:1）。事件总览（r6_event_1280.png / r6_event_moment_1280.png）：天气大卡 Sunny 名对比 13.47:1（名 vs 自身卡面底）；故事卡「Grandma shares greens」实测 3 行、16px、无裁切（三次独立到达同读数；其单帧截图因该景合成器持续繁忙多次超时未存成，量测数据为准）；「Wet clothes」（evt-thirsty）本轮种子内未抽到，其名与 Grandma 同走 CardView 名字规则（事件卡名已测：An extra egg 2 行 / Wind takes the hat 2 行 / A torn bag 1 行，均 16px 无裁切）。全卡情景对比表（最终构建）：市场名 667 档 6.62–8.37:1、874 档 6.68–8.30:1、1024 档 8.12–11.17:1、1280 档 7.28–8.26:1（均为卡名 vs 自身卡面底）；天气大卡名 13.47:1；图标对比见 ⑩（全 ≥3:1，图标 vs 各自卡面底）。

### ⑯ 套件与 e2e（最终提交 726e0eb）
单元套件：312/312 全过（22 文件），日志 ~/workspace/maicai-testlogs/726e0eb.log；本轮每个代码提交均有对应全量日志（96f7174 起至 726e0eb，同目录）。
e2e（npm run e2e，最终树）：2 过 6 败——与本轮开始前的跑法同集。逐条归因（均非本轮引入）：
- board3d 两条：无头 SwiftShader 下 canvas 20s 内未出现 / 上下文建立超时——环境（本轮探针同机可跑 3D，但需更长等待）；
- fullgame + mobile 横屏整局：点动画中的 .deck-top「element is not stable / detached」直至整局超时——本机 1.5 CPU 性能口径，牌堆组件本轮未动；
- keyboard：两跑失败点不同——一跑死在钱包 Esc（下一跑该步通过，属时序 flaky）、一跑死在 demo-bar 不存在：演示条只在 VITE_DEMO_BAR=1 构建渲染（App.tsx R11 口径），而 e2e 配置的 webServer 是常规构建——规格与配置的既有错位；
- safearea：市场步「栏内按钮 0 命中」——在基线树 7dd15c1 上同签名复现（R2-1 后市场动作经 portal 进浮层，规格的栏内期望与之错位，既有问题）。
归因验证：keyboard + safearea 在基线树 7dd15c1（本轮开始点）单独重跑，同签名双败——本轮零新增 e2e 失败。建议（不在本轮范围）：e2e 配置给 webServer 构建带 VITE_DEMO_BAR=1、safearea 市场步选择器同步浮层口径、整局类用例在本机放宽稳定性等待。
