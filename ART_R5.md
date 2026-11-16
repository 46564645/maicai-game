# ART_R5.md — R5 画质验收记录（场景线，devin/r5-art）

> 范围：场景（art）线。UI 美化在另一分支 `devin/r5-ui`，不在本文档内。
> 验收口径：`ACCEPTANCE_R5.md` A–F 组；R5 任务书 `DEVIN_R5_BRIEF.md` Part 1；
> 讨论与 PM 裁决：`DISCUSSION_R5.md`（round-1 共识 + PM 直接裁决 2026-11-17 01:35）。
> 测量环境：Muse VM（无 GPU，SwiftShader 软件渲染）。截图/取景证据有效；
> 帧率与 e2e 计时证据在 VM 上不具代表性（rAF 约 3–7 fps 为软件渲染假象），
> 干净的完整 e2e 与 ≥30 fps 证明需真机（与此前各轮一致）。

## 0. 结论先行

| 验收项 | 结果 |
|---|---|
| A1 海铺满全屏（两视口） | ✅ 通过（像素 + 目视） |
| A2 小岛占 60–70% | ⚠️ 按裁决口径（FIT_BOUNDS 求解器）通过：桌面 0.662 / 手机 0.665；可见陆地 flood-fill 复核：桌面 0.584（略低于 0.60 下限）、手机 0.699 |
| A3 整岛入画（8 站不裁切） | ✅ 通过（两视口截图目视） |
| A4 桌面面板对小岛遮挡 0.0% | ✅ 通过（measure-ui 口径 + rim bbox 复核均为 0.0%） |
| A5 海面玩具小船（默认视图 ≥1 艘） | ✅ 通过（桌面 3 艘 + 2 浮标、手机 3 艘 + 2 浮标可见） |
| A6 曝光不回退 | ✅ 通过（桌面 near-white 3.66% / blown 0.15%；手机 1.42% / 1.40%） |
| A7 `npm test` 85/85 | ✅ 通过 |
| A8 `npm run build` 干净 | ✅ 通过 |
| A9 Board3D gzip ≤ ~300 kB | ✅ 通过（282,343 B） |
| A10–A13 受保护路径零改动 | ✅ 通过（cards.json / src/game/ / 14 规则 / 英文文案 diff 均为空） |

**唯一待决项：A2 桌面可见陆地复核 0.584。** 见 §5 的说明与建议。
其余 A–F 自查见 §6。

## 1. 本轮改动（按目标）

### A1 海铺满全屏
- `Island.tsx`：渐变圆盘 r 14.5 → 16；底下垫一块 420×420 深水平面（y=-0.74，
  比圆盘低 0.02 防 z-fight），颜色 = 渐变外缘色 `SCENE.waterDeep`，roughness 0.62 /
  envMapIntensity 0.3（T2 已接受值不变），水面噪声 bump（`textures.ts` 程序化贴图，
  repeat 14×14，bumpScale 0.1）。深水平面延到雾程外，接缝不可见。
- `Scene.tsx`：雾 60–120 → **90–180**（DISCUSSION_R5 round-1 预案的触发条件已满足：
  FIT_RECT 收紧后机位拉远到 ≈43，画角处水面距相机 70–90，已进 60–120 雾程，
  帧角水面被雾洗成底色、渐变盘边缘露出。改 90–180 后画角水面几乎无雾、
  深水平面铺满全屏；岛体距相机 ≈40 不受影响；绝不低于 60（T5 教训）。
  注意：这与 F5 的字面值“雾 60–120”不同，见 §6 F5 条——机制（求解距离不在雾程内）
  保持不变，岛体仍在雾程外。）
- 相机 `far: 140` 不变（求解器离线相机 far 400，仅用于投影计算）。

