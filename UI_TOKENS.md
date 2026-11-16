# UI_TOKENS.md — R5 UI 美化 token 系统（Part 2）

目标：让 2D 界面和 3D 玩具小岛像「同一种软塑料」——暖奶油底、一颗橙色英雄按钮、
墨蓝正文、胖圆字、软乎乎的卡片。全部实现为 `src/theme/tokens.css` 里的 CSS 变量；
组件只引用变量，不写裸值（换皮只改 tokens.css）。

风格锚点：`UI_STYLE_REFERENCE.png`（儿童理财 app）——warm cream 底、橙色渐变主按钮、
深墨蓝次级动作与文字、大圆角卡 + 软扩散阴影、按类别的马卡龙淡色编码、硬币/吉祥物
圆滚滚的触感、chunky 圆体。

## 1. 色彩角色（5 + 1，沿用已验收 ww 色板值，不改色板）

| token | 值 | 角色 |
|---|---|---|
| `--color-primary` | `#FF6B2C` 暖橙 | **Hero**：一屏唯一主动作；渐变/唇边由它派生，不得另起橙 |
| `--color-ink` (= `--color-text`) | `#1E1E2A` 墨蓝 | 全部文字、次动作色（toast、数字键徽标）、焦点描边 |
| `--color-accent-yellow` | `#FFC93C` 太阳黄 | 硬币、待付夹/提醒（钱相关） |
| `--color-blue` / `--color-mint` / `--color-purple` | `#5B7CFA` / `#7ED9B5` / `#B9A3F0` | 淡彩编码：小稳=蓝、小跟=薄荷、淡紫=AI 家长/强调；小冲=黄（共用太阳黄） |
| `--color-bg` / `--color-surface` | `#FFF6EC` 奶油 / `#FFF` 纸白 | 页面底 vs 卡片纸面 |

派生（全部 color-mix 自色板，随换皮自动跟随）：
- `--color-primary-hi/-lo`：主色亮端/暗端 → `--gradient-primary` 主按钮渐变 + 唇边
- `--color-primary-soft`：12% 橙 + 纸白 → 选中卡/按住态的淡橙底
- `--color-primary-ghost`：橙 34% 透明 → 主按钮柔光辉
- `--color-line-soft`：比 `--color-line` 再柔的暖发丝线
- `--color-backdrop`：暖棕遮罩（旧墨蓝遮罩调暖）
- 玩家淡彩底 `--tint-steady/-impulsive/-follower/-you`：玩家色 22% + 纸白

## 2. 字（chunky、圆、数字秒读）

- `--font-family`：圆体优先栈 `ui-rounded → SF Pro Rounded → Nunito/Baloo 2 →
  Arial Rounded MT Bold → 现有 Noto Sans SC/PingFang → system-ui`。
  仓库不内嵌字体文件（外链字体=网络请求，违规）；设备上有圆体时自动启用，
  否则回退现有非衬线。正式授权圆体（OFL 字体文件）待 PM 采购后只需改本变量。
- 字级沿用：`--font-size-xs/sm/md/lg/xl/xxl` = 14/16/20/24/32/48（正文 ≥20px 不动）。
- 字重：`--font-weight-regular 400 / --font-weight-bold 700 / --font-weight-heavy 800`。
  800 用于英雄层：按钮文字、面板标题、状态行、统计数字。
- 数字（钱！）：`--num-tabular: "tnum"` 语义的 `font-variant-numeric: tabular-nums`
  应用在所有币数/金额文本（`.coins-count`、`.phone-fab-num`、`.phone-bot-coins`、
  `.ledger`、`.panel-selected`、`.stat-card-value`）。

## 3. 圆角（ww 线框锁定值，不变）

`--radius-card` 16 / `--radius-modal` 28 / `--radius-button` 999(pill)。

## 4. 深度规则（软、暖、每屏只豪横一处）

- 阴影统一暖棕调（`--color-shadow` #6b3f14 派生），不用灰黑：
  - `--shadow-sm` 卡/芯片、`--shadow-md` 浮条/抽屉、`--shadow-lg` 弹窗级、
    `--shadow-pop` 大弹窗最深的弥散
  - `--inset-light`：`inset 0 1px 0` 纸面顶光，面板/横条/底栏的「塑料受光面」
- 按钮=实体键：主按钮 `渐变 + 3px 唇边(--shadow-btn) + 橙色柔光`；
  次按钮 `纸白 + 暖发丝边 + 2px 浅唇(--shadow-btn-quiet)`；
  按下 `translateY(--press-shift)` 唇边压平（`--shadow-btn-press`）。
- 大胆只花在主动作渐变+柔光；其余面板安静（软阴影 + 发丝暖边，不叠效果、
  无玻璃拟态、无霓虹）。

## 5. 动效（<300ms、可跳、尊重减动效）

- 按压/悬停：`--motion-fast` 150ms + `--ease-spring`（轻回弹），:active 下沉
  `--press-shift`、hover 轻抬 1px（仅 hover-capable 设备）。
- 面板/状态变化：`--motion-med` 300ms 上限（沿用 popup-rise / coin-bump /
  card-flip / weather-spin，不新增长动画）。
- `prefers-reduced-motion` 全局既有规约不变：一切 transition/animation ≈0。

## 6. 旧 token 兼容

`--shadow-sm/md/lg` 等旧名全部保留（改值不改名）；`--radius-sm/-md/-lg/-pill`、
`--button-min-height` 等别名照旧；R1–R4 布局尺寸 token（`--button-height`、
`--tap-min-size`、`--rail-w`、弹窗/转盘尺寸）一字不动——本轮只换「材质」，
不动布局。
