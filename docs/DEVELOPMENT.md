# 开发文档（DEVELOPMENT.md）

## 1. 技术栈与理由
- **Vite + React 18 + TypeScript（strict）**：纯静态构建，`dist/` 可直接拷走用任何静态服务器或双击打开（`base: './'`）。
- **样式：普通 CSS + CSS 变量**（不用 Tailwind / UI 组件库），方便 ww 后续按 Figma token 换皮。
- **状态管理**：`useReducer` + 纯函数游戏引擎，不引第三方状态库。
- **测试**：Vitest（游戏逻辑单测）+ Playwright（chromium，端到端冒烟：自动玩完一整局）。
- **随机数**：可注入种子的 PRNG（如 mulberry32），保证测试可复现；URL 参数 `?seed=123` 可固定种子。
- 无后端、无网络请求、无登录、无真实 AI。

## 2. 目录结构
```
maicai-game/
  AGENTS.md
  docs/  REQUIREMENTS.md  DEVELOPMENT.md  PLAN.md  figma/（Figma 参考截图与原始代码）
  index.html
  src/
    main.tsx  App.tsx
    config/gameConfig.ts      # 所有可调数字（待试玩）+ 规则开关
    data/cards.json           # 所有卡牌内容（待确认）
    data/cards.ts             # 读取 + 类型校验 cards.json
    game/                     # 纯 TS 游戏引擎，禁止 import React
      types.ts                # GameState、Player、Card、Action 等类型
      engine.ts               # reducer：(state, action) => state
      stations/*.ts           # 每个站点的规则逻辑
      bots.ts                 # 电脑玩家决策（按性格）
      rng.ts                  # 种子随机
      selectors.ts            # 派生数据（缺哪些菜、能不能买等）
    theme/tokens.css          # 唯一定义视觉 token 的地方
    theme/base.css            # 全局基础样式（只用变量）
    components/               # 可复用展示组件：Button、Coin、Card、Basket、Plate、PlayerPanel、HelpButton…
    screens/                  # 屏幕：Intro、CharacterSelect、DrawRecipe、Station*、BasketReview、Feast、Reflection
    demo/DemoBar.tsx          # 演示控制条
  tests/ unit/*.test.ts  e2e/fullgame.spec.ts
```

## 3. 架构约定（为了以后好换皮）
- **逻辑与界面分离**：`src/game/` 只导出纯函数和类型；界面通过 `dispatch(action)` 驱动，读取 `state` + `selectors` 渲染。任何规则判断（能不能买、补车费、花钱事件上限、AI 家长站给几币）都写在引擎里，不写在组件里。
- **展示组件无业务**：`components/` 只接收 props，不直接读全局 state。
- **视觉 token 集中**：`src/theme/tokens.css` 里定义 `--color-primary`、`--color-bg`、`--color-surface`、`--color-text`、`--color-muted`、`--color-line`、`--color-warning`（待付夹黄色）、`--font-family`、`--font-size-*`、`--radius-*`、`--space-*`、`--shadow-*`、`--button-min-height` 等。组件 CSS 里禁止出现裸色值/裸字号。
- **默认 token 用灰阶**（Thong 选色前不上彩色）；以下 Figma 493:2 的色值只作为注释里的备选。
- **布局**：横屏/竖屏用同一套组件，靠 `src/theme/layout.css` 的媒体查询切换；不写两套逻辑。
- **输入**：通用 `useFocusTrap`、`useHotkeys` hooks 放在 `src/ui/`；所有可交互元素用原生 `<button>`，保证键盘可达。
- **初始 token 取自 Figma 节点 493:2**：主绿 `#46a171`，浅绿面板 `#f1f7f0`，正文 `#1c1c1c`，次要文字 `#6b6b6b`，分隔线 `#dee0db`/`#d6d9d4`，深灰 `#3d3d3d`，字体 `"Noto Sans SC", "PingFang SC", system-ui, sans-serif`，卡片圆角 18px。待付夹用黄色（Figma 文字：“黄色「待付夹」”）。
- **图像**：demo 阶段用 emoji 或简单 SVG/色块代表菜和物品，集中在 `cards.json` 的 `icon` 字段，方便以后替换成插画。
- 所有界面文案（按钮、提示）集中放在 `src/data/strings.ts`（中文），卡牌文字放 `cards.json`。

