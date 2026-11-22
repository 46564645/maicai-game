# THIRD_PARTY_NOTICES.md —— 第三方代码与素材声明

本项目按 `docs/DEVELOPMENT.md` §7 登记所有借用的第三方代码与素材。
**绝不拷贝**无许可证或闭源项目（discover-china、Island Tycoon、AdriaIsland、
Eco Mountain Party、HeapPlay、Craft 等）的代码、模型、贴图、音效——它们只作形式参考。

## 一、借用的 MIT 代码（保留版权与许可声明）

### 1. Closing Quest（経理の1年間）
- 项目：https://github.com/kiwamizamurai/closing-quest
- 许可：MIT License，Copyright (c) 2026 kiwamizamurai
- 借用内容（移植/改写思路与片段，非整文件拷贝）：
  - `src/render/renderer.ts` 的 high/low 画质档做法（低档关阴影、DPR=1）→ `src/board/three/QualityProvider.tsx`、`src/board/three/Scene.tsx` 的 `QualityBridge`
  - 按需渲染（`wake()` 思路）→ `<Canvas frameloop="demand">` + `invalidate()` 驱动
  - `cameraRig.ts` 的相机焦点模式（overview/roulette/pawn 切换思路）→ `src/board/three/CameraRig.tsx` 的 `focus: 'auto' | 'spinner'`
  - `roulette.ts` 的「结果先定只演出」转盘写法（目标角 = 整圈 + 前向差值、指数缓停曲线
    `k=(1-e^{-t/τ})/(1-e^{-dur/τ})`、canvas 画分区盘面、销钉拨动固定指针的弹簧抖动）
    → `src/board/three/spinMath.ts`、`src/board/three/WeatherSpinner3D.tsx`
    （分区改为 3 个天气图标、图标为独立网格做落定弹跳、销钉拨动简化为过点脉冲）
- **未使用**其 `public/assets/art/` 插画（归属不完全清楚，一律不用）。

### 2. monopoly-3d（3D 地产大亨）
- 项目：https://github.com/haskaomni/monopoly-3d
- 许可：MIT License，Copyright (c) 2026 haskaomni
- 借用内容（改写思路与小段代码）：
  - `src/components/CameraRig.tsx` 的 drei `OrbitControls` + 每帧 `target.lerp` 轻跟随当前玩家（限制俯角与远近）→ `src/board/three/CameraRig.tsx`
  - `src/components/positions.ts` 的格子坐标锚点 + 同格多棋子 2×2 错位（`tileAnchor` 思路）→ `src/board/three/positions.ts`
  - `Piece.tsx` 逐站小跳动画思路（M4.5.2 棋子走站动画借用，未用 gsap——按项目约定手写 `useFrame` 插值）

两份许可证原文（同一 MIT 文本）：

