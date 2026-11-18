/**
 * parentLive.test.ts —— R7 AI 家长站真对话（src/parent/parentLive.ts）。
 * 全部用 mock fetch，不打真接口、不需要真 key：
 * - 系统提示词按语言选用且业主定的约束一条不少；
 * - 请求形状（model / temperature / max_tokens / messages 结构）；
 * - 节奏：未满 4 问继续提问，满 4 问（或触上限）道别 → isGoodbyeTurn；
 * - 任一失败（网络错误 / 非 200 / 格式不对 / 超时）都抛错，面板据此回退离线版；
 * - R9：非超时失败自动重试一次（retryDelayMs 传 0 免等待），超时/中止不重试；
 * - 无 key 配置时 parentLiveAvailable() = false（本站走离线版）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_PARENT_MODEL,
  PARENT_CHILD_TURN_CAP,
  PARENT_MAX_ROUNDS,
  PARENT_MAX_TOKENS,
  PARENT_QUESTION_COUNT,
  PARENT_SYSTEM_PROMPT_EN,
  PARENT_SYSTEM_PROMPT_ZH,
  PARENT_TEMPERATURE,
  buildParentMessages,
  buildParentRequestBody,
  fetchParentReply,
  getParentApiKey,
  getParentBaseUrl,
  getParentChatUrl,
  getParentModel,
  getParentProxyUrl,
  isGoodbyeTurn,
  parentLiveAvailable,
  parentSystemPrompt,
  sanitizeParentReply,
} from '../../src/parent/parentLive';
import type { ParentTurn } from '../../src/parent/parentLive';

const history: ParentTurn[] = [
  { role: 'assistant', content: 'I can help if you need more coins.' },
  { role: 'user', content: 'I want 2 coins.' },
];

function okResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response;
}

beforeEach(() => {
  // 屏蔽开发者本地 .env.local 的 VITE_LLM_* 注入（vitest 会加载 .env.local）：
  // 先把三个变量 stub 成空（= 未配置），各用例再按需 stubEnv 具体值。
  vi.stubEnv('VITE_LLM_API_KEY', '');
  vi.stubEnv('VITE_LLM_BASE_URL', '');
  vi.stubEnv('VITE_LLM_MODEL', '');
  vi.stubEnv('VITE_LLM_PROXY_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('系统提示词（业主定稿，约束一条不少）', () => {
  it('按语言选用', () => {
    expect(parentSystemPrompt('en')).toBe(PARENT_SYSTEM_PROMPT_EN);
    expect(parentSystemPrompt('zh')).toBe(PARENT_SYSTEM_PROMPT_ZH);
  });

  it('英文版含全部禁忌与要求', () => {
    const p = PARENT_SYSTEM_PROMPT_EN;
    expect(p).toContain('Never talk about winning, losing, scores or rankings');
    expect(p).toContain('Never offer money, gifts or prizes');
    expect(p).toContain('never ask for personal information');
    expect(p).toContain('Do not say you are an AI');
    expect(p).toContain('one question at a time');
    expect(p).toContain('about 4 questions in total');
    expect(p).toContain('shopping trip');
  });

  it('中文版含全部禁忌与要求', () => {
    const p = PARENT_SYSTEM_PROMPT_ZH;
    expect(p).toContain('绝不提输赢、分数、排名');
    expect(p).toContain('绝不许诺给钱、礼物或奖励');
    expect(p).toContain('绝不索取任何个人信息');
    expect(p).toContain('不要说自己是 AI');
    expect(p).toContain('一次只问一个问题');
    expect(p).toContain('买菜');
  });
});

describe('请求形状', () => {
  it('model / temperature / max_tokens 按业主参数（默认 qwen-turbo）', () => {
    const body = buildParentRequestBody('en', history, 1);
    expect(body.model).toBe('qwen-turbo');
    expect(body.model).toBe(DEFAULT_PARENT_MODEL);
    expect(body.model).toBe(getParentModel());
    expect(body.temperature).toBe(0.7);
    expect(body.temperature).toBe(PARENT_TEMPERATURE);
    expect(body.max_tokens).toBe(150);
    expect(body.max_tokens).toBe(PARENT_MAX_TOKENS);
  });

  it('messages[0] 是当前语言的系统提示词，且系统提示不进 user/assistant', () => {
    const msgs = buildParentMessages('zh', history, 1);
    expect(msgs[0]).toEqual({ role: 'system', content: PARENT_SYSTEM_PROMPT_ZH });
    const nonSystem = msgs.filter((m) => m.role !== 'system');
    expect(nonSystem).toEqual(history);
    for (const m of nonSystem) {
      expect(m.content).not.toContain('系统提示');
      expect(m.content).not.toBe(PARENT_SYSTEM_PROMPT_ZH);
    }
  });

  it('节奏：未满 4 问 → 继续提问的 system 提示', () => {
    const msgs = buildParentMessages('en', history, 2);
    expect(msgs[1].role).toBe('system');
    expect(msgs[1].content).toContain('ask exactly one new question');
  });

  it('节奏：满 4 问 → 道别 system 提示，不再提问', () => {
    const msgs = buildParentMessages('en', history, PARENT_QUESTION_COUNT);
    expect(msgs[1].content).toContain('do not ask another question');
    expect(msgs[1].content.toLowerCase()).toContain('goodbye');
    const msgsZh = buildParentMessages('zh', history, PARENT_QUESTION_COUNT);
    expect(msgsZh[1].content).toContain('不要再提问');
    expect(msgsZh[1].content).toContain('道别');
  });
});

describe('轮次上限（孩子发言上限 → 结束对话）', () => {
  it('isGoodbyeTurn：<4 继续，>=4 或 >=上限 道别', () => {
    expect(isGoodbyeTurn(0)).toBe(false);
    expect(isGoodbyeTurn(3)).toBe(false);
    expect(isGoodbyeTurn(4)).toBe(true);
    expect(isGoodbyeTurn(PARENT_CHILD_TURN_CAP)).toBe(true);
    expect(PARENT_CHILD_TURN_CAP).toBe(5);
  });

  it('20 轮会话硬顶（业主 2026-11-18）：常量为 20，到顶必道别', () => {
    expect(PARENT_MAX_ROUNDS).toBe(20);
    expect(isGoodbyeTurn(PARENT_MAX_ROUNDS)).toBe(true);
    expect(isGoodbyeTurn(PARENT_MAX_ROUNDS + 5)).toBe(true);
  });

  it('超过 20 轮：fetchParentReply 直接拒绝，不发请求（面板据此回退离线收尾）', async () => {
    const fetchFn = vi.fn();
    await expect(
      fetchParentReply({
        history,
        childTurns: PARENT_MAX_ROUNDS + 1,
        apiKey: 'test-key-not-real',
        fetchFn: fetchFn as unknown as typeof fetch,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow('round limit');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('话题锁死（业主 2026-11-18）：双语系统提示词都明示其他话题不答、只拉回买菜', () => {
    expect(PARENT_SYSTEM_PROMPT_EN).toContain('Topic lock');
    expect(PARENT_SYSTEM_PROMPT_EN.toLowerCase()).toContain('homework');
    expect(PARENT_SYSTEM_PROMPT_ZH).toContain('话题锁死');
    expect(PARENT_SYSTEM_PROMPT_ZH).toContain('作业');
  });
});

describe('服务商配置（VITE_LLM_*，切换只改 .env.local、不改代码）', () => {
  it('默认：DashScope 兼容端点 + qwen-turbo', () => {
    expect(getParentBaseUrl()).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
    expect(getParentBaseUrl()).toBe(DEFAULT_LLM_BASE_URL);
    expect(getParentChatUrl()).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    );
    expect(getParentModel()).toBe('qwen-turbo');
    expect(getParentModel()).toBe(DEFAULT_PARENT_MODEL);
  });

  it('备选 DeepSeek：只改环境变量即可切过去，请求形状不变', () => {
    vi.stubEnv('VITE_LLM_BASE_URL', 'https://api.deepseek.com');
    vi.stubEnv('VITE_LLM_MODEL', 'deepseek-chat');
    expect(getParentChatUrl()).toBe('https://api.deepseek.com/chat/completions');
    expect(getParentModel()).toBe('deepseek-chat');
    const body = buildParentRequestBody('en', history, 1);
    expect(body.model).toBe('deepseek-chat');
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(150);
  });

  it('base 末尾多余斜杠会被去掉', () => {
    vi.stubEnv('VITE_LLM_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1/');
    expect(getParentChatUrl()).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    );
  });
});

describe('代理模式（公开网页版：无 key 走自家代理，业主 2026-11-19）', () => {
  it('配了代理：无 key 也判定真对话可用', () => {
    vi.stubEnv('VITE_LLM_PROXY_URL', 'https://proxy.example.com/parent-chat/');
    expect(getParentProxyUrl()).toBe('https://proxy.example.com/parent-chat');
    expect(getParentApiKey()).toBeUndefined();
    expect(parentLiveAvailable()).toBe(true);
  });

  it('未配代理且无 key：不可用（走离线版）', () => {
    expect(getParentProxyUrl()).toBeUndefined();
    expect(parentLiveAvailable()).toBe(false);
  });

  it('代理模式发请求：打到代理地址、不带 Authorization、请求体形状不变', async () => {
    vi.stubEnv('VITE_LLM_PROXY_URL', 'https://proxy.example.com/parent-chat');
    const fetchFn = vi.fn(async () => okResponse('That sounds yummy!'));
    const reply = await fetchParentReply({
      lang: 'en',
      history,
      childTurns: 1,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(reply).toBe('That sounds yummy!');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://proxy.example.com/parent-chat');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    const body = JSON.parse(init.body as string);
    expect(body.messages[0].content).toBe(PARENT_SYSTEM_PROMPT_EN);
  });
});

describe('fetchParentReply（mock fetch）', () => {
  it('成功：打到默认端点（DashScope 兼容模式），带 Bearer key，返回清洗后的回复', async () => {
    const fetchFn = vi.fn(async () => okResponse('  "That sounds yummy!"  '));
    const reply = await fetchParentReply({
      lang: 'en',
      history,
      childTurns: 1,
      apiKey: 'test-key-not-real',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(reply).toBe('That sounds yummy!');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(getParentChatUrl());
    expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key-not-real');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('qwen-turbo');
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(150);
    expect(body.messages[0].content).toBe(PARENT_SYSTEM_PROMPT_EN);
  });

  it('中文：messages[0] 用中文系统提示词', async () => {
    const fetchFn = vi.fn(async () => okResponse('真乖，妈妈很开心。'));
    await fetchParentReply({
      lang: 'zh',
      history,
      childTurns: 1,
      apiKey: 'test-key-not-real',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const body = JSON.parse(
      (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.messages[0].content).toBe(PARENT_SYSTEM_PROMPT_ZH);
  });

  it('失败回退：网络抛错 → throw（面板切离线版）', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network down');
    });
    await expect(
      fetchParentReply({
        lang: 'en',
        history,
        childTurns: 1,
        apiKey: 'test-key-not-real',
        fetchFn: fetchFn as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
  });

  it('失败回退：HTTP 500 → throw', async () => {
    const fetchFn = vi.fn(
      async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response,
    );
    await expect(
      fetchParentReply({
        lang: 'en',
        history,
        childTurns: 1,
        apiKey: 'test-key-not-real',
        fetchFn: fetchFn as unknown as typeof fetch,
      }),
    ).rejects.toThrow('500');
  });

  it('失败回退：返回格式不对（无 choices） → throw', async () => {
    const fetchFn = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => ({ nope: 1 }) }) as Response,
    );
    await expect(
      fetchParentReply({
        lang: 'en',
        history,
        childTurns: 1,
        apiKey: 'test-key-not-real',
        fetchFn: fetchFn as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
  });

  it('失败回退：超时（AbortController 中止） → throw', async () => {
    const fetchFn = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    await expect(
      fetchParentReply({
        lang: 'en',
        history,
        childTurns: 1,
        apiKey: 'test-key-not-real',
        fetchFn: fetchFn as unknown as typeof fetch,
        timeoutMs: 20,
      }),
    ).rejects.toThrow();
  });

  it('无 key：直接 throw，且不发出请求', async () => {
    const fetchFn = vi.fn(async () => okResponse('hi'));
    await expect(
      fetchParentReply({
        lang: 'en',
        history,
        childTurns: 1,
        apiKey: '',
        fetchFn: fetchFn as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('R9 自动重试（非超时失败重试一次 ~800ms，超时/中止不重试）', () => {
  it('网络错误后重试成功 → 返回重试的回复，会话继续（共 2 次请求）', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(okResponse('second try works'));
    const reply = await fetchParentReply({
      lang: 'en',
      history,
      childTurns: 1,
      apiKey: 'test-key-not-real',
      fetchFn: fetchFn as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    expect(reply).toBe('second try works');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('HTTP 500 后重试成功 → 返回重试的回复（HTTP 错误同样进重试）', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce(okResponse('recovered'));
    const reply = await fetchParentReply({
      lang: 'en',
      history,
      childTurns: 1,
      apiKey: 'test-key-not-real',
      fetchFn: fetchFn as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    expect(reply).toBe('recovered');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('两次都失败 → throw 回退离线版（共 2 次请求，无第三次）', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network down');
    });
    await expect(
      fetchParentReply({
        lang: 'en',
        history,
        childTurns: 1,
        apiKey: 'test-key-not-real',
        fetchFn: fetchFn as unknown as typeof fetch,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow('network down');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('第一次就是超时/中止 → 不 retry，立即 throw（只 1 次请求）', async () => {
    const fetchFn = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    await expect(
      fetchParentReply({
        lang: 'en',
        history,
        childTurns: 1,
        apiKey: 'test-key-not-real',
        fetchFn: fetchFn as unknown as typeof fetch,
        timeoutMs: 20,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('key 配置', () => {
  it('未注入 key → 离线模式（显式 stub 空值，不依赖本地 .env.local）', () => {
    vi.stubEnv('VITE_LLM_API_KEY', '');
    expect(getParentApiKey()).toBeUndefined();
    expect(parentLiveAvailable()).toBe(false);
  });

  it('注入 key 后 → 可用（stubEnv，不用真 key）', () => {
    vi.stubEnv('VITE_LLM_API_KEY', 'stubbed-test-key');
    expect(getParentApiKey()).toBe('stubbed-test-key');
    expect(parentLiveAvailable()).toBe(true);
  });
});

describe('sanitizeParentReply', () => {
  it('去空白与包裹引号', () => {
    expect(sanitizeParentReply('  “真乖。”  ')).toBe('真乖。');
    expect(sanitizeParentReply('"Hello!"')).toBe('Hello!');
  });
  it('空回复视为失败', () => {
    expect(() => sanitizeParentReply('   ')).toThrow();
  });
});