## 4. 命令
| 命令 | 作用 |
|---|---|
| `npm install` | 安装依赖 |
| `npm run dev` | 开发服务器（默认 5173） |
| `npm run build` | `tsc -b && vite build`，输出 `dist/` |
| `npm run preview` | 预览 dist（如 `--port 4173 --host`） |
| `npm run test` | `vitest run` |
| `npm run e2e` | `playwright test`（先 build，再起 preview 服务器） |

Playwright 浏览器：优先使用系统已装的 chromium；如需安装，运行 `npx playwright install chromium`。

## 5. 代码规范
- TypeScript strict，不用 `any`；标识符英文，界面文字中文。
- 函数式、不可变更新；引擎 reducer 为纯函数（随机数由 state 中的 rng 种子推进）。
- 文件尽量 < 300 行；一个站点一个文件。
- 重要交互元素加 `data-testid`，供 e2e 使用（如 `btn-next`、`btn-buy-<cardId>`、`btn-help`、`station-<n>`）。
- 电脑玩家的回合要有简短可见的动作提示（如“小明买了鸡蛋”），自动推进（约 0.6–1 秒，可在演示条/`?fast=1` 下加速为 0）。

## 6. 测试要求
- **单元测试**（`tests/unit`）至少覆盖：起始币数；公交站扣费与待付夹（钱不够→夹待付，之后得钱先补车费）；每人花钱事件最多 2 次；AI 家长站一局一次且 1/2 币分档；小卖部每样 +1 币；伙伴站禁止转钱；3 圈后进入开饭；结局三种盘子（完整/简化/剪影）；任何情况下没有玩家出局；用固定种子模拟 4 个 bot 跑完整局不报错。
- **e2e 额外**：`tests/e2e/keyboard.spec.ts`（纯键盘推进至少一圈）、`tests/e2e/mobile.spec.ts`（390×844 竖屏视口玩完整局、无横向滚动）。
- **e2e**（`tests/e2e/fullgame.spec.ts`）：用 `?seed=1&fast=1` 打开，真人每一步都选一个可用操作，点完 3 圈 × 8 站，到达开饭页面并看到 4 个盘子，再到“最满意的决定”页面结束；断言页面里没有“排名/第一名/分数”等字样。
- 每个里程碑结束：`npm run build && npm run test` 通过后 commit。

## 7. 第三方代码与素材
- 借用 MIT 等许可的代码时，在根目录 `THIRD_PARTY_NOTICES.md` 写明：项目名、URL、版权行、完整许可文本、借用了哪些文件/片段。CC0 素材（如 Kenney）也在其中登记来源（虽不强制署名）。
- 无许可证或闭源项目（discover-china、Island Tycoon、Closing Quest 美术等）不得拷贝代码、模型、贴图、音效。
- 每个阶段交付前对照 `docs/ADAPTATION.md` 的 14 条自查。

## 8. M4 开发说明
- 模型：Thong 批准 M4 使用 DeepSeek V4.1 Flash（`deepseek-v4-1-flash-1017-high`），淘宝账号devin（acct1）。
- 先修 REQUIREMENTS 第 13 节第 3 项（竖屏事件站），再做其余。
- 竖屏检查一律用 390×844 视口；修完必须重拍 `screenshots/m4_*_{desktop,mobile}.png` 并亲自查看。
- 修流水重复（第 13 节第 2 项）时，先写能复现的单元测试再修；`tests/unit/simulate.test.ts` 的 2400 局「流水合计＝钱包」检查必须继续通过，并加“同一笔交易不重复记账”的断言。
- 不得改动：`src/config/gameConfig.ts` 里的数值、`bots.ts` 换菜阈值、`cards.json` 的菜谱/价格、`tokens.css` 色板。

## 9. M4.5 3D 开发说明

### 9.1 目录与挂载
- 3D 全部放 `src/board/three/`：`Board3D.tsx`（Canvas + 布局壳，签名同 `BoardViewProps & { children? }`，中央仍渲染 DOM overlay）、`Scene.tsx`、`Island.tsx`/`StreetLoop.tsx`/`StationTile.tsx`/`StationProps.tsx`、`Piece.tsx`、`WeatherSpinner3D.tsx`、`CameraRig.tsx`、`QualityProvider.tsx`、`positions.ts`（环形路径纯函数，可单测）、`materials.ts`（统一调色板材质）、`gltf.ts`（useGLTF + colormap 换色工具）、`webgl.ts`（检测 + 首帧看门狗）。
- 挂载：`Game.tsx` 棋盘位改为 `BoardMount`——`React.lazy(() => import('./three/Board3D'))` + `Suspense`（fallback 先渲染 Board2D）+ `ErrorBoundary` + `?board=2d|3d|auto` 选择；3D 抛错/超时自动回退 `Board2D`。
- `BoardViewProps` 追加可选字段（向后兼容，Board2D 忽略）：`weather?: { id: CardId | null; nonce: number }`（nonce 用 `turn.orderIndex`，区分同天气连转）；棋子站位/高亮沿用现有 `stationIndex`/`activePlayerId`。
- 3D 画布 `aria-hidden="true"`；另加 `.board-status` 文本行（可 `sr-only`）报当前站/轮到谁。