```
MIT License

Copyright (c) 2026 kiwamizamurai (Closing Quest)
Copyright (c) 2026 haskaomni (monopoly-3d)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 二、CC0 素材登记（署名非必须，在此记录来源）

素材清单见 `/workspace/maicai-3d-assets/ASSETS.md`（各包 License.txt 已核对为 CC0）。
**M4.5.2 已拷入 GLB 到 `public/models/`**（共 30 个文件，约 2.4MB；M4.5.3 已把各包 `Textures/colormap.png` 内嵌进对应 GLB）。
**2026-11-22「方块拼道具替换」再补入 10 个 GLB**（共 40 个文件）：Car Kit / City Kit Suburban / Nature Kit / Fantasy Town Kit / Furniture Kit，替换公交站面包车、做饭站房子与圆桌、小卖部店屋、菜市场棚子、岛缘树与栅栏；新增文件同样按 M4.5.3 做法把 colormap 内嵌进 GLB（Nature/Furniture 两包本无贴图）。
**M4.5.5 再补入各包源贴图 `colormap.png` 到 `public/models/textures/{mini-characters,mini-shop,food-kit}/colormap.png`**（Kenney CC0，与 GLB 内嵌为同一张分色图集；build 后随 dist 一并发出，可在 `./models/textures/<包>/colormap.png` 加载）：

| 包 | 来源 | 许可 | 已拷文件与用途 |
|---|---|---|---|
| Kenney Mini Characters 2.0 | https://kenney.nl/assets/mini-characters | CC0 | `character-female-a/-c`、`character-male-a/-b`：4 个棋子（身体换玩家色，脸保留） |
| Kenney Mini Shop 2.1 | https://kenney.nl/assets/mini-shop | CC0 | `display-fruit/-bread/-small`、`shopping-basket`、`cash-register(-self)`、`gacha-machine`、`shelf-boxes`：菜市场货架与收银、扭蛋机、小卖部货架 |
| Kenney Food Kit 2.0 | https://kenney.nl/assets/food-kit | CC0 | `tomato/egg/leek/cabbage/broccoli/carrot/mushroom/meat-raw/fish/cheese/popsicle/ice-cream/bag`：摊位食材与诱惑品；`pot/pan/bowl/plate-dinner/cup`：回家做饭的饭桌 |
| Kenney City Kit (Suburban) 2.0 | https://kenney.nl/assets/city-kit-suburban | CC0 | `building-type-d`：做饭站小房子（自带烟囱）；`building-type-a`：小卖部店屋（2026-11-22 拷入，原程序化盒子房退役） |
| Kenney Car Kit 3.1 | https://kenney.nl/assets/car-kit | CC0 | `van`：公交站面包车（2026-11-22 拷入，colormap 已内嵌进 GLB；原方块拼面包车退役） |
| Kenney Nature Kit 2.1 | https://kenney.nl/assets/nature-kit | CC0 | `tree-oak`、`tree-pine`、`tree-default`、`tree-detailed`：岛缘四角树与伙伴站小树；`fence-simple`：伙伴站/家门口栅栏段（2026-11-22 拷入；该包 GLB 无贴图、纯材质色） |
| Kenney Fantasy Town Kit 2.0 | https://kenney.nl/assets/fantasy-town-kit | CC0 | `stall-red`：菜市场红棚摊位 ×2（2026-11-22 拷入，colormap 已内嵌进 GLB） |
| Kenney Furniture Kit 2.0 | https://kenney.nl/assets/furniture-kit | CC0 | `table-round`：做饭站门口圆桌（2026-11-22 拷入；无贴图、纯材质色） |
| Kenney Mini Forest | https://kenney.nl/assets/mini-forest | CC0 | 树/石头点缀（未拷入；树的角色已由 Nature Kit 顶替，石头保留程序化） |
| KayKit Board Game Bits | https://kaylousberg.itch.io/board-game-bits | CC0 1.0 | 硬币等（如拷入） |

感谢 Kenney（www.kenney.nl）与 Kay Lousberg 的无偿 CC0 素材。

## 三、M4.5.4 打磨说明

本步新增（`CoinFly.tsx`、`ambient.ts`、贴片影纹理、彩纸/涟漪/烟尘/棚飘动效、面板与抽卡 DOM 动效）均为自写代码与程序化素材，未新增任何第三方代码或素材，无新登记项。

## 四之二、M4.5.7「画质：织梦岛风」新增登记（2026-11-16 核对安装包原文）

### 5. postprocessing（pmndrs）— Zlib
- 项目：https://github.com/pmndrs/postprocessing ；本项目用版本 6.39.6（经 `@react-three/postprocessing` 的 EffectComposer 使用 TiltShift / Bloom / ToneMapping / HueSaturation 等效果）。
- 许可：Zlib License，Copyright © 2015 Raoul van Rüschen。原文（取自安装包 `LICENSE.md`）：

```
Copyright © 2015 Raoul van Rüschen

This software is provided 'as-is', without any express or implied warranty. In
no event will the authors be held liable for any damages arising from the use of
this software.

Permission is granted to anyone to use this software for any purpose, including
commercial applications, and to alter it and redistribute it freely, subject to
the following restrictions:

1. The origin of this software must not be misrepresented; you must not claim
   that you wrote the original software. If you use this software in a product,
   an acknowledgment in the product documentation would be appreciated but is
   not required.

2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.