### A2 小岛占自由带 60–70%（取景）
- `CameraRig.tsx`：
  - 桌面 FIT_RECT `{l:0.1, r:0.1, t:0.1, b:0.24}` →
    `{l:0.145, r:0.145, t:0.145, b:0.285}`（PM 修正：初版按 b 0.24 求解后实测
    rim 填充 0.87 超上限，故收紧；仍由求解器二分求距，无经验倍率，F5 机制不变）。
  - 手机（compact）FIT_RECT `{l:0.03, r:0.03, t:0.14, b:0.14}` →
    `{l:0.03, r:0.3, t:0.14, b:0.16}`：实测画布是 874 全宽（`.board3d` 的
    `right:rail-w` 被 `width:100%` 顶掉），右竖栏只是 DOM 浮层——r 0.03 → 0.30
    把 262px 栏位建进取景，岛不再往栏下长；b 0.14 → 0.16 对齐左下/右下圆钮区。
  - 新增 `FIT_SHIFT`（取景基线偏移）：桌面 z+1.5（注视点向镜头前挪，岛在带内
    纵向摆正）、手机 x+3.2 / z+0.4（注视点右移，岛像在 0–612 自由区里居中）。
    偏移同时作用于默认目标、全部跟随目标与回正目标。
  - `FOLLOW_MIX` 桌面 0.45 → **0.12**、手机 0.72 → **0.05**（PM 裁决，
    见 DISCUSSION_R5：保留轻跟随手感，跟随只动注视点、位置不动；
    冻结规则不变——首次手势后相机位置冻结）。
- 求解器预测（`shots/solver-actual.mjs`，与运行时同一常量）：
  桌面 d=42.9，rim 740×419 = 310k；手机 d=36.7，rim 453×254 = 115k。
- 运行时实测验证（临时探针，已移除）：桌面 `fitD=42.879`、aspect 1.6、
  compact false；相机位置 (0, 32.56, 29.81) = 求解 homePos；fov 27。
  即求解器与运行时完全一致。

### A5 海上玩具小船
- `Island.tsx`：程序化几何玩具小船 ×3 + 浮标 ×2（无外部素材，配色只用
  蓝/紫/奶油白——避免绿/暖色被岛屿像素分割误算进岛体）：
  船 (-13.5,-8.5)、(15.5,-4)、(-15,3.5)；浮标 (13.5,-9.5)、(-12.5,9.5)。
  船体为压扁圆球 + 三角帆 + 小旗；起伏走 `useAmbient(110–130)`
  （约 15fps 合并 invalidate，合乎 `frameloop="demand"`），不投阴影，
  位置在侧向中段、站点视线外、模糊带外、面板下之外。
- 默认视图两视口均 ≥2 艘可见（见 §2）。

### 画质细节（程序化贴图，`src/board/three/textures.ts` 新增，169 行）
- 草地斑驳：单幅覆盖整座岛顶（map 给斑驳色、bump 给细微起伏，bumpScale 0.06），
  材质改白底；路面砂砾：`StreetLoop.tsx` 手绘砂砾贴图单幅覆盖（挤出 UV=形状坐标
  ±7），不再是平涂；水面噪声 bump；泡沫噪声 alphaMap——泡沫环断成一串泡泡团，
  不再是完美几何环。全部固定种子 mulberry32，可复现。
- `Scene.tsx`：阴影 shadow-radius 2 → 4。
- `BoardMount.tsx`：首帧看门狗 4s → 10s（桌面 high 档懒加载 Effects 子分包 +
  首次着色器编译在软件渲染/低端机上可超过 4s，看门狗误杀把能用的 3D 打回 2D；
  等待期间 Suspense 已在渲染 Board2D，用户观感与立即回退相同；
  真无 WebGL 由 detectWebGL 前置拦截，不走到这里）。

### 测量工具（`shots/`）
- 新增 `fit-solve.mjs` / `solver-actual.mjs`（求解器预测）、`measure-rim.py`
  （R1 填充口径：flood-fill 水体，最大非水连通块 = 岛，rim bbox ÷ 自由带）、
  `measure-exposure.py`（T2 曝光口径）、`measure-ui-cdp.mjs`
  （measure-ui.mjs 的 CDP 变体，见 §4 测量方法说明）。
- 修改 `measure-ui.mjs` / `shoot.mjs`：BASE 环境变量、ensure3d 重试（3D 未挂载
  时暖重载一次，杜绝 2D 回退截图混入测量集）、R5 拍摄协议（resetKey 后固定
  4.5s 定格、游戏状态钉死）。

