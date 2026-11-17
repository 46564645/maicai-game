/**
 * strings.ts —— 界面文案入口（R6：中英双语，语言感知代理）。
 *
 * 字典本体在 src/i18n/en.ts（英，ww 定名，与 R5 及之前逐字一致）与
 * src/i18n/zh.ts（中，来源见 I18N_R6.md）；本文件保持既有导出形状
 * （`strings` 深层对象 + `coinWord`），全部 ~40 个引用方（含 src/game
 * 引擎写日志模板）零改动：每次属性读取都按 i18n/store 的当前语言
 * 解析，切换语言后下一次渲染即生效。默认英文；选择存 localStorage。
 *
 * 「币」：英文模板写 "{n} coins"，fmt（stations/shared.ts）会把
 * "1 coins" 改成 "1 coin"；中文无单复数，coinWord 恒为「币」。
 */
import { enStrings } from '../i18n/en';
import { zhStrings } from '../i18n/zh';
import { getLang } from '../i18n/store';

export type { StringsDict } from '../i18n/types';

function activeDict(): typeof enStrings {
  return getLang() === 'zh' ? (zhStrings as unknown as typeof enStrings) : enStrings;
}

function resolvePath(path: readonly string[]): unknown {
  let v: unknown = activeDict();
  for (const k of path) {
    if (v === null || typeof v !== 'object') return undefined;
    v = (v as Record<string, unknown>)[k];
  }
  return v;
}

/**
 * 深层代理：子对象/数组也返回代理，属性读取永远走当前语言字典。
 * 函数值（数组 map 等）绑定到当前字典的真实对象上执行，元素读回的
 * 是当次语言的真实值；语言切换后组件重渲染会重新经代理读取。
 */
const proxyCache = new Map<string, unknown>();

function makeProxy(path: readonly string[]): unknown {
  const cacheKey = path.join('.');
  const hit = proxyCache.get(cacheKey);
  if (hit) return hit;

  const enValue = path.reduce<unknown>(
    (o, k) => (o !== null && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
    enStrings,
  );
  const target: object = Array.isArray(enValue) ? [] : {};
  const proxy = new Proxy(target, {
    get(_t, prop) {
      const v = resolvePath(path);
      if (prop === Symbol.toPrimitive) {
        return () => (typeof v === 'string' ? v : String(v ?? ''));
      }
      if (typeof prop === 'symbol') {
        if (prop === Symbol.iterator && Array.isArray(v)) {
          return (v as unknown[])[Symbol.iterator].bind(v);
        }
        return undefined;
      }
      if (v === null || typeof v !== 'object') {
        return prop === 'length' ? undefined : (v as Record<string, unknown>)?.[prop];
      }
      const child = (v as Record<string, unknown>)[prop];
      if (typeof child === 'function') {
        return (child as (...a: unknown[]) => unknown).bind(v);
      }
      if (child !== null && typeof child === 'object') {
        return makeProxy([...path, prop]);
      }
      return child;
    },
    has(_t, prop) {
      const v = resolvePath(path);
      return v !== null && typeof v === 'object' ? prop in (v as object) : false;
    },
    ownKeys() {
      const v = resolvePath(path);
      return v !== null && typeof v === 'object' ? Reflect.ownKeys(v as object) : [];
    },
    getOwnPropertyDescriptor(_t, prop) {
      const v = resolvePath(path);
      if (v === null || typeof v !== 'object') return undefined;
      const d = Reflect.getOwnPropertyDescriptor(v as object, prop);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
  proxyCache.set(cacheKey, proxy);
  return proxy;
}

export const strings = makeProxy([]) as typeof enStrings;

export function coinWord(n: number): string {
  if (getLang() === 'zh') return '币';
  return n === 1 ? 'coin' : 'coins';
}
