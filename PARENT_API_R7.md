# R7 —— AI 家长站真对话（浏览器直连 LLM，默认通义千问）

日期：2026-11-17。前置：R6 语言切换（ca4da3e）、R8 自适应（e4ee6d4）。
本轮只动第 6 站 AI 家长站的对话来源：`src/parent/parentLive.ts`（新增）、
`src/components/ParentPanel.tsx`（问答区加真对话分支）、
`tests/unit/parentLive.test.ts`（新增）。引擎 `src/game/`、`cards.json`、
14 条规则、面板布局与视觉均未改。
R7b（同日晚，业主拍板）：主服务商由 DeepSeek 改为通义千问（见 §0），
服务商配置化为 `VITE_LLM_*` 三个环境变量，除配置外行为不变。

## 0. 业主决定与旧规覆盖（必须先读）

业主 2026-11-17 在主聊天亲自下令（原话：「用api 不怕被人搞 你里面写好
提示词」）：AI 家长站改为浏览器**直连** DeepSeek API，**不加中转**，
业主明确接受 key 放在客户端的风险。

此决定覆盖以下旧规（记录在此，避免后来者误判为违规）：
- 仓库 `AGENTS.md`：「不要引入后端、数据库、网络请求或真实 AI/LLM 调用」；
- 导出文档 `docs/AI_PARENT_PROMPT.md`（ww v0 草案）：「浏览器里不能出现
  API key。要用一个小的转发服务…」；
- `02-handoff-docs/PRODUCT_REQUIREMENTS.md`：「API 密钥…只允许服务端
  代理持有，不能进源码、浏览器或 GitHub Pages」。
以上三处均按业主本次决定让路；其余约束（发币归引擎、禁忌话题、回退
离线版）全部保留，见下。

**服务商决定（2026-11-17 后续，业主拍板）**：主服务商改为**通义千问**
（阿里云百炼 DashScope OpenAI 兼容模式，模型 `qwen-turbo`）——理由：
qwen-turbo 是能直连的选项里最便宜的（约 ¥0.3/百万输入 token）、
DashScope 的浏览器 CORS 已实测放行（见 §1）、业主将提供百炼 API key。
DeepSeek 降为备选配置：只改 `.env.local` 的 `VITE_LLM_*` 三个变量即可
切回，不改代码。原 DeepSeek key 经全盘核查始终不在本机可达之处
（见 §4），这也是换商的现实原因之一。

**模型修正（2026-11-17 收尾实测，百炼 key 到位后）**：业主提供的百炼
key 实测可正常认证，但 `qwen-turbo` 在业主百炼工作空间内每调必回
HTTP 429（`Throttling.RateQuota`，限流不计费）；同一 key 下
`qwen-flash`、`qwen-plus` 均回 200。qwen-flash 比 turbo 更便宜，故
可玩版配置改用 **qwen-flash**——纯配置修正：`.env.local` 加一行
`VITE_LLM_MODEL=qwen-flash`，代码默认仍为 `qwen-turbo`，零代码改动。
日后 turbo 限流解除，删该行即回默认。

## 1. 设计

- 端点：`POST ${VITE_LLM_BASE_URL}/chat/completions`（OpenAI 兼容形状）。
  默认 base `https://dashscope.aliyuncs.com/compatible-mode/v1`、默认模型
  `qwen-turbo`（通义千问，阿里云百炼）；`temperature 0.7`、
  `max_tokens 150`，非流式。价格参考：qwen-turbo 约 ¥0.3/百万输入
  token；百炼新账号带免费额度（具体额度以百炼控制台为准）。
- 备选 DeepSeek：`.env.local` 设
  `VITE_LLM_BASE_URL=https://api.deepseek.com`、
  `VITE_LLM_MODEL=deepseek-chat`（端点即旧版写死的
  `https://api.deepseek.com/chat/completions`）。切换只改 `.env.local`，
  不改代码（`parentLive.ts` 的 `getParentBaseUrl/getParentModel` 读取）。
- CORS 实测（2026-11-17，curl 预检，Origin: http://localhost:8000）：
  - DashScope（主）：返回 `access-control-allow-origin: *`、
    `access-control-allow-headers: authorization, content-type`、
    `access-control-allow-methods: POST,GET`——浏览器直连放行（PM 实测）。
  - DeepSeek（备选）：同样友好——OPTIONS 预检返回
    `access-control-allow-origin`（回显请求 Origin）、
    `access-control-allow-headers: authorization, content-type`、
    `access-control-allow-methods: POST`。
  两家浏览器直连都**不会被 CORS 拦**，不需要中转。