### 9.2 依赖（2026-11-13 已核对发布时间，均 ≥7 天）
| 包 | 版本 | 发布 | 说明 |
|---|---|---|---|
| `three` | `^0.187.0` | 2026-10-30 | |
| `@types/three` | `^0.187.0` | 2026-10-30 | devDependencies |
| `@react-three/fiber` | `^8.18.0` | 2025-02-19 | peer: react >=18 <19 ✅ |
| `@react-three/drei` | `^9.122.0` | 2025-02-19 | peer: react ^18、fiber ^8、three >=0.137 ✅ |
| `@gltf-transform/cli` | `^4.5.1` | 2026-09-28 | devDependencies（压缩用，也可 npx 不装） |

- **选择：留 React 18 + R3F 8 / drei 9，不升 React 19 + R3F 9 / drei 10（最小风险）。** 理由：升 React 大版本要同步换 `@types/react(-dom)` 大版本、重验 M3/M4 全部 UI 与三个 e2e，demo 前夜风险高、收益为零——R3F 8/drei 9 已覆盖所需全部能力（Canvas、useFrame、OrbitControls、useGLTF、ContactShadows、PerformanceMonitor）。monopoly-3d 用的 React 19 + R3F 9 只借代码思路，不跟版本；若日后升级，改动面仅限 `three/` 目录与 `BoardMount`。
- **不引 gsap/zustand**：走站动画在 `useFrame` 里手写插值（借 monopoly-3d `Piece.tsx` 逐站小跳的思路与时长参数）；状态沿用现有 `useReducer` + props，不加状态库。
- 注意 drei 9 部分组件会拉进 `three-stdlib` 等传递依赖，属于正常分包内容，纳入 300KB 预算一起算。

### 9.3 素材管线
- GLB 放 `public/models/`：只拷用到的文件（清单见 PLAN §4.2），引用写 `./models/<file>.glb`（随 `base:'./'`）。来源 `/workspace/maicai-3d-assets/packs/*/Models/GLB format/`。
- 压缩：文件本身已小（角色 ~250KB/个、食材多数 <100KB），需要时用 `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp`。**预算：3D 分包 gzip ≤ ~300KB（对照 Island Tycoon 177KB），`public/models/` 总量 ≤ ~3MB。** `npm run build` 后看一眼 `dist/` 里 chunk 与 models 体积。
- 棋子换色：Kenney 全包共用一张 `colormap.png` 风格贴图——优先给角色 mesh 的材质 `color` 乘算玩家色（橙/蓝/黄/薄荷），不行再改贴图；统一在 `gltf.ts` 里做，不散落各组件。
- CC0 素材与借用代码都要登记 `THIRD_PARTY_NOTICES.md`（见 §7）； Closing Quest 的 `public/assets/art/` 插画与一切未授权美术不得使用。

### 9.4 性能与降级
- `dpr`：高档 `[1, 1.75]`（桌面），低档 `1`（手机/低端默认低档）；阴影：高档 `ContactShadows` 或一盏带 PCF 的方向光，低档关实时阴影改贴片影/纯 Lambert。
- `frameloop="demand"`：静止不渲染；动画/相机变化时 `invalidate()`（借 Closing Quest `wake()`/`idleFrames` 的思路）。
- 掉帧自动降档：drei `PerformanceMonitor` 或简易计时器，持续低 fps → 切低档；仍慢 → 回退 2D。
- 首帧看门狗：Canvas `onCreated` ~3s 未触发 → 判 WebGL 不可用，回退 2D；`webglcontextlost` 事件 → 回退 2D。
- `prefers-reduced-motion`：跳过走站弧跳与转盘旋转，直接停到结果。

