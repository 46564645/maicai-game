'use strict';
/**
 * fc-index.cjs —— 《一起去买菜》家长站 AI 对话中转代理
 * 部署：阿里云函数计算 FC，事件函数 + HTTP 触发器（匿名可访问），
 * 运行时 Node.js 18（用全局 fetch，无第三方依赖，整文件粘贴即可）。
 *
 * 为什么需要它（业主 2026-11-19 拍板）：网页版要让家长站用真 AI 对话，
 * 但百炼 API key 绝不能进网页前端（发到浏览器的一切都等于公开）。
 * 本代理把 key 只存在函数计算的环境变量里：浏览器 → 本函数（加 key
 * 转发）→ 百炼 DashScope。key 从不下发。
 *
 * 环境变量：
 * - DASHSCOPE_API_KEY（必填）百炼 key，只配在这里，绝不进代码/仓库。
 * - LLM_MODEL（可选，默认 qwen-flash；qwen-turbo 在业主工作空间
 *   曾持续 429，不要改回 turbo）
 * - ALLOWED_ORIGINS（可选，逗号分隔；默认含 Pages 域名与本地调试）
 *
 * 代理层防滥用（与游戏端守卫叠加，纵深防御）：
 * - 只接受白名单 Origin 的请求（游戏网页 / 本地调试），其余 403；
 * - 只转发对话补全形状的请求：messages 必须是数组，且强制覆盖
 *   model 与 max_tokens（≤150），客户端传什么都以这里为准；
 * - 轮次硬顶：一条请求里 user 消息超过 20 条直接 400 拒绝
 *   （业主定：AI 最多对话 20 轮；游戏端另有同口径守卫）；
 * - 限流：单 IP 每小时 60 次（内存计数，实例级；课堂/评审规模足够，
 *   真被刷爆还有百炼账户余额与消费告警兜底）；
 * - 客户端发来的任何 Authorization 一律丢弃，换成环境变量里的 key。
 */

const UPSTREAM =
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const MODEL = process.env.LLM_MODEL || 'qwen-flash';
const MAX_USER_TURNS = 20;
const MAX_TOKENS_CAP = 150;
const UPSTREAM_TIMEOUT_MS = 15000;

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'https://46564645.github.io,http://localhost:8000,http://localhost:4173,http://localhost:5173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/* —— 限流：单 IP 滑动窗口（内存版，函数实例内有效） —— */
const RL_WINDOW_MS = 60 * 60 * 1000;
const RL_MAX = 60;
const ipHits = new Map();
function rateLimited(ip, now) {
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  ipHits.set(ip, arr);
  if (ipHits.size > 5000) ipHits.clear(); // 防内存无限增长（粗暴但够用）
  return arr.length > RL_MAX;
}

function header(headers, name) {
  if (!headers) return undefined;
  const want = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === want) return headers[k];
  }
  return undefined;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reply(callback, statusCode, origin, obj) {
  callback(null, {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...(origin ? corsHeaders(origin) : {}) },
    body: typeof obj === 'string' ? obj : JSON.stringify(obj),
  });
}

exports.handler = async (event, context, callback) => {
  let evt = event;
  try {
    if (Buffer.isBuffer(evt)) evt = JSON.parse(evt.toString());
    else if (typeof evt === 'string') evt = JSON.parse(evt);
  } catch {
    evt = {};
  }
  const headersIn = evt.headers || {};
  const origin = header(headersIn, 'origin') || '';
  const method = (evt.httpMethod || evt.requestContext?.http?.method || 'POST').toUpperCase();

  // CORS 预检
  if (method === 'OPTIONS') {
    if (!ALLOWED_ORIGINS.includes(origin)) return reply(callback, 403, null, { error: 'origin not allowed' });
    return reply(callback, 204, origin, '');
  }
  if (method !== 'POST') return reply(callback, 405, null, { error: 'POST only' });
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return reply(callback, 403, null, { error: 'origin not allowed' });
  }

  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) return reply(callback, 500, origin, { error: 'proxy not configured' });

  // 限流（IP 取转发头第一跳，取不到就归 unknown 一桶）
  const ip =
    (header(headersIn, 'x-forwarded-for') || '').split(',')[0].trim() ||
    header(headersIn, 'x-real-ip') ||
    'unknown';
  if (rateLimited(ip, Date.now())) {
    return reply(callback, 429, origin, { error: 'rate limited, try later' });
  }

  // 解析请求体（FC 的 body 可能是 base64）
  let raw = evt.body || '';
  if (evt.isBase64Encoded && raw) raw = Buffer.from(raw, 'base64').toString('utf8');
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(callback, 400, origin, { error: 'invalid json' });
  }
  const messages = body && body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return reply(callback, 400, origin, { error: 'messages required' });
  }
  // 轮次硬顶：user 消息数 > 20 直接拒绝（不转发，不产生费用）
  const userTurns = messages.filter((m) => m && m.role === 'user').length;
  if (userTurns > MAX_USER_TURNS) {
    return reply(callback, 400, origin, { error: 'round limit exceeded' });
  }

  // 只转发白名单字段，model / max_tokens 以代理为准
  const upstreamBody = {
    model: MODEL,
    messages,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
    max_tokens: Math.min(
      typeof body.max_tokens === 'number' ? body.max_tokens : MAX_TOKENS_CAP,
      MAX_TOKENS_CAP,
    ),
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(UPSTREAM, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(upstreamBody),
    });
    const text = await res.text();
    return reply(callback, res.status, origin, text);
  } catch (e) {
    return reply(callback, 502, origin, { error: 'upstream failed' });
  } finally {
    clearTimeout(timer);
  }
};
