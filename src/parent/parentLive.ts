/**
 * parentLive.ts —— R7：AI 家长站（第 6 站）真对话，浏览器直连 LLM 服务商。
 *
 * 业主决定（2026-11-17，主聊天原话「用api 不怕被人搞 你里面写好提示词」）：
 * 明确接受 key 放在客户端的风险，浏览器直连 chat completions，
 * 不加中转。此决定**覆盖**仓库 AGENTS.md 的「不要引入…真实 AI/LLM 调用」
 * 与 docs/AI_PARENT_PROMPT.md（导出文档）的「浏览器里不能出现 API key」
 * 两条旧规——是业主本人亲自下令，不是实现者擅自放宽。
 *
 * 服务商（2026-11-17 业主后续拍板）：默认通义千问（阿里云百炼 DashScope
 * OpenAI 兼容模式，qwen-turbo 最便宜且 CORS 已实测放行）；DeepSeek 为备选。
 * 服务商经 Vite 环境变量 VITE_LLM_BASE_URL / VITE_LLM_MODEL 配置，
 * 切换只改 .env.local、不改代码（见 PARENT_API_R7.md）。
 *
 * key 红线：只许经 Vite 环境变量 VITE_LLM_API_KEY 注入（本地
 * gitignored 的 .env.local，见 .gitignore 的 `*.local`），**绝不进源码、
 * 绝不进 GitHub**。没有 key 时本站自动走离线脚本版，行为与 R6/R8 完全一致。
 *
 * 死规则（与离线版相同）：
 * - 发币永远由引擎决定：本模块只产出「家长说的话」，不碰任何命令；
 *   面板把孩子在真对话里给出的答案原样回放给引擎（PARENT_ANSWER），
 *   由引擎按图卡 tags / 打字 keywords 判定说清与否、发几币（见
 *   src/game/stations/parent.ts），LLM 无权影响币数。
 * - 系统提示词只进 API 请求，永不出现在聊天气泡里。
 * - 任一失败（无 key / 超时 / 断网 / 非 200 / 返回格式不对）都抛错，
 *   面板捕获后无缝切回离线脚本流程，孩子端不报错、不卡住。
 *   R9：超时/中止以外的失败先自动重试一次（~800ms 后再发一次），
 *   重试也失败才真正抛错回退——瞬断不再秒杀整场真对话。
 */
import { getLang } from '../i18n/store';
import type { Lang } from '../i18n/store';

export interface ParentChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 孩子/家长的一轮对话（不含 system） */
export interface ParentTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** 服务商默认值：通义千问（阿里云百炼 DashScope OpenAI 兼容模式）。
 *  备选 DeepSeek：.env.local 里设 VITE_LLM_BASE_URL=https://api.deepseek.com、
 *  VITE_LLM_MODEL=deepseek-chat 即可，无需改代码。 */
export const DEFAULT_LLM_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
export const DEFAULT_PARENT_MODEL = 'qwen-turbo';

function envTrimmed(
  name: 'VITE_LLM_API_KEY' | 'VITE_LLM_BASE_URL' | 'VITE_LLM_MODEL',
): string | undefined {
  const raw = import.meta.env[name] as string | undefined;
  const v = raw?.trim();
  return v ? v : undefined;
}

/** API 基地址（构建时由 .env.local 的 VITE_LLM_BASE_URL 注入，缺省用默认值） */
export function getParentBaseUrl(): string {
  return (envTrimmed('VITE_LLM_BASE_URL') ?? DEFAULT_LLM_BASE_URL).replace(/\/+$/, '');
}

/** 完整的 chat completions 端点：`${base}/chat/completions` */
export function getParentChatUrl(): string {
  return `${getParentBaseUrl()}/chat/completions`;
}