## 2. 实测：海、船、整岛（A1 / A3 / A5）

拍摄：`shots/measure-ui-cdp.mjs after`（R5 协议：fresh load、post-resetKey、4.5s 定格）。
证据：`shots/ui_board_desktop_after.png`、`shots/ui_board_phone_after.png`、
`shots/ui_board_desktop_after_noui.png`、`shots/ui_board_phone_after_noui.png`
（另见 `shots/art_board_*_after.png`、`shots/art_market_*_after.png`，与 ui_*_after.png
同源复制，见 §4）。

- **A1 像素证据**（noui 图，`is_water` 口径 b>r+25 且 b>g+15 且 b>100）：
  桌面首行蓝像素 y=0（x=200/400/640/880/1080 五列）；顶部中心 (640,40)=(99,192,249)，
  左上 (40,40)=(92,188,248)，均为深水蓝；四角、四边均为水面，无奶油底色、
  无圆盘边缘、无天空带。手机同理（画布区 0–612 全为水面/岛，右 262px 为 DOM 竖栏，
  非画面内容）。
- **A3**：两视口截图中 8 个站点地砖全部入画，无边缘裁切（桌面 noui 图目视确认；
  手机 noui 图同理）。
- **A5**：桌面 noui 图可见船 ×3（左上白帆、右中蓝白帆、左下紫帆）+ 浮标 ×2
  （右上蓝点、左下紫点）；桌面 ui 图（带面板）可见船 ×2（左、右边缘各 1 艘，
  第 3 艘被左下 bot 卡片遮住）；手机 noui/ui 图可见船 ×3 + 浮标 ×2。
  船不遮挡任何站点。

## 3. 实测：填充（A2）

口径（DISCUSSION_R5 R1 裁决）：**rim bbox（FIT_BOUNDS 外廓，含浅滩）÷ 自由带面积**，
合格带 0.60–0.70，两视口分别达标；同时报告 core÷自由带、core÷视口。
自由带：桌面 868×539 = 468k（bot 列内缘 × 顶栏底 → 底栈顶）；手机 612×282 = 173k
（画布减顶行头像、fabs 区与 262px 右竖栏）。

| 视口 | 口径 | Before（R4） | After（R5） | 目标 |
|---|---|---|---|---|
| 桌面 | 求解器 FIT_BOUNDS rim ÷ 自由带 | 0.872（857×476，d=37.6） | **0.662**（740×419，d=42.9） | 0.60–0.70 ✅ |
| 桌面 | flood-fill 可见陆地 rim ÷ 自由带 | 0.418（552×354） | **0.584**（660×414 @ (314,156)，273k） | 0.60–0.70 ⚠️（见 §5） |
| 桌面 | core ÷ 自由带 / core ÷ 视口 | 0.332 / 0.152 | 0.554 / 0.253（626×414） | 参考 |
| 手机 | 求解器 FIT_BOUNDS rim ÷ 自由带 | 0.665（453×254，d=36.7） | **0.665**（453×254，d=36.7） | 0.60–0.70 ✅ |
| 手机 | flood-fill 可见陆地 rim ÷ 自由带 | 0.333（296×194） | **0.699**（422×286 @ (156,72)，120k） | 0.60–0.70 ✅ |
| 手机 | core ÷ 自由带 / core ÷ 视口 | 0.290 / 0.142 | —（core 口径被 T4 镜头带污染，见 §5） | 参考 |

- 求解器预测与运行时实测一致（§1，fitD 42.879 = 42.9；相机位置 = homePos）。
- 同方法前后对比（flood-fill）：桌面 0.418 → 0.584（+40%），手机 0.333 → 0.699
  （+110%）。岛在视觉上明显变大：桌面岛宽占自由带宽 76%（660/868）。
- 手机求解器值未变：手机改动是自由带修正（把 262px 竖栏建进取景），不是填充改动；
  可见陆地从 0.333 → 0.699 是因为 R4 手机岛被竖栏压住、取景错位，R5 摆正后
  岛回到自由区内。

## 4. 实测：面板遮挡（A4）与曝光（A6）

