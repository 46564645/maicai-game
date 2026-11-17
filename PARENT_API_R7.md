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
  业主据此在 R7b 改拍通义千问（见 §0），将另行提供百炼 API key。
  点亮真对话只需一步：把百炼 key 写进 `~/workspace/maicai-work/.env.local`
  （`VITE_LLM_API_KEY=<key>`）后 `npm run build` 重新打包即可，
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
- 可玩 zip：本轮 zip 由无 key 的构建打包（原因见上），家长站为离线版；
  按上法注入 key 重构建后重打包即为真对话版。zip 校验见 §5。
  R7b 未重打 zip（尚无 key）；百炼 key 到位后按上法重构建、重打包。

## 5. 验收与实测

- `npm run build`：干净（仅有既有的 chunk 体积警告）。
- `npm test`：**127/127 通过**（基线 105 + `parentLive.test.ts` 22 条：
  双语提示词约束、请求形状、节奏/道别判定、mock fetch 成功与
  网络错误/500/格式错误/超时四种回退、无 key 离线判定；R7b 新增
  服务商配置 3 条——默认请求打到 DashScope 兼容端点且模型
  `qwen-turbo`、备选 DeepSeek 只改 env 即可切、base 末尾斜杠处理；
  fetch 成功用例同步改断言默认端点/模型，temperature/max_tokens 不变）。
  R7b 复跑 `npm run build` 干净。
- 浏览器实测（`shots/r7-live-test.mjs`，vite preview + CDP 截图）：
  因无 key（§4），实测走的是**回退路径**——这正是演示保底路径，
  中英各完整跑完一轮家长站：
  - EN：4 问全说清（中途「就这样吧」选「继续回答」），站点正常关闭，
    引擎发 2 币（My coins 12 → 14），无 pageerror。
  - ZH：同上（你想要几个币？… 4 问全清），引擎发 2 币（我的钱 12 → 14）。
  - 截图：`shots/r7_parent_{en,zh}_{1_open,2_mid,3_goodbye,4_after}.png`。
  - 结论：R7 改动对离线路径零回退、零报错；真对话路径已由单测
    （mock fetch）覆盖请求/回退/道别逻辑，只差真 key 的临门一测。
  - R7b 仅换服务商配置、行为不变，未重跑浏览器实测；真 key 实测
    仍待百炼 key 到位。
- secret-scan（推送前）：见随附提交记录；清单内 `sk-` 模式命中 0，
  `.env.local` 不在 `git ls-files` 中。