/** 模型名（构建时由 .env.local 的 VITE_LLM_MODEL 注入，缺省 qwen-turbo） */
export function getParentModel(): string {
  return envTrimmed('VITE_LLM_MODEL') ?? DEFAULT_PARENT_MODEL;
}
export const PARENT_TEMPERATURE = 0.7;
export const PARENT_MAX_TOKENS = 150;
/** 单次请求超时（业主定 ~10s）：超时即回退离线版，演示永不卡死 */
export const PARENT_TIMEOUT_MS = 10_000;
/** R9：非超时失败自动重试一次前的等待（业主定 ~800ms） */
export const PARENT_RETRY_DELAY_MS = 800;
/** 孩子发言轮次上限（业主定 5） */
export const PARENT_CHILD_TURN_CAP = 5;
/** 一场对话约 4 个问题（与离线脚本的 4 问对齐） */
export const PARENT_QUESTION_COUNT = 4;
/** 家长单条回复的本地长度上限（防御异常输出；提示词本身要求短句） */
export const PARENT_REPLY_MAX_CHARS = 300;

/* —— 系统提示词（业主在主聊天定稿，中英各一份，按语言开关选用；
      措辞可微调，约束一条不能少：只聊买菜、一次一问、约 4 问后道别、
      不提输赢分数、不许诺钱/礼物、不索取个人信息、跑题拉回、不说自己是 AI） —— */
export const PARENT_SYSTEM_PROMPT_EN =
  "You are the child's parent, calling from far away where you work. Be warm and encouraging, and use very short, simple sentences a 6-9 year old can understand. Talk only about today's shopping trip: what they bought, what they plan to cook, and how they feel. Ask one question at a time, about 4 questions in total, then say a warm goodbye. Never talk about winning, losing, scores or rankings. Never offer money, gifts or prizes, and never ask for personal information (school, address, phone number). If the child goes off topic, gently bring the talk back to the shopping trip. Do not say you are an AI.";

export const PARENT_SYSTEM_PROMPT_ZH =
  '你是在外地打工的爸爸妈妈，正在给孩子打电话。语气要温暖、鼓励，用很短、很简单的句子，让 6 到 9 岁的孩子能听懂。只聊今天去买菜的事：买了什么、打算做什么菜、心情怎么样。一次只问一个问题，一共问大约 4 个问题，然后温柔地道别。绝不提输赢、分数、排名；绝不许诺给钱、礼物或奖励；绝不索取任何个人信息（学校、地址、电话）。孩子说到别的话题，就温和地把话题带回买菜。不要说自己是 AI。';

export function parentSystemPrompt(lang: Lang): string {
  return lang === 'zh' ? PARENT_SYSTEM_PROMPT_ZH : PARENT_SYSTEM_PROMPT_EN;
}

/** 节奏提示（第二条 system，同样永不进气泡）：把「约 4 问 + 道别」钉死，
 *  不靠模型自觉。第 childTurns 次回答之后：未满 4 问→再问一个；满 4 问→道别。 */
function pacingPrompt(lang: Lang, childTurns: number): string {
  if (isGoodbyeTurn(childTurns)) {
    return lang === 'zh'
      ? '这是最后一句：不要再提问。温柔地跟孩子道别，告诉他你为他感到骄傲。只说一两句短句。'
      : 'This is your last message: do not ask another question. Say a warm goodbye and tell the child you are proud of them. One or two short sentences only.';
  }
  return lang === 'zh'
    ? `孩子已经回答了 ${childTurns} 个问题，一共大约 4 个问题。先温暖地回应孩子刚才说的话，然后只问一个新问题，还是聊今天买菜的事。只说一两句短句。`
    : `The child has answered ${childTurns} of about 4 questions. First reply warmly to what the child just said, then ask exactly one new question about today's shopping trip. One or two short sentences only.`;
}

/** 这一轮回复是否应当是道别（已答满约 4 问，或触到孩子发言上限） */
export function isGoodbyeTurn(childTurns: number): boolean {
  return childTurns >= PARENT_QUESTION_COUNT || childTurns >= PARENT_CHILD_TURN_CAP;
}