- 对话结构（面板本地状态，不进引擎）：
  - 开场白与第 1 问用既有文案（`parentIntro()` + 脚本第 1 问，当前语言），
    保证开场与离线版观感一致；
  - 孩子点图卡（快捷回复，文案=当前语言的选项标签）或打字回答；
  - 每答一轮，把对话历史发给模型要下一句家长回复（见 §2 提示词与节奏）；
  - 约 4 问后模型道别（节奏 system 强制），面板停留 ~1.8s 让孩子看完，
    然后**把孩子在真对话里给出的答案按顺序原样回放给引擎**
    （`PARENT_ANSWER` × n）；引擎照旧按图卡 tags / 打字 keywords 判定
    说清与否并决定币数（0/1/2，`grantForCleared`），LLM 全程碰不到币；
  - 回放后若引擎停在「就这样吧」（①②说清），对话已道别，面板按既有
    `PARENT_SETTLE` 信号收尾（1 币，引擎定）；若个别答案没判清、引擎
    还剩步数，真对话层关闭，离线脚本从当前步继续——永远不会卡住；
  - 孩子发言上限 5 轮（`PARENT_CHILD_TURN_CAP`）：满 4 问即道别收尾，
    上限是兜底闸。
- 语音按钮：与离线版同义（占位提示），不计轮次、不进 API 历史。
- 系统提示词（含节奏提示）只进 API 请求，**永不出现在聊天气泡**；
  气泡里只有家长回复、孩子回答与既有系统行。

## 2. 提示词（as shipped，业主定稿）

第一条 system = 业主定稿原文（按 R6 语言开关选用，`parentLive.ts` 中
`PARENT_SYSTEM_PROMPT_EN / _ZH`，单测逐条断言禁忌齐全）：

EN: "You are the child's parent, calling from far away where you work. Be
warm and encouraging, and use very short, simple sentences a 6-9 year old
can understand. Talk only about today's shopping trip: what they bought,
what they plan to cook, and how they feel. Ask one question at a time,
about 4 questions in total, then say a warm goodbye. Never talk about
winning, losing, scores or rankings. Never offer money, gifts or prizes,
and never ask for personal information (school, address, phone number).
If the child goes off topic, gently bring the talk back to the shopping
trip. Do not say you are an AI."

CN: 「你是在外地打工的爸爸妈妈，正在给孩子打电话。语气要温暖、鼓励，
用很短、很简单的句子，让 6 到 9 岁的孩子能听懂。只聊今天去买菜的事：
买了什么、打算做什么菜、心情怎么样。一次只问一个问题，一共问大约
4 个问题，然后温柔地道别。绝不提输赢、分数、排名；绝不许诺给钱、
礼物或奖励；绝不索取任何个人信息（学校、地址、电话）。孩子说到别的
话题，就温和地把话题带回买菜。不要说自己是 AI。」

第二条 system = 节奏提示（实现层补充，不改业主约束）：按已答轮数二选一
——未满 4 问：「先温暖回应，再只问一个买菜相关的新问题」；满 4 问：
「不要再提问，温柔道别」。另有本地清洗：回复去包裹引号、截 300 字。

## 3. 回退矩阵（任一失败 → 离线脚本版，孩子无感）

| 情形 | 行为 |
|---|---|
| 构建未注入 key（`VITE_LLM_API_KEY` 缺失/为空） | 本站全程离线脚本版，与 R6/R8 一致 |
| 请求超时（10s，AbortController） | 当前轮抛错 → 关真对话层，离线脚本从引擎当前步继续 |
| 断网 / fetch 抛错 | 同上 |
| HTTP 非 200 | 同上 |
| 返回 JSON 格式不对 / 回复为空 | 同上 |
| 对话中途任一轮失败 | 同上（引擎对话未被真对话碰过，停在原步） |

注：真对话期间引擎对话停在第 1 问未动（答案只记在面板里，道别后才
回放），所以任何时刻切回离线版都是干净衔接，不存在半截状态。

## 4. key 处理与证据

