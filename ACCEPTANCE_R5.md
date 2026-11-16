# ACCEPTANCE_R5 — 《一起去买菜》R5 画风精进验收清单

用途：R5 轮（Devin 执行、Muse 按 PM 监督验收）逐项打勾。每项一行，可从 build / 测试 / 截图 / 测量直接判定 pass/fail。
优先级（依 AI_START_HERE）：用户最新确认 > 交接包现行覆盖项 > 对应日期任务原文 > 历史文档旧段落。冲突见文末 C-1…C-8，不在此清单内擅自裁决。

来源说明：`ART_3D.md` 不在 maicai-work 树内，本清单用的是 Grok 导出包 `03-reference-inputs/ART_3D.md`（ww 2026-11-13 v0）；`02-handoff-docs/` 同样取自导出包。作品集约束 `PORTFOLIO_DESIGN_CONSTRAINTS_NOT_GAME_SPEC.md` 按其自身声明**不套用**于游戏 UI，未纳入。

验收视口：桌面 1280×800、手机横屏 874×402（iPhone 17 Pro 横屏模拟）。测量工具：`shots/measure-ui.mjs` + `shots/analyze-ui.py`（island core = 去掉面板的参考截图中草地+路面像素 bbox；cover = 面板 rect 并集占该 bbox 的比例）；曝光指标 = 1280×800 棋盘截图岛体下半带中 near-white(≥245,242,232) / blown(≥250,248,240) 像素占比（CHANGELOG_VISUAL T2 同口径）。

## A. 用户硬指标（R5 本轮，2026-11-16/17 确认，覆盖一切旧值）

- [ ] A1 默认棋盘视图下海水铺满整个视口（桌面 1280×800 与手机 874×402 截图四边均为水面，无圆盘海边缘、无背景/天空带露出）
- [ ] A2 默认视图小岛占画面 60–70%（island core bbox 占视口比例，测量时须注明口径为面积比或线性比，两视口分别给出数字）
- [ ] A3 默认视图整座岛完整入画（两视口截图中 8 个站点均未被画面边缘裁切）
- [ ] A4 桌面端面板对小岛的遮挡 = 0.0%（measure-ui 口径，棋盘屏）
- [ ] A5 海面上有玩具风小船装饰（默认视图截图中至少 1 艘可见，造型与场景玩具风一致，不遮挡站点）
- [ ] A6 曝光不回退：near-white ≈4%（接受 3–5%）、blown ≈1.9%（接受 ≤2.5%），口径同 T2
- [ ] A7 `npm test` = 85/85 全部通过
- [ ] A8 `npm run build` 干净（tsc + vite 无错误）
- [ ] A9 Board3D 分包 gzip ≤ ~300 kB（现接受值 282.8 kB，dist 实测 282,458 B）
- [ ] A10 `src/data/cards.json` 零改动：恰好 5 道菜谱（6 条 recipe 条目，含重复的 rec-tomato-egg-2；无 rec-carrot-egg）——git diff 为空
- [ ] A11 引擎零改动：`src/game/` git diff 为空
- [ ] A12 ADAPTATION 14 条零改动且仍逐条满足（diff + 单测）
- [ ] A13 英文 UI 文案零改动（strings/界面文案 diff 为空）

## B. ART_3D.md §9 织梦岛画质 10 项（参数起点，验收逐条对照）

- [ ] B1 移轴景深（桌面高档）：清楚带约占画面高度 15–20%，中心 r≈0.5，跟随自己棋子；上下两端明显虚化
- [ ] B2 镜头：俯角 50–60°、FOV 25–30°（现接受值 fov 27），窄视角近正交的玩具模型感
- [ ] B3 塑料材质：道具/建筑 MeshPhysicalMaterial roughness 0.35–0.45、clearcoat ≈0.3、metalness 0；地砖/土路 roughness ≈0.8；Kenney colormap 继续使用
- [ ] B4 草地亮绿约 #5CC94A–#7ED957；暖橙/黄只留在摊位、屋顶、按钮等强调位
- [ ] B5 斜阳：主光 #FFF1D6、强度 2.5–3、仰角约 40°；半球光天 #BFE3FF / 地 #E8D7B0、强度 ≈0.6；PCFSoft 阴影，mapSize 桌面 2048 / 手机 1024
- [ ] B6 泛光（桌面高档）：Bloom 强度 0.25–0.35、半径 0.4，仅亮处有很淡光晕（阈值见冲突 C-2）
- [ ] B7 花草细节：每两站之间 3–6 个小装饰（花用亮黄/粉/蓝），无大片空白草地；InstancedMesh 实现
- [ ] B8 一切圆润：地砖厚 0.15、倒角 0.04（RoundedBox）；岛边厚度明显、侧面暖土色；树为球团簇
- [ ] B9 水：浅水 #7FD8F0 → 深水 #3BA7D9 渐变，岸边一圈白色泡沫线，有流动波光（铺满范围以 A1 为准，见冲突 C-4）
- [ ] B10 双端均无任何描边（无 OutlinePass / EdgesGeometry / 反向外壳）