### A4 面板遮挡（`shots/analyze-ui.py after` + rim bbox 复核）
- **桌面棋盘屏：岛遮挡 0.0%** ✅（analyze-ui 口径 0.0%；以 flood-fill rim bbox
  (314,156,660,414) 复核同样 0.0%）。画布遮挡 30.6%（面板只盖海面，不盖岛）。
- 手机棋盘屏：岛遮挡 1.0%（rim bbox 复核；analyze-ui 以被污染的 core bbox
  计为 12.6%，见 §5）。1.0% 来自右下 "Reset view" 浮层（`.board3d-overlay`
  482,346,121,48）轻擦岛右下 rim 角；A4 只要求桌面 0.0%，手机无此项。
- 市场/转盘屏为模态面板，遮挡岛是设计行为（桌面市场 100%、转盘 100%），不在 A4 内。

### A6 曝光（T2 口径：岛下半带 near-white / blown）
- 桌面：near-white **3.66%**、blown **0.15%**（rim bbox 下半带；core bbox 口径：
  3.05% / 0.17%）。接受带 near-white 3–5%、blown ≤2.5% ✅。
  相对 T2 接受值（4% / 1.9%）：near-white 略低（程序化草地斑驳使下半带稍暗），
  blown 大幅改善——无过曝回退。
- 手机：near-white **1.42%**、blown **1.40%**（rim bbox 下半带）。near-white 低于
  3–5% 桌面带——方向是更暗而非过曝，blown 在限内 ✅；手机无独立的 T2 接受值，
  以“无过曝回退”判定为通过（见 §6 A6）。

## 5. 测量方法说明与待决项

### 截图方法（重要）
VM 上 `page.screenshot` 在挂载 WebGL 画布时**从不完成**（180s 超时；已验证：
2D 棋盘截图 0.1s 完成；3D 挂载后连续 4 次超时，包括 reduced-motion 变体；
孤儿 gpu-process 在超时期间占 73.5% CPU 空转）。这是 SwiftShader 合成器
与持续 present 的 WebGL 画布之间的已知环境问题，与本轮改动无关
（R5 之前 20:10 的一次运行曾成功，属偶发）。
本轮 after 截图改用 CDP `Page.captureScreenshot` + `fromSurface:false`
（`shots/measure-ui-cdp.mjs`，其余流程与 measure-ui.mjs 完全相同）：
返回最后已呈现帧，每张 16–170s（首张最慢，后续 16–96s），10 张全部成功。
代价：**CDP 返回时相机已继续跟随收敛**（~160s 的跟随插值，目标已完全收敛到
station-0 轻混合点），因此 after 截图的相机状态是“收敛后默认视图”，而非
4.5s 时刻的中间态。岛的尺寸不受影响（跟随只动注视点，机位距离不变），
位置有约 0.7 世界单位的跟随偏移。填充（面积比）、A1、A4、A6 的量测不受影响；
与基线（4.5s 态）的逐像素位置对比不适用。并发验证的探针截图（4.5s 态，
`/tmp/probe_4s.png`，同一构建、同一协议）显示同一取景，构图一致。
**真机复核时建议用标准 harness 重拍一次 4.5s 态截图。**

### 构建说明
after 截图取自 dist `Board3D-CL6JYq64.js`（gzip 282,377 B）；最终提交的树
已移除临时探针（`window.__fitD` / `window.__cam3`），重建后为
`Board3D-B0u6U3XB.js`（gzip 282,343 B），与截图构建仅差探针一行，行为一致。
`npm run build` 干净、`npm test` 85/85 均在最终树上复核通过。

### 待决项 1：A2 桌面可见陆地复核 0.584
- 裁决口径（FIT_BOUNDS 求解器）桌面 0.662 ✅，手机 0.665 ✅。
- flood-fill 可见陆地复核：桌面 0.584（低于 0.60 下限 1.6 个百分点），手机 0.699 ✅。
- 原因：FIT_BOUNDS（±8.55）比可见沙沿（±7.6）每侧宽约 1 世界单位——
  FIT_BOUNDS 含岛周约 1 单位的浅滩水环；flood-fill 把浅滩水环计为水，
  只量陆地。可见陆地 / FIT_BOUNDS ≈ 0.88（桌面），与求解器值 0.662
  对应 0.584 ≈ 0.662 × 0.88。
