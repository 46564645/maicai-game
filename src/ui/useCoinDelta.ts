/**
 * useCoinDelta.ts —— 手感审计 #2：钱包币数变化的瞬时增减标记。
 *
 * 旧版金币变化只有数字滚动：方向和大小要孩子自己比对前后两个数。
 * 本 hook 盯住一个币数，变化落地时给出 { delta, stamp }，宿主据此
 * 渲染一枚「+2 / −3」金币色小片（coin-delta-chip，升起淡出约 1.1s
 * 后由本 hook 自动收起）。首帧只记基线、不报——挂载不是变化。
 * 纯派生展示，不产生任何命令；读屏口径仍走 CoinCounter 的 aria-live。
 */
import { useEffect, useRef, useState } from 'react';

export interface CoinDelta {
  /** 正 = 得币，负 = 花币（已取符号，渲染时负数用 − 号） */
  delta: number;
  /** 每次变化递增的序号（宿主用作 key，同值重播也换片重播动画） */
  stamp: number;
}

/** 小片在屏时长（与 .coin-delta-chip 动画 1100ms 对齐，留 50ms 余量） */
export const COIN_DELTA_CHIP_MS = 1150;

export function useCoinDelta(coins: number): CoinDelta | null {
  const prevRef = useRef(coins);
  const stampRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const [chip, setChip] = useState<CoinDelta | null>(null);

  useEffect(() => {
    const d = coins - prevRef.current;
    prevRef.current = coins;
    if (d === 0) return;
    stampRef.current += 1;
    const stamp = stampRef.current;
    setChip({ delta: d, stamp });
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setChip((cur) => (cur?.stamp === stamp ? null : cur));
    }, COIN_DELTA_CHIP_MS);
  }, [coins]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return chip;
}

/** 小片文案：得币「+2」/ 花币「−3」（负号用 U+2212，与流水口径一致） */
export function coinDeltaText(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${-delta}`;
}