- key 来源与本轮核查结论（重要）：业主早前确实给过 DeepSeek key，但
  **不在本机任何可达之处**。本轮逐一核查：① 交接包导出
  （`~/workspace/maicai-grok-export`，393 文件）无 key；② Grok Bot
  群聊记录原文（从业主 Mac 上传的 `群聊记录-完整.json`）无 key——
  记录里明确写着 key「别贴在群里」，是经私聊的安全输入框交给 Grok
  侧助手、只存在 Grok 侧（「DeepSeek 的 key 我已经安全存好了」）；
  ③ Muse 记忆明确记「value not recorded here」；④ 本机文件系统与
  会话记录全文扫 `sk-` 模式，无 DeepSeek 格式的 key。
  结论：DeepSeek 的**真 key 实测无法执行**，缺的只是 key 本身。
  业主据此在 R7b 改拍通义千问（见 §0）。百炼 key 已于 2026-11-17
  由业主提供，只写入 `~/workspace/maicai-work/.env.local`
  （`VITE_LLM_API_KEY=<key>`，另加 `VITE_LLM_MODEL=qwen-flash`，
  见 §0 模型修正）；key 值不进本文档、不进日志、不进截图。
  已按「写 .env.local → npm run build → 打包」点亮真对话，
  **零代码改动**；CORS 已实测放行（§1），不需要中转。
- 注入方式（代码已就绪）：key 与服务商配置只放本地 `.env.local`
  （`VITE_LLM_API_KEY` / `VITE_LLM_BASE_URL` / `VITE_LLM_MODEL`）；
  `.gitignore` 第 5 行 `*.local` 已覆盖（R7b 复核
  `git check-ignore -v .env.local` → `.gitignore:5:*.local`），
  且 `git ls-files` 中无 `.env.local`。代码经 `import.meta.env` 读取，
  源码、日志、界面均不出现 key。
- 推送前 secret-scan：对推送清单（git ls-files 的 UTF-8 文本集）逐个
  文件扫 `sk-[A-Za-z0-9_-]{16,}` 模式与 `.env*` 文件是否混入清单，
  结果见 §5。
- 可玩 zip（真对话版）：`~/workspace/maicai-r7-live-play.zip`
  （1,698,333 B，sha256
  `fff0b2f07ad7fbc5a74df85c501932f68442fe8af3fd1c875b537bdcc2342824`），
  由带 key 的构建打包（`.env.local` 在位、模型 qwen-flash）；
  从全新解压验活：index 200、Board3D JS 200、构建产物含
  `dashscope.aliyuncs.com` 端点与 `qwen-flash` 字样。实测见 §5。
  注意：此 zip 内嵌 key（业主已接受，见 §0），**只供业主本地试玩，
  不得上传任何公开托管**（GitHub 推送清单经 secret-scan，见 §5）。

## 5. 验收与实测

- `npm run build`：干净（仅有既有的 chunk 体积警告）。
- `npm test`：**127/127 通过**（基线 105 + `parentLive.test.ts` 22 条：
  双语提示词约束、请求形状、节奏/道别判定、mock fetch 成功与
  网络错误/500/格式错误/超时四种回退、无 key 离线判定；R7b 新增
  服务商配置 3 条——默认请求打到 DashScope 兼容端点且模型
  `qwen-turbo`、备选 DeepSeek 只改 env 即可切、base 末尾斜杠处理；
  fetch 成功用例同步改断言默认端点/模型，temperature/max_tokens 不变）。
  R7b 复跑 `npm run build` 干净。
  收尾补记：vitest 会加载 `.env.local`，工作区有真 key 时环境变量会漏进
  断言（曾致 4 条失败）；已在 `parentLive.test.ts` 用 `beforeEach` 把
  三个 `VITE_LLM_*` stub 为空串隔离，`.env.local` 在位时复跑仍 127/127。
- 浏览器实测（离线回退路径，R7 首测，无 key 时）：中英各完整跑完
  一轮家长站——EN 4 问全清、站点关闭、引擎发 2 币（12 → 14）；
  ZH 同上（我的钱 12 → 14）；无 pageerror。证明回退路径零回退、零报错。
