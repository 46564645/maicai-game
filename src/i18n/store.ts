/**
 * store.ts —— R6 中英文切换的语言状态（模块级单例 + localStorage 持久化）。
 *
 * - 默认英文（现行设计，ww 定名）；用户切换后写入 localStorage
 *   （key `maicai-lang`），下次打开沿用。
 * - React 侧用 useLang()（useSyncExternalStore）订阅：App 根订阅一次，
 *   语言变化时整棵树重渲染，所有经 data/strings 代理与 i18n/cardText
 *   解析器读到的文案立即换语言，不刷新页面、不动游戏状态。
 * - 非浏览器环境（单测 node 环境）无 localStorage 时安全降级为内存值。
 */
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'zh';

export const LANG_STORAGE_KEY = 'maicai-lang';

function readInitialLang(): Lang {
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return v === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

let current: Lang = readInitialLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* 隐私模式等场景写不进也无妨，本次会话内有效 */
  }
  for (const fn of [...listeners]) fn();
}

export function toggleLang(): void {
  setLang(current === 'en' ? 'zh' : 'en');
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** React 订阅：语言变化时返回新值触发重渲染 */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}