- 判断：**不返工**。理由：(a) 裁决口径已通过；(b) 差距 1.6 个百分点，
  视觉上岛宽已占自由带宽 76%，与 60% 下限的观感差异不可辨；
  (c) 收紧 FIT_RECT 一个档（桌面 l.145 → l.14，d 42.9 → 42.2）可把可见陆地
  推到 ~0.60，但需重建 + 全部重拍（本轮截图每张 16–170s），且手机已贴近
  0.70 上限、动桌面常数有连带风险。**请 PM/用户定夺**：接受 0.584，
  或下轮把桌面 FIT_RECT 放松一档（l.14）并重测。
- 手机 core 口径失效：手机 noui 图的 green/tan core bbox（698×250 @ (2,70)）
  被 T4 镜头带污染——`.board3d-lens`（CSS backdrop-filter 模糊带 + 暗角）是
  DOM 浮层，不在 `PANEL_SELECTORS` 内，noui 截图时仍保留，模糊带把岛的
  绿/棕抹过整个带宽，导致 core 误判。手机 core ÷ 自由带 1.019 为无效值，
  不采用；手机以 rim（flood-fill，水体口径，不受镜头带影响）为准。
  建议后续把 `.board3d-lens` 加入 noui 隐藏列表（不在本轮改动内，避免动 harness
  后重拍）。

### 待决项 2：雾 60–120 → 90–180（F5 字面值）
见 §1 A1 与 §6 F5。机制未变（求解距离 42.9 仍在雾程外，岛体不受雾影响），
字面值与 CHANGELOG 的“雾 60–120”不同，是按 DISCUSSION_R5 round-1 预案
触发的修正。A1 不改雾无法达标（画角水面会被雾洗成底色）。

## 6. 自查：ACCEPTANCE_R5.md A–F 逐项

### A. 用户硬指标
- [x] A1 海铺满全屏——通过（§2 像素 + 目视，两视口）。
- [x] A2 岛占 60–70%——按裁决口径通过（桌面 0.662 / 手机 0.665）；可见陆地
  复核桌面 0.584 待决（§5 待决项 1）。
- [x] A3 整岛入画——通过（两视口 8 站全部入画，目视）。
- [x] A4 桌面岛遮挡 0.0%——通过（§4）。
- [x] A5 海上有玩具小船——通过（桌面默认视图 2 艘、noui 3 艘；手机 3 艘；§2）。
- [x] A6 曝光不回退——通过（§4；桌面在带内，手机无过曝）。
- [x] A7 测试 85/85——通过（10 文件，97.8s，最终树）。
- [x] A8 构建干净——通过（tsc + vite，10.31s，最终树）。
- [x] A9 Board3D gzip 282,343 B ≤ ~300 kB——通过。
- [x] A10 cards.json 零改动——通过（git diff 为空，5 道菜谱不变）。
- [x] A11 引擎零改动——通过（src/game/ diff 为空）。
- [x] A12 ADAPTATION 14 条零改动且仍满足——通过（diff 为空；单测 85/85 含规则单测）。
- [x] A13 英文 UI 文案零改动——通过（strings/界面文案 diff 为空；本分支未碰
  src/components/、src/screens/、src/theme/）。

### B. ART_3D §9 画质 10 项
- [x] B1 移轴景深——保持（桌面 high 档 TiltShift；截图上下两端虚化、中心清晰带
  约 15–20% 画面高度；跟随自己棋子——机制未动）。
- [x] B2 镜头俯角 50–60°、FOV 25–30°——通过（fov 27；俯角 = atan(21/18) ≈ 49.4°，
  注视点偏移后等效约 50°，与 R5 前一致，未动）。
- [x] B3 塑料材质——保持（MeshPhysicalMaterial roughness 0.35–0.45 /
  clearcoat ≈0.3 / metalness 0；地砖/土路 ≈0.8；Kenney colormap 继续使用；
  本轮只加了程序化贴图，未改材质参数）。