## C. ART_3D.md §1–§8 场景与手感

- [ ] C1 8 站各有可辨识的小建筑/道具（邮筒/公告板、市场布棚、长椅+树、站牌+小车、问号牌/礼盒、大手机/电话亭、小店面、冒烟小屋+饭桌）
- [ ] C2 菜市场最显眼：体量为其它站 1.5–2 倍，彩色布棚 + 招牌 + 摆出食材
- [ ] C3 路面为暖奶油色圆角地砖，站点格比普通格大一号，相邻站点间 2–3 块过渡地砖
- [ ] C4 天气转盘在岛正中央（平放圆盘/太阳伞形，扇区绘天气图标）；全场没有骰子
- [ ] C5 转盘演出：结果由引擎先定，3D 只演出；转时镜头推近、停后回俯视；prefers-reduced-motion 直接停到结果
- [ ] C6 4 个棋子按玩家色：你 #FF6B2C 橙 / 小稳 #5B7CFA 蓝 / 小冲 #FFC93C 黄 / 小跟 #7ED9B5 薄荷；头顶图标与 2D 头像一致
- [ ] C7 棋子每回合固定走 1 站，沿路径弧跳、落地压扁回弹；镜头平滑跟随不硬切
- [ ] C8 场景有"活气"：树轻摇、水面波光、摊位顶棚轻飘、回家站烟囱冒烟（默认视图截图/录屏可辨）
- [ ] C9 钱的反馈：付钱硬币飞向摊位、得钱飞进钱包、数字跳动；凑齐一道菜时篮子发光 + 一小把彩纸（仅此场合撒彩纸）
- [ ] C10 每段动画 ≤1.5 秒且可点击跳过
- [ ] C11 轮到孩子操作时镜头回到其本人棋子，并显示会跳动的大主按钮
- [ ] C12 当前站点地砖微微抬起并发光
- [ ] C13 3D 场景内不出现任何文字（站名只在 DOM 层）
- [ ] C14 天空/背景为奶油→浅蓝柔和渐变（未被海水覆盖处，见 A1/C-4）；光线暖、阴影软
- [ ] C15 色板一致：橙 #FF6B2C、黄 #FFC93C、蓝 #5B7CFA、薄荷 #7ED9B5、淡紫 #B9A3F0、奶油 #FFF6EC、墨 #1E1E2A；饱和中高不刺眼
- [ ] C16 无连抽/倍数/闪光宝箱/倒计时等"再来一次"诱导视觉；无抢夺、偷钱、排名类视觉元素

## D. REQUIREMENTS.md §14（M4.5）+ DEVELOPMENT.md §9 技术与兜底

- [ ] D1 技术栈不变：three + R3F + drei（React 18），Board3D 经 BoardMount 懒加载分包；未换引擎
- [ ] D2 兜底链完整：WebGL 不可用 / 首帧看门狗超时 / 3D 抛错 → 自动退 2D；`?board=2d` 强制 2D、`?board=3d` 强制 3D；2D 棋盘保留不删
- [ ] D3 3D 画布 `aria-hidden="true"`，且有文字状态行（第几圈/第几站/轮到谁）供读屏
- [ ] D4 `frameloop="demand"`：静止时不持续渲染
- [ ] D5 画质三档行为：high=桌面全后期链；medium=手机默认（关移轴/泛光/N8AO、影图 1024、dpr ≤2）；low=掉帧自动降（关实时阴影改贴片影、dpr=1、密度再减）
- [ ] D6 持续掉帧自动降档（PerformanceMonitor 或等效）；降档后仍不流畅则退 2D
- [ ] D7 `public/models/` 总量 ≤ ~3 MB
- [ ] D8 第三方登记齐全：THIRD_PARTY_NOTICES.md 含 postprocessing(Zlib)、@react-three/postprocessing(MIT)、n8ao(CC0/ISC 双记)、Poly Haven HDRI(CC0)、Kenney CC0 与全部借用代码片段
- [ ] D9 dist 为 `base:'./'` 静态产物，任意静态服务器可打开；未部署公网

## E. DEVELOPMENT.md §9.7（M4.5.7 实装约定，接受路线）