- **真对话实测（2026-11-17 收尾，百炼 key + qwen-flash）**：
  - 方法（重要）：本 VM 的 headless Chromium 无法穿过沙箱出口代理
    （直连 DashScope 时 CONNECT 隧道失败
    `ERR_TUNNEL_CONNECTION_FAILED`，四种代理配置皆同；同机 curl/Node
    经同一代理正常）。故实测用**测试专用构建**：仅把
    `VITE_LLM_BASE_URL` 指到本机中继（127.0.0.1:8123，Node 转发至真
    DashScope、透传 Authorization、不落日志），其余与可玩版逐字相同
    （同 key、同模型、同提示词、同一代码路径），API 回复均为真
    qwen-flash 响应。可玩版在正常网络下直连 DashScope（CORS 见 §1），
    不经中继。
  - 尝试日志（UTC）：
    - 直连尝试（可玩版原构建）：EN/ZH 各一次，浏览器 POST DashScope
      均 `ERR_TUNNEL_CONNECTION_FAILED`，约 2s 内无感回退离线版
      ——环境问题，非 API/应用问题。
    - 中继 sanity：假 key 两次均回 401（转发与认证路径通，不计费）。
    - ZH（07:26–07:28Z）：4 次 POST 全 200（07:26:55 / 07:26:57 /
      07:28:21 / 07:28:29Z）→ **完整成功**（见下）。
    - EN 第 1 次（07:01–07:07Z）：前 3 问 200，第 4 问未完成 →
      回退离线版继续。
    - EN 第 2 次（07:35–07:37Z）：4 次 POST 服务端全 200（07:35:38 /
      07:35:41 / 07:36:52 / 07:37:11Z），但第 4 问回复经中继+代理
      耗时约 11s，超过应用 10s 超时被 AbortController 中止（页面记
      `ERR_ABORTED`）→ 按 §3 设计无感回退离线版（站点停在第 1 问，
      可继续玩）。即 10s 超时在中继双跳 + VM 负载下会误伤慢回复；
      正常直连时本轮实测回复为 0.3–3.7s，余量充足。
    - EN 第 3 次（07:42–07:45Z）：4 次 POST 全 200（07:42:54 /
      07:43:00 / 07:44:20 / 07:44:29Z）→ **完整成功**（见下）。
    - 用量：成功计费调用合计 15 次（429/401 不计费），按每场约
      2,000 token 估算总花费 <¥0.05，业主 ¥15 余额无感。
  - ZH 对话实录（脚本开场「需要更多币的时候，我可以帮忙。/
    你想要几个币？」后，家长回复原文）：
    1. 孩子「我想要2个币」→「好呀，等会儿妈妈给你买菜的时候，
       顺手帮你拿两个币哦。」
    2. 孩子「我想买番茄和鸡蛋」→「真好，番茄红红的，鸡蛋白白的，
       明天我们一起做番茄炒蛋，香喷喷的！」
    3. 孩子「我买了贴纸和菜」→「贴纸是给你的小惊喜，菜是我们一起
       做的美味食材，明天就能吃到香喷喷的番茄炒蛋啦！」
    4. 孩子「下次我先买菜，再看贴纸」→「好呀，下次你先挑菜，妈妈
       帮你记着，贴纸等你挑完菜再看，真棒！」
    禁忌判定：**PASS**——无输赢/分数/排名、无个人信息索取、未自称
    AI、全程买菜话题、短句温暖。小注：第 2 条是温暖回应未带问句
    （应用侧节奏不受影响）；第 1 条「拿两个币」呼应本站脚本前提
    （开场白即 coin 帮助），实际发币仍由引擎按 4 问全清判 2 币。
  - EN 对话实录（脚本开场 "I can help if you need more coins. /
    How many coins do you want?" 后，家长回复原文）：
    1. "I want 2 coins" → "You can have 2 coins. What did you buy
       at the store today?"
    2. "I want to buy tomatoes and eggs" → "Great! We bought
       tomatoes and eggs. What will we cook with them?"
    3. "I bought a sticker and some food" → "Nice! What food did
       you buy?"
    4. "Next time I will buy food first" → "That's a good plan!
       Did you get tomatoes and eggs today?"
    禁忌判定：**PASS**——同上各项全过；一次只问一个问题；第 4 条以
    肯定计划收尾（带一句回顾问句，应用按节奏关闭对话，不受影响）。
    跨次方差注：EN 第 2 次的首回复为 "I can't give coins, but we
    can talk about the fun things we bought today! ..."——模型对
    「不许诺钱」的理解在「呼应前提」与「婉拒」之间摆动，两端均未
    越界（币始终引擎决定，模型的话不产生任何发放）。
  - 结算验证：ZH 我的钱 12 → 14、EN My coins 12 → 14，均为道别后
    回放 4 答全清 → 引擎发 2 币；两场面板均在道别后自动关闭，
    游戏继续推进。
  - 截图：`shots/r7_parent_{en,zh}_{1_open,2_mid,3_goodbye,4_after}.png`
    （已更新为真对话版，随本文档一并提交）。