3. This notice may not be removed or altered from any source distribution.
```

### 6. @react-three/postprocessing — MIT
- 项目：https://github.com/pmndrs/react-postprocessing ；本项目用版本 2.19.1。
- 许可：MIT License，Copyright (c) 2020 react-spring。许可全文与本文件
  第一节所载 MIT 文本相同（版权行以上述为准）。

### 7. n8ao — CC0 1.0（README 与 LICENSE 文件；package.json 元数据标注 ISC）
- 项目：https://github.com/N8python/n8ao ；本项目用版本 1.10.3（桌面后期链的接触阴影）。
- 许可核对：安装包 `LICENSE` 文件为 CC0 1.0 Universal 全文，README「License」
  节亦写明 "A CC0 license is used for this project"；其 `package.json` 的
  `license` 字段标注为 ISC。三者均为宽松许可，在此一并记录以备查。

### 8. Spruit Sunrise HDRI — CC0
- 素材：Poly Haven「Spruit Sunrise」环境贴图，https://polyhaven.com （Poly Haven 全部素材以 CC0 发布）。
- 本项目文件：`public/env/spruit_sunrise_512.hdr`（由 1k 原图以 ffmpeg 缩至 512×256），
  仅作 PBR 环境反光（PMREM），不作背景图。

## 四、M4.5.6 自绘素材登记（版权归本项目，非第三方）

- `src/components/CardIcon.tsx` 内的 **豆腐 SVG**（`svg:tofu`）：自绘暖色玩具风插画——
  奶白豆腐块带厚度、撒葱花、放在小木碟上；替换原占位白方块 `◻️`
  （马教授反馈：孩子认不出）。`cards.json` 中豆腐的 `icon` 字段记为 `"svg:tofu"`。
- `src/components/RotatePhone.tsx` 内的 **旋转手机 SVG**：自绘线稿——小手机 +
  虚线转弯弧 + 箭头，用于竖屏「把手机横过来」提示。

两者均为本仓库手写 SVG，未使用任何外部图片/图标库，无新第三方登记项。

## React Bits（R10 卡片交互，2026-11-17）

以下组件改编自 **React Bits by David Haz**（https://github.com/DavidHDev/react-bits），
许可证 **MIT + Commons Clause**（可用于本项目；不得将组件本身作为商品出售）：

- BounceCards → `src/components/cards/Hand.tsx`（手牌扇：弹入/展开/悬停回正，改造为 ReactNode 卡面）
- TiltedCard → `src/components/cards/TiltCard.tsx`（倾斜 + glare + 翻面引擎，裁剪版）
- BorderGlow → `src/components/cards/PlayableGlow.tsx`（可打出扫光，配色改为项目令牌）
- Magnet → `src/components/cards/useDragPlay.ts` 中的近目标吸附（弹簧参数借用其实现）
- Counter → `src/components/cards/CoinCounter.tsx`（逐位滚动数字，裁剪为整数 0–99）
- ClickSpark → `src/components/cards/PlaySpark.tsx`（打出/买入迸溅短线；canvas 版改为零 rAF 的 DOM+CSS 实现，保留全局并发上限思路）

## WS5 动效目录（2026-11 补记）

以下组件同归 **React Bits by David Haz**（https://github.com/DavidHDev/react-bits），
许可证 **MIT + Commons Clause**；原组件依赖 gsap/ScrollTrigger，本项目一律用
`motion`（motion.dev）重写——实现代码为本仓库改写，借的是组件设计与变体语义：

- Animated Content → `src/components/motion/AnimatedContent.tsx`
  （入场揭示包装器：slide/scale/blur/pop/pop-x/rise/quest/moment 变体；
  gsap 版改写为 motion 弹簧）
- Fade Content → `src/components/motion/FadeContent.tsx`
  （淡入+淡出包装器：fade/fade-down/blur/sink/pocket 变体；gsap 版改写为
  motion tween，内包 AnimatePresence 管退场后再卸载）
- Flip Card → `src/components/motion/FlipCard.tsx`
  （front/back 双面 rotateY 翻卡；motion 弹簧翻面）
- Star Border → `src/components/motion/StarBorder.tsx`
  （沿边框巡游的星点光轨；叠加层改写，只作选中卡的强调光效）

### 9. motion（motion.dev）— MIT
- 项目：https://github.com/motiondivision/motion ；本项目用版本 14.14.0
  （`motion/react` 入口，树摇后仅按需打包）。
- 许可：MIT License，Copyright (c) 2024 Motion B.V.——许可文本与本文件
  第一节所载 MIT 文本相同（版权行以上述为准）。


## WS3「文字与徽章」（2026-11-21）

以下条目同归 **React Bits by David Haz**（https://github.com/DavidHDev/react-bits），
许可证 **MIT + Commons Clause**，与上文 R10 各条同一出处、同一许可证。
本步新增（随各 commit 逐条登记）：

- Count Up → `src/components/bits/CountUp.tsx`（C4 `.coins-count` 币数读数；
  C7 `.bot-lap-gain` / `.order-chip-gain` 圈得币角标、C20 流水分组小计
  同用）。裁剪版：只留 count 式（数字插值滚动；逐位滚动仍归 C1
  CoinCounter），保留 easeOut/linear/expo/spring 缓动与格式化；动画由
  `motion` 的 `animate()` 驱动（原组件即 motion 实现）；reduced-motion
  直接落终值。
- Animated Content → `src/components/bits/AnimatedContent.tsx`（C5
  `.coin-delta-chip` 金币增减小片的升起+淡出，三处宿主：金币条、桌面钱包
  钮、手机钱包钮）。设计改写：原组件基于 gsap/ScrollTrigger，本项目未
  引入 gsap，用 `motion` 重写同形设计（抬升淡入 → 可选驻留 → 抬升淡出，
  单条 keyframes 时间轴）；reduced-motion 渲染静态终态。
- Swipe Toast → `src/components/cards/PendingChip.tsx` 引信倒计时（C12）。
  设计借用：借「燃烧引线 + 燃头火星」的倒计时视觉，组件结构与
  usePending/pendingCommit 时序为本仓库既有；燃烧进度由 `motion`
  `animate()` 在组件内驱动，原组件交互实现未搬入。
- Warm Tooltip → `src/components/bits/WarmTooltip.tsx` +
  `src/components/cards/MetaIcon.tsx`（C11 记号释义条）。暖组设计改写：
  第一枚提示先等 350ms，任一出现后 2.5s 暖窗内兄弟即答，同刻只出一条；
  点按切换、悬停臂出；原组件 gsap 实现未采用，弹出由 `motion` 驱动。
  提示条样式沿用本仓原 ::after 版式（.meta-tip 元素态）。
  【退役登记，消息减负审计 B20，2026-11-22】WarmTooltip.tsx 已删除、
  MetaIcon 不再挂提示泡；本条保留作借用沿革，代码已不在仓内。
- Animated List（滑动选中）→ `src/components/bits/GlideRing.tsx` +
  `src/screens/Game.tsx` `.order-strip`（C8）。借「指示环弹簧滑到
  选中项」机制：选中片语义仍是 .order-chip--next，环为叠加指示，
  由 `motion` 弹簧驱动；行弹入式 AnimatedList 裁剪版另见 C20。
- Stepper → `src/screens/Game.tsx` 进度簇（C9：`.stop-pips`/`.lap-dots`/
  `.prog`）。借「可读步进轨」版式：珠间连轨线 + 当前步指示环
  （复用 GlideRing）；原组件的 hugeicons 对勾未引入——本仓珠为
  双色态色块，无图标需求；指示环由 `motion` 驱动。
- Split Text → `src/components/text/SplitText.tsx`（C15：`.game-title`、
  `.popup-title`）。原组件基于 gsap/SplitText + ScrollTrigger，本项目未
  引入 gsap，用 `motion` 重写同形设计（按词分组、逐字升起淡入错峰）；
  key=text 换文案重播；reduced-motion 静态直出。
- Blur Text → `src/components/text/BlurText.tsx`（C15：`.intro-title` 六处
  屏幕级标题）。原组件即 motion 实现，按本项目裁剪重写：逐字
  「失焦→聚焦」+ 微上浮错峰；reduced-motion 静态直出。
- Shiny Text → `src/components/bits/ShinyTextOnce.tsx`（C17 `.weather-result`
  结果词）。原版式 = 背景裁剪高光带循环扫过；本项目扫光由 `motion`
  驱动（不新增 CSS 动画），基色取元素计算色保对比，默认单次扫过；
  reduced-motion 无扫光。
- Animated List → `src/components/bits/AnimatedList.tsx`（C20：Feast
  「看看钱花到哪了」流水明细行弹入）。裁剪版：保留行项错峰弹簧入场
  （pop/slide/fade 三式）与可选滑动选中环（复用 GlideRing）；不搬原
  组件的滚动视口/渐变遮罩/键盘导航/点选（本仓流水为静态只读短表）；
  hugeicons 未引入（无图标需求）；动画由 `motion` 驱动。

## R10 Slice E「去框舞台」（2026-11-18；E9 登记订正）

以下两条同归 **React Bits by David Haz**（https://github.com/DavidHDev/react-bits），
许可证 **MIT + Commons Clause**（可用于本项目；不得将组件本身作为商品出售），
与上文 R10 卡片交互各条同一出处、同一许可证：

- ProfileCard → `src/components/cards/ProfileCard.tsx`（玩家角色高光卡）：
  借用范围 = 组件概念与高光卡形态（角色信息集中成一张可弹出的高光卡）。
  实现方式 = 本仓库重写：卡体结构与文案推导自写，倾转 / 箔光（foil）/
  glare 引擎复用上文已登记的 TiltedCard（`TiltCard.tsx`），未搬入原组件代码。
- ReflectiveCard → 同上 `ProfileCard.tsx` 的版式：借用范围 = 竖版 ID 卡
  版式骨架（头行小徽 + 状态点 / 中段头像砖 + 大名 + 头衔 / 底行属性栏 +
  右下方块钮）。实现方式 = 本仓库按本项目 token（奶油/橙/藏青）重写版式，
  未搬入原组件代码。

两条共同的「未引入项」（有意不移植，儿童课堂产品 + 低端平板帧率预算）：
- @hugeicons 图标库未引入——原组件用到的图标一律以本仓手写内联 SVG 替代
  （如 ProfileCard 的篮筐接触钮 BasketGlyph）；
- 未移植 ReflectiveCard 的 WebGL2 反射着色器管线；
- 无任何摄像头 / 视频采集路径（原组件的反射视频源不接）。

本步其余新增均为自写代码，未新引第三方代码或素材：

- `src/ui/coinDots.ts` / `src/ui/weatherMoment.ts` / `src/ui/spotlight.ts`：
  金币点、天气时刻相位机、名片内容推导，全部手写纯函数。
- `src/board/three/Scene.tsx` 的 `WeatherDresser` / `RainVeil`：灯光渐变与
  InstancedMesh 雨丝阵为手写（instanced 写法同 `Flora.tsx` 惯例）。

## WS1「按钮与交互控件」（2026，React Bits 移植批次）

以下条目同归 **React Bits by David Haz**（https://github.com/DavidHDev/react-bits），
许可证 **MIT + Commons Clause**（可用于本项目；不得将组件本身作为商品出售），
与上文 R10 卡片交互各条同一出处、同一许可证：

- Glare Hover → `src/components/bits/PressButton.tsx` + `src/components/bits/bits.css`
  的 `.bits-sheen`（按钮扫光带）：设计移植——光带由 React wrapper 裁为
  单枚 aria-hidden 层，悬停/按下用 WAAPI 推过按钮面；reduced-motion 不播。
- Magnet → `src/components/bits/PressButton.tsx` 的 `PRESS_SPRING`
  （按压 whileTap 弹簧参数 stiffness 170 / damping 16 / mass 1，
  与 `src/components/cards/useDragPlay.ts` 已登记条目同口径借用）。
- Pill Nav → `src/components/bits/PillNav.tsx` +
  `src/components/bits/GlidePill.tsx` + bits.css `.pill-nav-*`：只取
  「轨道 + 跟随指针/焦点的滑动指示丸」一段（原组件整站导航/gsap 折叠
  均未搬）；滑动动画由 gsap 改写为 motion 弹簧。
- Bubble Menu → `src/components/bits/BubbleMenu.tsx` + bits.css
  `.bubble-*`：保留「主泡 + 弹出动作菜单」设计；展开动效由 gsap
  改写为 motion 弹簧（PlaySpark 口径：设计移植、动效重写）。
- Specular Button → `src/components/bits/SpecularPill.tsx` + bits.css
  `.specular-pill*`：WebGL2 边缘镜面流光裁剪移植，全场唯一实例
  （.board-enter）；外壳换用项目 .btn chrome；WebGL2 缺失退回普通
  按钮，reduced-motion 只画静态帧。
- Shiny Text → `src/components/bits/ShinyText.tsx` + bits.css
  `.shiny-text`：只保留周期性高光扫文核心；reduced-motion 不启动。
- Glide Select → `src/components/bits/GlideTrack.tsx` +
  `src/components/bits/GlidePill.tsx` + bits.css `.glide-*`：选中锚点
  滑动指示丸设计移植；动效由 gsap/自绘弹簧改写为 motion，
  hugeicons 一律改内联 SVG/emoji 文本（未引入该依赖）。
- Jelly Radio → `src/components/bits/jellyPick.ts`：选中果冻挤压 +
  相邻项轻让的设计移植；原 motion 弹簧改写为 WAAPI 单发脉冲
  （scale/translate 独立属性，不碰 transform），reduced-motion 不触发。


## WS4「通知·覆盖层·导航」（React Bits 动效化，2026）

（motion 依赖已在上文「WS5 动效目录」节第 9 条统一登记，本节不重复。）

### 10. React Bits 动效改写/收编（WS4，MIT + Commons Clause）
以下组件改编自 **React Bits by David Haz**
（https://github.com/DavidHDev/react-bits），许可证 **MIT + Commons Clause**
（可用于本项目；不得将组件本身作为商品出售）。原组件多数基于 gsap，
本项目不采用 gsap——凡注明「gsap 设计改写」者均以 `motion/react` 重新实现
同一设计意图（慢、轻、儿童向，且 `prefers-reduced-motion` 直接给终态）：

- AnimatedContent / FadeContent：共享原语，集成时已去重——存续实现为
  WS5 版（FadeContent 另并入 WS4 的 role / onClick / blur 透传），
  登记见上文「WS5 动效目录」节。
- Swipe Toast → `src/components/SwipeToast.tsx`（D1+A11 提示条包装层：
  升起入场 + 燃烧引线倒计时 + 垂直滑甩关断；裁剪为车道内包装层，
  @hugeicons 图标一律不用，关闭 × 沿用既有文字样式）。
- Status Mark → `src/components/StatusMark.tsx`（D10 bot 回合指示：
  常驻淡环 → 进度弧缓转 → 对勾描画三态；原组件基于 motion，
  本版同库裁剪为 idle/running/done 三态，1.4s/圈慢速不闪）。
- Text Type → `src/components/TextType.tsx`（D11 提议气泡逐字现身 +
  点按即补全；gsap 设计改写为 rAF 节流逐字显隐，字符原位占位不抖
  行高；短句专用，总时长封顶 ~2.4s）。
- Blur Text → `src/components/BlurText.tsx`（D14 天气大卡标题逐词
  柔焦 resolve；原组件基于 motion，本版同库裁剪为按词一次到位）。
- Rotating Text → `src/components/RotatingText.tsx`（D4 键盘提示键名
  与说明短语轮换 ≥3s/条；原组件基于 motion，本版同库裁剪为整短语
  上滑交叠单模式）。
- Pill Nav → `src/components/PillNav.tsx`（E3 游戏顶栏胶囊条：裁剪为
  纯承载结构——logo/移动抽屉/路由链接全部去掉，只留奶油胶囊 +
  描边光圈；槽内按钮本体不动）。
- Rubber Segment → `src/components/RubberSegment.tsx`（E7 语言切换钮：
  选中底为橡皮筋胶囊拇指，切换按弹簧形变游走、可拖拽吸附；原组件
  基于 motion，本版同库裁剪为水平两段受控模式，垂直/非受控模式
  未搬入）。


## WS2「卡片与面板 React Bits 翻新」（2026-11-19，分支 rb/ws2-cards）

以下条目同归 **React Bits by David Haz**（https://github.com/DavidHDev/react-bits），
许可证 **MIT + Commons Clause**（可用于本项目；不得将组件本身作为商品出售），
与上文 R10 各条同一出处、同一许可证。移植文件集中在
`src/components/reactbits/`，全部不引入 `motion`/`gsap`/`ogl` 新依赖——
原组件的动效一律以本仓自包含实现替代（CSS transition / transform 弹簧 /
rAF 插值），且不含 @keyframes（归 WS5 所有；E1 Gradient Text 为例外——
其唯一定义的 `rb-gtext-drift` 位于组件自带的 GradientText.css，见下条）：

- Glare Hover → `src/components/reactbits/GlareHover.tsx`（B4）：
  裁剪移植扫光引擎——保留 sheen 光型与对角线几何量测/余弦缓动核心，
  裁掉 follow/loop 模式与 streak/twin 光型；改为贴进 CardView 内部的
  光层（原版是外包 div），触发从 hover-only 改为 pointerdown（触屏）+
  pointerenter（鼠标）+ focus-visible（键盘）三路径。
  应用于 `src/components/CardView.tsx` 的可点卡面。
- Spotlight Card → `src/components/reactbits/SpotlightCard.tsx`（B8/B22）：
  裁剪移植光斑引擎——保留柔边 falloff 光斑、位置指数平滑跟随、
  presence 渐显与按压 flare 的核心 tick；裁掉 beam 形、grain 噪点、
  edge 描边光、ambient 漂移与双主题板；触发从 hover/proximity 改为
  pointerdown 点亮（触屏口径 press-not-hover）+ focus-visible。
  拆两形态：`SpotlightLayer` 贴进既有卡（`BotCard.tsx`），
  `SpotlightCard`/`SpotlightLayer` 贴进 `src/screens/Intro.tsx` 数字卡。
- Animated List → `src/components/reactbits/AnimatedList.tsx`
  （B7/B19/B23/B25）：裁剪移植——保留 pop 入场姿态
  （translate3d+scale 隐藏位）、错峰 stagger 与同款 SPRING linear()
  缓动、可选滑行高亮环（原 selection indicator，量测换项即滑）；
  裁掉键盘/悬停选中、滚动渐隐遮罩、hugeicons、默认数据、滚动视口
  与双主题。游戏无删除/列表选中语义，相应能力不移植。
  应用于 `MiniCardRow.tsx`（B7 小卡排）、`WalletDrawer.tsx`（B19
  钱包行）、`screens/BasketReview.tsx`（B23 双方篮子行）、
  `screens/Reflection.tsx`（B25 逐人感想卡 + 最新卡高亮环）。
- Stepper → `src/components/reactbits/Stepper.tsx`（B13/B20 共用）：
  裁剪移植——保留水平步轨（圆点步标 + 连接条 + 滑行指示块）与
  换页/页脚导航语义；裁掉垂直轨、dots/bars 指示器、framer-motion
  （换页与滑行改用本文件自包含 rAF+transition 实现）、frame 外壳与
  双主题板；✓/箭头图标为手写内联 SVG（不引 hugeicons）。
  `StepTrack`（纯步轨）用于 `CookPanel.tsx` 食材进度轨；
  `Stepper`（步轨+分页+页脚）用于 `HelpCard.tsx` 分页帮助。
- Stack → `src/components/reactbits/Stack.tsx`（B5）：裁剪移植——
  保留顶卡拖拽跟手、位移阈值甩穿牌堆（飞出后自摞底弹回顶位）、
  拖动中底卡前移一档的「下一张顶上」预演；原版用 motion 弹簧
  （motion@^12），此处以 transform 直写 + CSS transition 弹簧
  自包含实现，不引 motion 依赖；裁掉多卡循环数据模型与卡片
  随机旋转（本堆底卡为装饰牌背，牌背全同则穿摞循环视觉等价）。
  点按抽牌始终是主路径（tap-rescue 口径与 useDragPlay 同）。
  应用于 `src/components/cards/Deck.tsx` 抽牌堆。
- Pixel Card → `src/components/reactbits/PixelCard.tsx`（B11）：
  裁剪移植——保留 canvas 像素格在卡面上随机点亮的核心思路；
  触发从悬停改为按压（pointerdown/键盘，平板无 hover），节奏压
  到慢明灭（~350ms 淡入/淡出、~14 格错峰 ≤380ms，远低于闪烁
  敏感阈值），一簇播完即停无常驻 rAF；裁掉三档 variant 预设。
  应用于 `src/components/StorePanel.tsx` 小卖部「全部食材」格卡。
- Tear Ticket → `src/components/reactbits/TearTicket.tsx`（B12）：
  自包含改写——原组件按住票根拖撕（drag-to-tear），本游戏改为
  「点一下撕票根」（tap-to-tear，1–3 年级精细拖拽不合适）；
  打孔撕缝线/检票口缺口/票根飞旋渐隐均以本仓手写 CSS transition
  实现，无 motion。撕裂态由外部受控（BusPanel 选中=撕）。
  应用于 `src/components/BusPanel.tsx` 公交车票。
- Text Type → `src/components/reactbits/TextType.tsx`（B16）：
  自包含改写——原版 GSAP/SplitType 逐字打字机；此处以 setInterval
  定速逐字（~40 字/秒）+ 小竖线光标实现同一阅读节奏，补
  tap-to-complete（点一下看全句，打字中为 button 语义、全句走
  aria-label）；无 gsap/SplitType 依赖。
  应用于 `src/components/ParentPanel.tsx` 家长（AI）回复气泡。
- Jelly Radio → `src/components/reactbits/JellyRadio.tsx`（B21）：
  自包含改写——原版 radio 组果冻选中；此处为「按下/聚焦」拾取
  反馈层：选中项弹簧胀大、紧邻项向外让位，uncontrolled 纯展示
  （不进命令流），display:contents 容器不掺和网格布局。
  应用于 `src/screens/CharacterSelect.tsx` 角色选择卡。
- Gradient Text → `src/components/reactbits/GradientText.tsx` +
  `GradientText.css`（E1，owner-approved conversion（Thong,
  2026-11-21)）：机制改写——上游现行版是 rAF 引擎逐帧直写
  --gt-gradient；本仓按其早期 CSS 形态重新实现：scale 倍宽的
  linear-gradient 经 background-clip:text 贴进文字，唯一动效为
  本文件新 keyframe `rb-gtext-drift` 的 background-position
  慢速往返（yoyo），零 JS、无 motion/gsap/ogl。裁掉 flow/conic
  变体、指针跟随、悬停暂停、glow、showBorder 与 IntersectionObserver；
  停靠色全部改用本项目暖橙 token（最深 ≥5:1，最亮 ≥3:1），
  reduced-motion 下动画归零停成静止渐变。
  应用于 `src/screens/Intro.tsx` 开场标题（仅此一处）。


## React Bits —— WS6 背景与壳（2026-11-21）

以下同归 **React Bits by David Haz**（https://github.com/DavidHDev/react-bits），
许可证 **MIT + Commons Clause**（可用于本项目；不得将组件本身作为商品出售），
与上文 R10 各条同一出处、同一许可证：

- Gradual Blur → `src/components/StationPopup.tsx` 内 `GradualBlur`（逐层
  mask + backdrop-filter 的渐进边缘模糊）：**vendored 裁剪版**——保留
  分层模糊叠层与渐层遮罩核心，去掉滚动/悬停联动。G3 用在弹窗遮罩四缘、
  G5 用在手机竖栏上下端缘（同一组件，Game.tsx 引用）。
- Noise → G1 应用背景静态颗粒（`src/App.css` `.app-shell::before`）：
  **设计适配**——取其「印刷颗粒铺满页面」的形式，落地为单帧冻结的
  feTurbulence SVG 瓦片（无动画/无 rAF/无位移；动态颗粒=闪光，项目禁用），
  无 JS 组件。
- Silk → **未落地（原型门槛未过）**：G6 intro-shell 背景绸在 SwiftShader
  （CPU WebGL）实测全屏片元着色中位帧间隔 ≈2183ms、p95 ≈2400ms
  （内部 960×600，DPR 0.75），距 ≤34ms 门槛 ~64 倍；内部降分至可用极限
  仍无法达标且折纹不存。按门槛规则放弃转换——`.intro-shell` 保留原样，
  Silk 代码不入库（原型记录：shots/ws6/gate.mjs 与最终汇报）。
