# UI_BEAUTY.md — R5 UI 美化验收记录

方向：按 `UI_STYLE_REFERENCE.png`（儿童记账 App 截图）走暖奶油底 +
橙主色 + 海军蓝次级 + 大圆角卡片 + 柔和阴影 + 粉彩分类色；只做方向性
美化，不改 UI 流程、布局、文案（见 `DEVIN_R5_BRIEF.md` 与 `ACCEPTANCE_R5.md`）。

## Token 系统（`src/theme/tokens.css`，详见 `UI_TOKENS.md`）

- 色板：橙主色 `#FF6B2C`、黄 `#FFC93C`、蓝 `#5B7CFA`、薄荷 `#7ED9B5`、
  淡紫 `#B9A3F0`、奶油底 `#FFF6EC`、墨 `#1E1E2A`；阴影统一暖棕
  `--color-shadow: #6b3f14`。
- 渐变：`--gradient-primary`（主按钮橙渐变）、`--gradient-card`
  （卡片奶油渐变）、`--gradient-page`（页面底）。
- 圆角 `--radius-card: 16px`；字号正文 ≥20px（`--font-size-md: 1.25rem`），
  按钮/站名 24px；字重 heavy 800 只用于英雄层（按钮/标题/钱数）。
- 动效：`--motion-fast` + `--ease-spring`（按钮按压回弹），过渡只做
  transform / box-shadow / filter，不动布局属性。
- 组件只引用变量，不直接写色值（`AGENTS.md` 换皮约定）。

## 改了什么（实现文件）

- `src/theme/tokens.css`、`src/theme/base.css`：新 token + 底色/焦点/禁用态。
- `src/board.css`：提示条变软托盘（暖分层影 + 顶缘受光，宽高/边框不动）；
  主按钮加按压过渡；bot 卡加 pastel 底与 thinking 态过渡。
- `src/hud.css`、`src/screens.css`、`src/App.css`、`src/phone.css`：底栏/
  钱包夹/弹窗/手机竖栏按同一 token 走奶油卡片 + 柔和描边。
- `src/components/BotCard.tsx`、`src/screens/Game.tsx`：仅加样式钩子
  （`data-bot`、`me-avatar-icon` span），无逻辑、无文案改动。
- 守卫验证：`src/game/`、cards.json（5 菜谱）、英文文案零改动；
  `npm run build` 干净（Board3D gzip 282.81 kB ≤ ~300 kB）；
  `npm test` 85/85 通过。

## 实测（`shots/measure-ui.mjs`，tag `r5g1`，2026-11-17 03:2x CST）

| 指标 | 桌面 1280×800 | 手机 874×402 |
| --- | --- | --- |
| 提示条 `.board3d-overlay` | y 611、高 76px（R4 锁定值） | 121×48（竖栏内，布局不变） |
| 底部栈（800 − 条顶） | 189px（R4 锁定值） | — |
| 岛屿遮挡（`analyze-ui.py` 口径） | **0.0%**（岛 506×304） | **0.0%**（岛 276×180） |
| 主按钮 | 421×56px，同排不折行 | 216×48px（竖栏内） |
| 画布遮挡 | 31.1%（面板合计，R4 为 30.6%） | 41.1%（与 R4 持平） |

### G1 回归与修复（PM，2026-11-17 03:0x）

- 中间态 `r5m` 曾出现违规：状态行 heavy 字重撑宽，状态 + 主按钮塞不进
  46rem 一排而折行，条高 76 → 114px、底部栈 189 → 227px，岛屿遮挡 4.0%。
- 修复（只改 `src/board.css` 的 ≥901px 媒体查询）：条宽 46rem → 52rem
  （仍在左右 bot 卡之间、仍贴底不碰拟合带），容器 `flex-wrap: nowrap`，
  状态行 `min-width: 0 + nowrap + 省略号` 兜底；条高结构上恒为单行。
- 复测 `r5g1`：条高回 76px、底部栈回 189px、岛屿遮挡回 0.0%，状态文案
  `Your turn: at "Recipe Stop"` 完整显示无省略（最长站名
  `Home for Dinner` 同样放得下，见 52rem 余量）。

## 前后对比（`shots/`）

- `ui_*_before.png`：R4 终态基线；`ui_*_after.png`：本轮终态
  （已用 `r5g1` 复测截图覆盖刷新，与修复后构建一致）。
- 中间态 `ui_*_r5m.png`：G1 违规证据（折行条），留档备查；
  `ui_*_r5g1.png`：修复后复测截图；`ui_rects_all.json`：各 tag 面板 rect。