### 9.5 无头环境与 e2e
- 本机/CI 无 GPU，Playwright 里 Chrome 156 的软件 WebGL 需要 launch arg `--enable-unsafe-swiftshader`（Chrome ≥128 起必须；旧写法 `--use-gl=swiftshader` 留作回退注释）。在 `playwright.config.ts` 的 `launchOptions.args` 追加即可，对 2D 用例无害；`scripts/shot-m4_5.mjs` 同样带上。
- `tests/e2e/board3d.spec.ts`：`?board=3d&seed=1&fast=1` 打开 → 断言 `<canvas>` 存在、`pageerror` 为空、收集 console 无 `WebGL`/`THREE` 报错 → DOM 按钮照常点几站 → 截图 buffer 字节数 > 阈值（纯色空白 PNG 很小）判非空白。另跑一遍 `?board=2d` 断言无 `<canvas>`。
- 规则正确性仍由既有单测保证；3D 只做存在性/不报错/非空白冒烟，不做像素级断言。

### 9.6 交付
- 每个 M4.5.x 子步骤：`npm run build && npm run test` 绿 → commit；最后一步再跑 `npm run e2e`。
- 截图：`scripts/shot-m4_5.mjs`（仿 shot-m4.mjs）产出 `screenshots/m4_5_*_{desktop,mobile}.png`，亲自查看是否「精美」（ART_3D §8 清单）。
- 交付物：`npm run build` 后打 `/workspace/maicai-game-dist.zip`，内附 README（解压后 `python3 -m http.server` 或双击启动脚本即可玩）；不部署公网。

### 9.7 M4.5.7「画质：织梦岛风」开发说明

> 技术路线（马教授定，不得另选引擎或库）。来源：`/workspace/maicai-logs/m45_7_dev.md`，
> 画面目标以 `/workspace/maicai-design/ART_3D.md` 第 9 节 10 项为验收基准。

- 引擎：继续用现有 three.js + React Three Fiber（含 drei），不换 Unity/Godot/Babylon/PlayCanvas。
- 塑料光泽：模型材质换成带清漆层的 MeshPhysicalMaterial（clearcoat），加一张 Poly Haven 的 CC0 HDRI 环境贴图（小尺寸，放进仓库，THIRD_PARTY_NOTICES 登记）提供反光。
- 亮绿和整体色调：默认用 three.js 自带 NeutralToneMapping（保持亮绿和暖橙饱和，不用 ACES 压灰）+ 统一调色；对比截图时 ACES 与 Neutral 各截一张供 ww 挑选（只改 3D 场景，2D 界面和 tokens.css 不动）。
- 移轴虚化和泛光：pmndrs postprocessing（MIT，可用 @react-three/postprocessing）的 TiltShift 与 Bloom；登记许可证。
- 斜阳长阴影：一盏低角度方向光 + 柔和阴影（PCF soft / drei SoftShadows 之类），棋子脚下补接触阴影（drei ContactShadows 或现有贴片影）。
- 花草灌木：InstancedMesh 实例化，几百棵也不卡。
- 不加任何描边。
- 手机横屏（874x402）关闭移轴虚化和泛光，其余保留，保证流畅（目标 ≥30fps）；WebGL 失败仍回退 2D。
- 3D 分包 gzip ≤300KB（HDRI 等资源不计入 JS 包但要控制大小）。
- 验收：ww 把关画面（截图与参考图并排像同一个世界），马教授把关技术与流畅度。
- 补充（ww，ART_3D.md 第 10 节）：脚底接触阴影用 N8AO（登记许可证）；加载模型时统一替换为带反光的材质；手机掉帧时自动降一档画质，保证 ≥30fps。第 10 节与本文件一致，冲突时以马教授的技术路线为准。
- 验收方式：电脑 1280x800 与 iPhone 17 Pro 横屏 874x402 各一张固定机位截图，与参考图并排，按第 9 节 10 项逐条对照。

实现约定（M4.5.7 实装）：

- 画质三档：`high`（桌面，全效果含后期链）/ `medium`（手机·触屏默认：关移轴+泛光+N8AO、影图 1024、dpr≤2）/ `low`（掉帧自动降：关实时阴影改贴片影、dpr=1、密度再减）。`?fx=0` 强制关后期链；`?tonemap=neutral|aces` 供对照截图。
- 后期链只做 6 个效果：N8AO → Bloom → TiltShift → ToneMapping(NEUTRAL) → HueSaturation → BrightnessContrast，全部经 `src/board/three/Effects.tsx`（React.lazy 子分包，仅 high 档加载）；**不引入任何描边手段**（无 OutlinePass/EdgesGeometry/反向外壳）。
- 环境贴图：`public/env/spruit_sunrise_512.hdr`（Poly Haven CC0，ffmpeg 由 1k 缩到 512×256），仅作 PBR 反光，不作背景。
