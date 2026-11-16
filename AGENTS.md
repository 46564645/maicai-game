# AGENTS.md —《一起去买菜》网页游戏 demo

> **开始任何工作之前，必须先完整阅读以下两份文档，并始终以它们为准：**
> 1. `docs/REQUIREMENTS.md` —— 任务需求文档（规则、范围、不做的功能、验收标准）
> 2. `docs/DEVELOPMENT.md` —— 开发文档（技术栈、目录结构、命令、代码规范、测试）
> 3. `docs/ADAPTATION.md` —— ww 的参考游戏改编核对表（14 条必须改的点：无骰子、每回合固定走 1 站、转盘只转天气、无地产/破产/排名、孩子之间不借钱不送钱、钱不为负用待付夹、摊位必有「先等等」且诱惑品混在食材里、不用参考项目的美术等）。每个阶段交付都要逐条满足。
>
> 当前阶段 **M4.5（3D 棋盘）**：任务见 `docs/REQUIREMENTS.md` 第 14 节，开发说明见 `docs/DEVELOPMENT.md` 第 9 节，详细计划见 `docs/PLAN.md` 第 4.2 节；动手前还须读 `/workspace/maicai-logs/m4_5_addendum.txt` 与 `/workspace/maicai-design/ART_3D.md`（第 8 节逐条验收）。
> 当前子阶段 **M4.5.7「画质：织梦岛风」**：必读 `docs/DEVELOPMENT.md` 第 9.7 节（技术路线：three.js+R3F 不换引擎、塑料材质 clearcoat+CC0 HDRI、亮绿+NeutralToneMapping、pmndrs postprocessing 移轴+泛光、斜阳长阴影+N8AO、InstancedMesh 花草、双端零描边、手机关移轴/泛光自动降档、3D 分包 gzip ≤300KB）与 `ART_3D.md` 第 9 节（10 项逐条验收）。
> 如果存在 `docs/PLAN.md`（里程碑计划），也要读，并按里程碑顺序推进。
> 需求与本文件冲突时，以 `docs/REQUIREMENTS.md` 为准。

## 项目一句话
把实体财商桌游《一起去买菜》（给一至三年级留守儿童建立金钱观）完整搬到浏览器里：1 个真人 + 3 个电脑玩家，8 个站点走 3 圈，最后一起开饭。纯静态网页，无后端、无登录。

## 必须遵守
- 所有卡牌内容只放在 `src/data/cards.json`；所有可调数字只放在 `src/config/gameConfig.ts`。代码里不得硬编码卡牌文字或金额。
- 卡牌内容都是占位，必须带 `"status": "待确认"`；数字参数注释标注 `待试玩`。
- 游戏逻辑（`src/game/`，纯 TypeScript，无 React）与界面组件（`src/components/`、`src/screens/`）严格分离。
- 视觉 token（颜色、字体、圆角、间距、阴影）只在 `src/theme/tokens.css` 里定义为 CSS 变量，组件只能引用变量。后续 ww 会出正式 UI，要能一次换皮。
- 界面文字一律中文、适合 6–9 岁孩子：短句、大按钮（最小 56px 高）、大字号。
- 绝不出现：排名、分数、成绩单、淘汰、真实支付/转账、商城、金币奖励、排行榜、登录。
- 每完成一个里程碑：`npm run build`、`npm run test` 必须通过，然后 `git commit`。
- 配色用 ww 临时色板（待确认，见 REQUIREMENTS 第 10 节）；棋盘视图走 `BoardView` 接口（2D 现在做，3D 在 M4.5）；支持鼠标、键盘（全部操作可键盘完成）、触屏；横屏（平板/PC）+ 竖屏（手机）两种布局，见 REQUIREMENTS 第 10 节。
- 借用任何 MIT 等开源代码时，必须把原作者版权与许可声明写进根目录 `THIRD_PARTY_NOTICES.md`；无许可证或闭源项目只借形式，不拷代码/美术。
- 不要引入后端、数据库、网络请求或真实 AI/LLM 调用。

## 常用命令
```
npm install
npm run dev        # 开发服务器
npm run build      # 类型检查 + 生产构建到 dist/
npm run preview    # 预览构建结果
npm run test       # vitest 单元测试（游戏逻辑）
npm run e2e        # playwright 冒烟测试：自动玩完整一局
```