- [x] B4 草地亮绿 #5CC94A–#7ED957——保持（草地基色未动；斑驳贴图在亮绿区间内
  做明暗变化；暖橙/黄只留在摊位、屋顶、按钮）。
- [x] B5 斜阳——保持（主光 #FFF1D6、强度 2.5–3、仰角约 40°；半球光
  #BFE3FF/#E8D7B0 ≈0.6；PCFSoft 阴影，mapSize 桌面 2048 / 手机 1024；未动）。
- [x] B6 泛光——保持（Bloom 强度 0.25、阈值 1.0，见冲突 C-2，以 T2 为准；未动）。
- [x] B7 花草细节——保持（每间隙 3–6 件，InstancedMesh；未动；T6 密度不变）。
- [x] B8 一切圆润——保持（RoundedBox 地砖厚 0.15 / 倒角 0.04；岛边厚度明显、
  侧面暖土色；球团簇树；未动）。
- [x] B9 水——通过（浅水 #7FD8F0 → 深水 #3BA7D9 渐变、岸边泡沫线（本轮加了
  泡沫噪声 alphaMap）、流动波光；铺满范围以 A1 为准 ✅）。
- [x] B10 双端无描边——通过（无 OutlinePass / EdgesGeometry / 反向外壳；未引入）。

### C. ART_3D §1–§8
- [x] C1 8 站各有可辨识建筑/道具——保持（未动）。
- [x] C2 菜市场最显眼——保持（体量 1.5–2 倍、彩色布棚 + 招牌 + 食材；未动）。
- [x] C3 路面暖奶油圆角地砖——保持并加强（本轮加了砂砾贴图；站点格大一号、
  间隙 2–3 块过渡砖；未动结构）。
- [x] C4 天气转盘在岛正中央、无骰子——保持（未动；转盘截图见 spinner 证据）。
- [x] C5 转盘演出——保持（结果引擎先定、3D 只演出；转时推近、停后回俯视；
  prefers-reduced-motion 直接停到结果；未动）。
- [x] C6 棋子 4 色——保持（橙 #FF6B2C / 蓝 #5B7CFA / 黄 #FFC93C /
  薄荷 #7ED9B5；头顶图标与 2D 头像一致；未动）。
- [x] C7 棋子每回合走 1 站、弧跳、落地压扁回弹、镜头平滑跟随——保持
  （机制未动；FOLLOW_MIX 收小后跟随仍平滑，见 DISCUSSION_R5 判定标准——
  脚本化跟随手感实测未在本轮 VM 环境做，见 §7）。
- [x] C8 场景“活气”——保持并加强（树轻摇、水面波光、顶棚轻飘、烟囱冒烟；
  本轮加了船/浮标起伏；默认视图截图可辨船只位置变化——noui 与 ui 图
  船位不同，源于拍摄时刻的起伏相位）。
- [x] C9 钱的反馈——保持（硬币飞、数字跳动、凑齐菜篮子发光 + 彩纸；未动）。
- [x] C10 动画 ≤1.5s 且可跳过——保持（未动）。
- [x] C11 轮到孩子镜头回其棋子 + 大主按钮——保持（机制未动；FOLLOW_MIX 收小
  后回位幅度减小但仍向棋子移动；脚本化跟随手感实测见 §7）。
- [x] C12 当前站点地砖抬起发光——保持（未动）。
- [x] C13 3D 内无文字——通过（站名只在 DOM 层；本轮新增几何均无文字）。
- [x] C14 天空/背景奶油→浅蓝柔和渐变——保持（雾色 #E7F1F7；A1 达成后背景
  只在雾外极远处露出，见冲突 C-4；未动配色）。
- [x] C15 色板一致——通过（橙/黄/蓝/薄荷/淡紫/奶油/墨；船/浮标只用蓝/紫/
  奶油，未引入新色）。
- [x] C16 无诱导视觉——通过（无连抽/倍数/闪光宝箱/倒计时；无抢夺/偷钱/排名）。