- [ ] E1 默认色调映射 = NeutralToneMapping；ACES 仅经 `?tonemap=aces` 对照，不作默认
- [ ] E2 后期链（仅 high 档、Effects.tsx 懒加载子分包）恰好 6 个效果且顺序为：N8AO → Bloom → TiltShift → ToneMapping(NEUTRAL) → HueSaturation → BrightnessContrast
- [ ] E3 HDRI `public/env/spruit_sunrise_512.hdr` 只作 PBR 反光，不作场景背景
- [ ] E4 加载 GLB 时统一替换为带反光的塑料材质（materials.ts/gltf.ts 集中处理），保留原 colormap 贴图
- [ ] E5 桌面接触阴影 = N8AO 单一方法（aoRadius 0.5、distanceFalloff 1、intensity 2.5、quality "low"）+ 分档方向光阴影；桌面不另加贴片假影
- [ ] E6 对照开关仍可用：`?fx=0` 关后期链、`?ao=0` 关 N8AO、`?env=0` 关 HDRI
- [ ] E7 Effects 子分包与主 Board3D 分包分离，手机档不下载 Effects

## F. CHANGELOG_VISUAL.md（T0–T7 已接受状态，不得回退）

- [ ] F1 T0 安全区：safearea.spec.ts 通过——874×402 全局每个主按钮都在安全区内；手机 rail 内弹窗无入场位移动画（`.phone-rail .popup { animation: none }` 仍在）
- [ ] F2 T2 水面材质保持粗面：roughness 0.62、envMapIntensity 0.3；曝光 tone exposure = 1.0
- [ ] F3 T3 N8AO 开/关对照仍有可测差异（岛体带 >6 亮度变化像素约 21% 量级），且 AO 为开启状态交付
- [ ] F4 T4 手机 medium 档镜头感 = CSS backdrop-filter 模糊带（上下各 24%、blur 3px）+ 暗角；flags.lens 仅 medium 为 true；`?fx=0` 与降档（medium→low）会移除它；该效果不新增 JS 分包
- [ ] F5 T5 相机取景为求解器式（岛 bbox 投影 + 二分求距），无经验倍率、无 compact 0.8 特写系数；场景雾 60–120，求解距离不在雾程内（FIT_RECT 常量按 A2/A4 更新，机制不变，见 C-3）
- [ ] F6 T6 植被密度：每间隙保留上限 6 件（过滤后），keep-out 不变（转盘 r<2.9、站点格、道具锚点、 rim 树），种子 mulberry32 不变

## G. UI_ITERATION.md（R1–R4 已接受状态，不得回退）

- [ ] G1 桌面回合提示为单行细条（仅状态 + 主按钮，主按钮 421×56），且停靠在 HUD 正上方、真实屏幕底部；底部堆叠总高恒定 189px；屏幕中部无面板
- [ ] G2 "Reset view" 为条外小 pill（条右上方、压在水面上），不在条内
- [ ] G3 桌面 HUD 高 81px；chips 最小高度 ≥56px 不变；无字号缩减
- [ ] G4 圈次顺序文字在卡内换行（overflow-wrap: anywhere），永不溢出屏幕右缘
- [ ] G5 手机 rail 宽 30%（874px 下 262px），rail 内容不裁切；市场网格、事件选项、全部 rail 按钮完整可见
- [ ] G6 手机棋盘屏 canvas cover ≤41.1%、island cover = 0.0%（measure-ui 口径）
- [ ] G7 桌面条高在所有阶段恒定（log 行内联 + 省略号，全文在 aria-live log 中）
- [ ] G8 本轮 UI 文件改动仍限于布局/CSS 与 CameraRig 取景常量；T0 修复（F1）未被动过

## H. 02-handoff-docs 覆盖项（PRODUCT_REQUIREMENTS.md / DESIGN_ACCEPTANCE.md，现行优先于旧文档）

- [ ] H1 界面全英文、短句；任何画面无中文残留
- [ ] H2 手机只做横屏（验收视口 874×402）；竖屏只显示 "Turn your phone sideways"，不要求竖屏可玩
- [ ] H3 安全区模型：874×402 下左右各 62px、上下各 20px；同时仍使用 env(safe-area-inset-*)
- [ ] H4 市场/商店均先选商品再购买；市场第一行整宽 "Buy (N coins)"，第二行 "Maybe later" / "Skip"；按钮文字不溢出、单词不任意拆字
- [ ] H5 开饭页标题 "Dinner time"，4 盘同排一屏；标签只用 Full plate / Simple plate / Next time，无 win/lose 字样
- [ ] H6 感想页：选项 2 列 × 3 行；选后 4 人感想 2 列 × 2 行、自己在左上，其后 "Everyone has shared" 与 "Play again"；无裁切、无覆盖
- [ ] H7 固定机位验收截图（1280×800 与 874×402）与参考并排，按 §B 逐条对照并记录差异
- [ ] H8 任何画面不出现排名/分数/淘汰/负余额/真实支付/商城/登录元素
- [ ] H9 一起买各付各的；公交费仅第 1 圈收；缺 1 样 = Simple plate，缺 ≥2 样 = Next time（剪影盘）
- [ ] H10 源码与 dist 无密钥（发布前扫描）；任何 API key 只许服务端持有，不进浏览器/GitHub