- 桌面棋盘：暖奶油底、bot 卡 pastel 头像底、橙渐变主按钮、柔和暖影；
  市场弹窗：卡片奶油渐变 + 选中淡橙底 + 数字徽标；
  手机：262px 竖栏、pastel bot 芯片、橙渐变主按钮（状态行在竖栏内
  自然折两行，属手机布局本身，非 G1 问题）。

## 独立复验（PM-local，2026-11-17 04:40 CST，提交 877484b 原样复测）

Devin CLI 会话因执行环境 teardown 反复中断，PM 在本分支上独立复测（未重开 Devin）：

- `npm run build` 干净（Board3D gzip **282.81 kB** ≤ ~300 kB）；`npm test` **85/85**。
- 复测 `shots/measure-ui.mjs`：tag `r5v`（手机有效）+ `r5v3`（桌面单独跑）。
  - 手机棋盘：canvas cover **41.1%**（= R4 41.1%）、岛 274×180、遮挡 **0.0%**、主按钮 216×48；rail 262px、chips/竖栏 rect 与 `r5g1` 逐像素一致 → **G5、G6 通过**。
  - 桌面棋盘（`r5v3`，3D）：岛 506×304、遮挡 **0.0%**；像素实测条 y611–687（≈76px）、HUD y703–784（81px）、底部栈 189px；主按钮 421×56 取自 `r5g1` rect（同一构建）→ **G1 通过**；Reset pill 在条外、水面上 → **G2 通过**。
  - HUD 81px、chips 用 `--button-height` 56 / `--tap-min-size` 48（`hud.css` 改动只加了 36px 头像圆片，未顶高底栏）→ **G3 通过**；圈次文字在卡内换行（桌面/市场截图均见 `Sprout→Steady→Zip →Tag` 卡内换行，`S/prout` 断字为 R3 已接受机制）→ **G4 通过**；条高单行恒定（log 行内联+省略，见 `board.css`）→ **G7 通过**。
- 守卫：`src/game/`、`src/data/` diff 为 0 行；英文文案零改动（改动的 TSX 只有 `Game.tsx`/`BotCard.tsx` 的样式钩子）；组件 CSS 无裸 hex 色值/裸字号（grep 为空），token 只在 `tokens.css`；T0 修复在位（`phone.css:329` `.phone-rail .popup { animation: none }` 含原注释）→ **G8、I4、A13 通过**。
- 截图逐张看过：桌面/手机棋盘、市场、转盘前后对比——布局与 R4 基线逐像素一致，只换了材质（奶油底、pastel bot 底、橙渐变主按钮、柔和暖影）；市场弹窗由半透明变实色奶油卡（背后状态 chip 被盖住是正常遮挡，非文案丢失）；无中文残留 → **H1 通过**；手机横屏布局不变 → **H2/H3 不变**。
- **2D 回退说明（非回归）**：并行跑 3 个 SwiftShader 实例时，`BoardMount` 的 ~4s 首帧看门狗触发，桌面首捕回退到 Board2D（`r5v` 桌面那组截图即此状态，已删除，rects 中对应条目已剔除）；单独重跑 `r5v3` 后 3D 正常。属 VM 并发下的看门狗行为，与 UI 改动无关。
- **H4 备注（既有措辞问题，非 R5 引入）**：清单写「市场第一行整宽 Buy、第二行 Maybe later/Skip」，实际 R4 已接受布局是第一行 Buy + Maybe later 并排、第二行 Skip（前后截图一致，见放大的按钮区）。R5 未动此布局；措辞与渲染的出入请 PM 裁定是否改清单。
- **H5/H6（开饭/感想页）**：`screens.css` diff 中无任何布局属性（display/position/宽高/flex/grid/overflow 均为零），只换背景/阴影/过渡色；两屏布局不受影响，留待合并构建整局实玩时复核。
- 交互验收（整局实玩：按压反馈、动画 ≤1.5s 可跳过、走子跟镜、按钮 ≥48px 与安全区、儿童回合回正取景）按原计划在合并构建上做，不在本分支重复做。

## 已知缺口

- 市场截图顶部 `Tag bought Sticker` toast 是实机流程产生的真实提示，
  非截图伪影；弹窗本身已完全静止不透明。
- 本分支只含 UI 美化（旧场景相机）：岛屿填充率等场景指标在合并后的
  `devin/r5-art` 上复测，以 `ART_R5.md` 为准。
- 交互验收（整局实玩：按压反馈、动画 ≤1.5s 可跳过、走子跟镜、按钮
  ≥48px 与安全区、儿童回合回正取景、无面板挡操作）按 R5 总体验收
  在合并构建上做，不在本分支重复做。