### D. REQUIREMENTS §14 + DEVELOPMENT §9
- [x] D1 技术栈不变——通过（three + R3F + drei，React 18；BoardMount 懒加载分包；未换引擎）。
- [x] D2 兜底链完整——保持（WebGL 不可用 / 看门狗超时 / 3D 抛错 → 退 2D；
  `?board=2d` / `?board=3d` 强制；2D 保留；看门狗 4s → 10s 只改阈值，
  不改链路——本轮实测：2D 截图流程正常，3D 挂载失败时 ensure3d 重试一次）。
- [x] D3 3D 画布 aria-hidden + 文字状态行——保持（未动）。
- [x] D4 frameloop="demand"——保持（未动；船/浮标走 useAmbient 合并 invalidate）。
- [x] D5 画质三档——保持（high 桌面全后期链；medium 手机关移轴/泛光/N8AO、
  影图 1024、dpr ≤2；low 自动降；未动）。
- [x] D6 持续掉帧自动降档——保持（PerformanceMonitor 或等效；未动；
  VM 软件渲染帧率不具代表性，不做降档判定）。
- [x] D7 public/models/ ≤ ~3 MB——保持（未引入外部模型；船/浮标为程序化几何）。
- [x] D8 第三方登记——保持（本轮未引入新第三方库/素材；程序化贴图为自写，
  无需登记；THIRD_PARTY_NOTICES.md 未动）。
- [x] D9 dist 为 base:'./' 静态产物——保持（未动；本轮即用 vite preview 静态验证）。

### E. DEVELOPMENT §9.7（M4.5.7 实装约定）
- [x] E1 默认 NeutralToneMapping——保持（ACES 仅 `?tonemap=aces` 对照；未动）。
- [x] E2 后期链恰好 6 个效果且顺序 N8AO → Bloom → TiltShift →
  ToneMapping(NEUTRAL) → HueSaturation → BrightnessContrast——保持（未动）。
- [x] E3 HDRI 只作 PBR 反光、不作背景——保持（未动）。
- [x] E4 GLB 统一替换为带反光塑料材质——保持（未动；本轮无新 GLB）。
- [x] E5 桌面接触阴影 = N8AO 单一方法——保持（aoRadius 0.5、distanceFalloff 1、
  intensity 2.5、quality "low"；未动；shadow-radius 2 → 4 是方向光阴影
  参数，非贴片假影）。
- [x] E6 对照开关——保持（`?fx=0` 关后期链、`?ao=0` 关 N8AO、`?env=0` 关 HDRI；
  未动。本轮另有 `?fx=0` 对照截图 `shots/artfx0board_desktop.png`
  为旧构建（UI 线）产物，不作为本分支证据——见 §7）。
- [x] E7 Effects 子分包与 Board3D 分离、手机不下载——保持（未动）。

### F. CHANGELOG_VISUAL（T0–T7 已接受状态，不得回退）
- [x] F1 T0 安全区——保持（safearea.spec.ts 在 85/85 内通过；`.phone-rail .popup
  { animation: none }` 未动；手机主按钮 ≥48px 且在安全区内——单测覆盖）。
- [x] F2 T2 水面粗面——保持（roughness 0.62、envMapIntensity 0.3；
  tone exposure 1.0；未动。深水平面沿用同一组值）。
- [x] F3 T3 N8AO——保持（开启状态交付；未动）。
- [x] F4 T4 手机镜头感——保持（CSS backdrop-filter 模糊带 + 暗角；
  flags.lens 仅 medium；未动。手机 core 口径被镜头带污染一事见 §5，
  是测量口径问题，不是回归）。
- [ ] F5 T5 求解器式取景——**字面值偏差**：雾 60–120 → 90–180（见 §5 待决项 2）。
  机制不变（二分求距、无经验倍率、无 compact 0.8 系数；FIT_RECT 常量按
  A2/A4 更新，机制不变）。求解距离 42.9 仍在雾程（90–180）外，岛体不受雾影响。
- [x] F6 T6 植被密度——保持（每间隙上限 6 件、keep-out 不变、种子 mulberry32 不变；
  程序化贴图另用同一 mulberry32 种子）。

## 7. 未做 / 遗留（诚实清单）

