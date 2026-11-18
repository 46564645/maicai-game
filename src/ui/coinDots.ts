/**
 * coinDots.ts —— R10 Slice E（§4 HUD 节食）：物理金币点推导。
 * 币数不再写字，画成一排小金币；最多摆 cap 枚，超出的收成
 * 一枚「+n」尾徽（小玩家币数常态 0–15，10 枚内可读）。纯派生，
 * 无新数据：n 就是 player.coins。
 */
export interface CoinDotsShape {
  /** 实际画出来的金币点数（0..cap） */
  dots: number;
  /** 超出 cap 的剩余（>0 时画「+n」徽标） */
  extra: number;
}

export function coinDots(n: number, cap = 10): CoinDotsShape {
  const coins = Math.max(0, Math.floor(n));
  return { dots: Math.min(coins, cap), extra: Math.max(0, coins - cap) };
}
