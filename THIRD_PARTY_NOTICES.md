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
**M4.5.5 再补入各包源贴图 `colormap.png` 到 `public/models/textures/{mini-characters,mini-shop,food-kit}/colormap.png`**（Kenney CC0，与 GLB 内嵌为同一张分色图集；build 后随 dist 一并发出，可在 `./models/textures/<包>/colormap.png` 加载）：

| 包 | 来源 | 许可 | 已拷文件与用途 |
|---|---|---|---|
| Kenney Mini Characters 2.0 | https://kenney.nl/assets/mini-characters | CC0 | `character-female-a/-c`、`character-male-a/-b`：4 个棋子（身体换玩家色，脸保留） |
| Kenney Mini Shop 2.1 | https://kenney.nl/assets/mini-shop | CC0 | `display-fruit/-bread/-small`、`shopping-basket`、`cash-register(-self)`、`gacha-machine`、`shelf-boxes`：菜市场货架与收银、扭蛋机、小卖部货架 |
| Kenney Food Kit 2.0 | https://kenney.nl/assets/food-kit | CC0 | `tomato/egg/leek/cabbage/broccoli/carrot/mushroom/meat-raw/fish/cheese/popsicle/ice-cream/bag`：摊位食材与诱惑品；`pot/pan/bowl/plate-dinner/cup`：回家做饭的饭桌 |
| Kenney City Kit (Suburban) | https://kenney.nl/assets/city-kit-suburban | CC0 | 「家」站点小房子（未拷入，本步用程序化几何体） |
| Kenney Car Kit | https://kenney.nl/assets/car-kit | CC0 | 公交站小车（未拷入，用方块拼的同风格面包车） |
| Kenney Mini Forest | https://kenney.nl/assets/mini-forest | CC0 | 树/石头点缀（未拷入，用程序化棒棒糖树/圆锥树） |
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