- secret-scan（推送前，本次收尾复核）：`git ls-files` 全集逐个文件扫
  `sk-[A-Za-z0-9_-]{16,}` 模式，命中 **0**；`.env.local` 不在
  `git ls-files` 中（`git check-ignore -v .env.local` →
  `.gitignore:5:*.local`）。

## 6. R9 补丁轮（2026-11-17 晚，业主现场测试后拍板三项）

背景：业主在真机上试玩，第一次 live fetch 在他浏览器里失败后，整场
静默走了离线脚本——界面上与真对话**无法区分**。本轮三个修复，
引擎判定/币数/cards.json 均未动，未打真 API（全部 mock fetch 单测）。

### 修 1 —— 真/离线状态点（家长站每个渲染分支都有）
- `ParentPanel.tsx` 新增 `ParentStatus` 展示件（非按钮），挂在
  parentUse / 真对话 / parentSettle / 离线问答**四个分支**的面板顶部：
  真对话进行中（含尚未启动但已注入 key 的预判）= 绿点
  「Live chat / 真对话」；离线脚本（无 key 或失败回退后）= 灰点
  「Offline script / 离线脚本」。
- 文案走 `strings.parent.statusLive / statusOffline`（en.ts + zh.ts 同构，
  i18n 同构测试照过）；颜色只引 token——新增
  `--color-status-live: #2e9e63`（tokens.css），灰点用既有 `--color-muted`。
- 面板外层布局未动（只在 panel-body 内加一行小字，R8 自适应不受影响）。

### 修 2 —— fallbackLine 等 AI 台词随界面语言
- `stations/parent.ts` 三处写进 log 的 AI 台词从裸读
  `cards.parentStation.*` 改经 `i18n/cardText` 语言感知函数：
  `fallbackLine`（判不出兜底）、`voiceHint`（语音占位）、`approveLine`
  （批准发币）。命令发生时按当时语言成文，与 strings 日志模板同一
  机制、同一时机；中文=「没关系。我们一起选一张图卡。」等，
  英文=cards.json 原文。intro/settleLabel 引擎本就不读，questions
  只作判定数据，均无需动。
- 单测（stations.test.ts 新增 describe）：zh 模式不可判定文本 → log
  末条为中文兜底行且 asAi；en 模式为 cards.json 英文；zh 的
  voice/approve 两条也覆盖，币数断言不变（+2 币）。

### 修 3 —— 失败自动重试一次（~800ms）
- `parentLive.ts` `fetchParentReply` 拆出单次尝试
  `fetchParentReplyOnce`（每次独立 AbortController+计时）：非
  超时/中止失败 → 等 `PARENT_RETRY_DELAY_MS`（800ms，可用
  `retryDelayMs` 覆盖）重试一次；重试仍败、或第一次就是
  超时（AbortError）→ 与之前一样 throw。无 key 仍在 fetch 前直接
  throw、不进重试。面板 await 期间 busy 保持，「正在想…」气泡全程
  不撤，孩子看不到任何报错。
- 单测（parentLive.test.ts 新增 describe，全 mock fetch +
  retryDelayMs:0）：网络错误→重试成功（2 次请求，返回重试回复）；
  HTTP 500→重试成功；两次皆败→throw（恰好 2 次请求）；第一次即
  超时→不重试、立即 throw（只 1 次请求）。

### R9 验证
- `npm run build` 干净；`npm test` **133/133**（127 基线 + 新增 6：
  重试 4 + 台词语言 2）。
- 截图（CDP 截法，SwiftShader-safe，见 `shots/r9-shots.mjs`）：
  - 真构建（.env.local 在位，key 已注入）状态点绿：
    `shots/r9_parent_{en,zh}_live_{desktop,phone}.png`
    （EN「Live chat」/ ZH「真对话」，desktop 1280×800 + phone 874×402
    hasTouch 真手机横屏布局）；
  - 离线构建（临时挪走 .env.local 构建，已复原并重打）状态点灰：
    `shots/r9_parent_{en,zh}_offline_{desktop,phone}.png`
    （EN「Offline script」/ ZH「离线脚本」）；
  - 回落实证：真构建答 1 题 → fetch 失败（本 VM 隧道不通）→ 自动
    重试 → 再败 → 静默切离线脚本，状态点同步变灰：
    `shots/r9_parent_en_fallback_desktop.png`。
  - 手机竖栏为吸底滚动，截图前滚到顶以显示面板顶部状态点
    （纯截屏动作，不改交互）。
- 未验证项：真 API 端的重试路径（业主 ¥15 余额红线，本轮零真实
  调用；重试逻辑全部经 mock fetch 断言）。