/** 读取注入的 key（构建时由 .env.local 的 VITE_LLM_API_KEY 注入；
 *  未配置 → undefined，本站走离线版）。绝不把 key 写进任何日志/界面。 */
export function getParentApiKey(): string | undefined {
  return envTrimmed('VITE_LLM_API_KEY');
}

export function parentLiveAvailable(): boolean {
  return getParentApiKey() !== undefined;
}

/** 组装发给 LLM 的 messages：[业主系统提示, 节奏 system, ...对话历史] */
export function buildParentMessages(
  lang: Lang,
  history: ParentTurn[],
  childTurns: number,
): ParentChatMessage[] {
  return [
    { role: 'system', content: parentSystemPrompt(lang) },
    { role: 'system', content: pacingPrompt(lang, childTurns) },
    ...history.map((t) => ({ role: t.role, content: t.content })),
  ];
}

export interface ParentRequestBody {
  model: string;
  messages: ParentChatMessage[];
  temperature: number;
  max_tokens: number;
}

export function buildParentRequestBody(
  lang: Lang,
  history: ParentTurn[],
  childTurns: number,
): ParentRequestBody {
  return {
    model: getParentModel(),
    messages: buildParentMessages(lang, history, childTurns),
    temperature: PARENT_TEMPERATURE,
    max_tokens: PARENT_MAX_TOKENS,
  };
}

/** 清洗模型回复：去空白与包裹引号、截到本地上限；空 → 视为失败 */
export function sanitizeParentReply(raw: string): string {
  let t = raw.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('“') && t.endsWith('”')))) {
    t = t.slice(1, -1).trim();
  }
  if (t.length > PARENT_REPLY_MAX_CHARS) t = t.slice(0, PARENT_REPLY_MAX_CHARS);
  if (!t) throw new Error('parent-live: empty reply');
  return t;
}

export interface FetchParentReplyArgs {
  lang?: Lang;
  history: ParentTurn[];
  /** 孩子已回答的轮次（含刚答的这一轮），决定节奏/道别 */
  childTurns: number;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** 失败重试前的等待毫秒（默认 PARENT_RETRY_DELAY_MS；单测可传 0） */
  retryDelayMs?: number;
}

/** 中止/超时判定：fetch 被 AbortController 掐断时以 err.name === 'AbortError' 拒绝 */
function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 单次尝试：自带独立 AbortController + 计时器；成功 → 清洗后文本，失败 → throw */
async function fetchParentReplyOnce(
  key: string,
  args: FetchParentReplyArgs,
): Promise<string> {
  const lang = args.lang ?? getLang();
  const fetchFn = args.fetchFn ?? fetch;
  const timeoutMs = args.timeoutMs ?? PARENT_TIMEOUT_MS;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(getParentChatUrl(), {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(buildParentRequestBody(lang, args.history, args.childTurns)),
    });
    if (!res.ok) throw new Error(`parent-live: http ${res.status}`);
    const data: unknown = await res.json();
    const content = (
      data as { choices?: { message?: { content?: unknown } }[] } | null
    )?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('parent-live: malformed response');
    return sanitizeParentReply(content);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 向 LLM 服务商要一句家长回复。成功 → 返回清洗后的文本；
 * 任何失败（无 key、超时、非 200、格式不对、空回复）都 throw，
 * 调用方（面板）捕获后切回离线脚本流程。
 * R9：超时/中止以外的失败先等 ~800ms 自动重试一次（期间面板仍显示
 * 「正在想…」，孩子无感）；重试也失败、或第一次就是超时，才 throw 回退。
 */
export async function fetchParentReply(args: FetchParentReplyArgs): Promise<string> {
  const key = args.apiKey ?? getParentApiKey();
  if (!key) throw new Error('parent-live: no api key configured');
  try {
    return await fetchParentReplyOnce(key, args);
  } catch (err) {
    if (isAbortError(err)) throw err;
    await wait(args.retryDelayMs ?? PARENT_RETRY_DELAY_MS);
    return fetchParentReplyOnce(key, args);
  }
}