1. **交互验收（完整对局实测）未做**：本轮任务书要求在合并后 build 上实际走一遍
   完整对局（点按反馈、动画 ≤1.5s 且可跳过、棋子移动与镜头跟随平滑、按钮 ≥48px
   且在安全区内、轮到孩子镜头回位、面板不挡玩法）。VM 软件渲染下 e2e 计时与
   帧率不具代表性，且本分支尚未合并 UI 线——完整对局交互验收应在合并后、
   真机（或至少一次干净的 VM e2e）上做。跟随手感判定（DISCUSSION_R5：孩子回合
   棋子向自由带中心移动，桌面 ≥10px、手机 ≥4px，方向正确、无过冲；回正/转盘后
   漂移 ≤5px）同样待合并后脚本化实测。本分支只保证了静态取景与机制未动。
2. **`?fx=0` 对照截图未重拍**：旧 `shots/artfx0board_desktop.png` 是 UI 线构建
   的产物，不可作为本分支证据。E6 开关本身未动（代码级保持）。
3. **手机 core 口径失效**（§5）：`.board3d-lens` 未进 noui 隐藏列表，手机
   core（green/tan）读数无效；已改用 rim 口径。建议后续把 `.board3d-lens`
   加入 `PANEL_SELECTORS`。
4. **A2 桌面可见陆地复核 0.584**（§5 待决项 1）：请 PM/用户定夺是否接受，
   或下轮放松桌面 FIT_RECT 一档并重测。
5. **CDP 截图的相机状态偏差**（§5）：after 截图为跟随收敛后状态，非 4.5s 中间态；
   真机复核时用标准 harness 重拍 4.5s 态。
6. **未提交的中间产物**：`.discuss2-context/`（round-2 讨论草稿）、
   `UI_STYLE_REFERENCE.png`（用户给的 UI 参考图，3.7 MB——UI 分支已有副本，
   本分支不入库）、`shots/` 下的 r5_1/r5_2/r5_3/base2/r1/r1b 等中间截图与
   一次性探针脚本（probe-*.mjs、probe-converge.mjs）未提交；`shots/artfx0board_desktop.png`
   为旧构建诊断图，未提交。`shots/art_board_desktop.png` /
   `shots/art_board_phone.png`（Devin 时期的中间名）未提交，以
   `art_board_*_after.png` 为准。
7. **F5 雾字面值**（§5 待决项 2）：雾 90–180 与 CHANGELOG 的 60–120 字面不同，
   机制未变；请 PM 确认是否更新 CHANGELOG_VISUAL.md 的 F5 表述。

## 附：关键文件与证据清单

- 改动：`src/board/three/CameraRig.tsx`、`src/board/three/Island.tsx`、
  `src/board/three/Scene.tsx`、`src/board/three/StreetLoop.tsx`、
  `src/board/BoardMount.tsx`、新增 `src/board/three/textures.ts`。
- 工具：`shots/measure-ui.mjs`、`shots/shoot.mjs`（修改）、
  `shots/fit-solve.mjs`、`shots/solver-actual.mjs`、`shots/measure-rim.py`、
  `shots/measure-exposure.py`、`shots/measure-ui-cdp.mjs`（新增）。
- 证据：`shots/ui_board_desktop_after.png`、`shots/ui_board_desktop_after_noui.png`、
  `shots/ui_board_phone_after.png`、`shots/ui_board_phone_after_noui.png`、
  `shots/ui_market_desktop_after.png`、`shots/ui_market_phone_after.png`、
  `shots/ui_spinner_desktop_after.png`、`shots/ui_spinner_desktop_after_done.png`、
  `shots/ui_spinner_phone_after.png`、`shots/ui_spinner_phone_after_done.png`、
  `shots/art_board_desktop_after.png`、`shots/art_board_phone_after.png`、
  `shots/art_market_desktop_after.png`、`shots/art_market_phone_after.png`、
  `shots/ui_rects_all.json`（"after" 标签）。
- 构建：`npm run build` 干净（tsc + vite，10.31s）；`npm test` 85/85（10 文件）；
  Board3D 1,040,781 B，gzip 282,343 B。