## I. REQUIREMENTS.md §10/§12 + ADAPTATION（仍有效的底线项）

- [ ] I1 正文 ≥20px 等效可读性不回退；可点目标 ≥48×48px、主按钮 ≥56px 高（桌面 56 / 手机 rail 主按钮 48 为已接受现状，见 F/G 组实测）
- [ ] I2 全部操作可仅用键盘完成（Enter/Space/1..n/Esc/W/H/D 键位不变）；弹窗焦点困住与归还行为不变
- [ ] I3 3D 只是视图层：所有规则操作仍在 DOM 按钮上；引擎不依赖 React
- [ ] I4 视觉 token 只定义在 `src/theme/tokens.css`，组件不写裸色值/裸字号
- [ ] I5 借用代码/素材只借形式不拷美术：无 Nintendo、无许可证或闭源项目的代码/模型/贴图/音效进入仓库

---

## 冲突与被覆盖项（只标记，不裁决；R5 执行时按"现行优先"列处理并回报）

- **C-1 调色推子 vs 曝光（硬冲突）**：ART_3D §9.4 要求后期饱和 +20–30%、对比 +10%（WIP 实装为 HueSaturation +0.2 / BrightnessContrast +0.1）；已接受的 T2 恰恰**移除了**这组推子才把 near-white 从 13.7% 压到 4.0%（它是过曝主因）。→ R5 不得恢复该推子；§9.4 中材质层面的颜色目标（B4）不受影响。验收以 A6/F2 为准。
- **C-2 Bloom 阈值**：ART_3D §9.6 写阈值 0.85；已接受 T2 为压曝光改为阈值 1.0、强度 0.25（强度在 §9.6 的 0.25–0.35 区间内，阈值不在）。按 §9 字面逐条对照会"不达标"，实为已接受状态，R5 保持 1.0。
- **C-3 岛的画面占比（本轮最大变更）**：R4 已接受状态是故意把岛缩小约 25%（桌面 island core 506×304，约占视口面积 19%）换取 0% 遮挡；用户 R5 新指标 60–70% 覆盖之，同时保留 A3 整岛入画与 A4 桌面 0% 遮挡。FIT_RECT 常量必然大改，F5 的求解器机制保留。另外用户原话未定义 60–70% 是面积比还是线性比——A2 要求测量时注明口径，两种口径下结论可能不同，需 PM 定口径后再判 pass/fail。
- **C-4 海的范围**：ART_3D §1/§9.9 是"岛边一圈浅水"+ §4 奶油→浅蓝天空背景；用户 R5 要求海铺满全屏，覆盖前者。水色/泡沫线（B9）仍适用于岸线。
- **C-5 历史文档 vs 现行覆盖**：REQUIREMENTS §10/§12 与仓库内 AGENTS.md 仍写中文界面、竖屏 390×844 可玩整局、灰阶 token 等旧段落；PRODUCT_REQUIREMENTS + AI_START_HERE 已明确覆盖为英文 UI、手机仅横屏 874×402。R5 不得按旧文档把界面改回中文或恢复竖屏可玩（I 组已按覆盖后口径编写）。
- **C-6 手机移轴**：ART_3D §9 分档表写手机关移轴；已接受 T4 在 medium 档加了 CSS 模糊带近似（非 WebGL 移轴）。属已接受偏差：字面审计既不应要求手机上真移轴，也不应要求删掉 CSS 近似。
- **C-7 菜谱数量**：REQUIREMENTS §9 写"菜谱卡至少 6 张"；已接受 cards.json 为 5 道菜谱（6 条 recipe 条目含 1 条重复番茄炒蛋）。用户硬指标 = 恰好 5 道，不得为满足旧文档新增第 6 道。
- **C-8 gsap**：ART_3D §3 提到用 gsap 做棋子弹跳；DEVELOPMENT §9.2 明确不引 gsap（useFrame 手写插值）。技术路线优先，视觉验收只看 C7 的弹跳效果本身。
