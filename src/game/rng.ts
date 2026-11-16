/**
 * rng.ts —— 可注入种子的 PRNG（mulberry32）。
 * 纯函数：不持有内部状态，随机数由 GameState.rng 的 seed/cursor 推进，
 * 保证固定种子整局可复现。
 */

export interface RngState {
  seed: number;
  cursor: number;
}

export function initRng(seed: number): RngState {
  return { seed: seed >>> 0, cursor: 0 };
}

/** 推进一次，返回 [0,1) 的数与新状态 */
export function nextRng(rng: RngState): { value: number; rng: RngState } {
  let t = (rng.seed + rng.cursor * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: { seed: rng.seed, cursor: rng.cursor + 1 } };
}

/** 取 [0, n) 整数 */
export function nextInt(rng: RngState, n: number): { value: number; rng: RngState } {
  const { value, rng: next } = nextRng(rng);
  return { value: Math.floor(value * n), rng: next };
}

/** 洗牌（不改原数组） */
export function shuffle<T>(rng: RngState, items: readonly T[]): { items: T[]; rng: RngState } {
  const arr = [...items];
  let cur = rng;
  for (let i = arr.length - 1; i > 0; i--) {
    const { value, rng: next } = nextInt(cur, i + 1);
    cur = next;
    [arr[i], arr[value]] = [arr[value], arr[i]];
  }
  return { items: arr, rng: cur };
}

/**
 * 稳定哈希 → [0,1)。不消耗 state.rng，用于 bot 平局定序/性格掷点，
 * 保证同一 GameState 下结果完全确定（PLAN §5 歧义 18）。
 */
export function hash01(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}
