/**
 * dupBadges.ts —— R10 Slice D（education #6 余量）：扇里相邻的同卡
 * 计数徽标（「×2」）。赠品菜堆/市场摊里同名卡会并排坐，孩子分不清
 * 「两张一样的」和「一张」——连号的同卡每张贴枚小徽标。
 * 纯函数：输入卡列 + 取 key 函数（同名即同 key，null slot 回 null），
 * 输出等长数组：相邻连号 >1 的位上写连号数，其余 null。
 */
export function adjacentDupCounts<T>(
  items: readonly T[],
  keyOf: (t: T) => string | null | undefined,
): (number | null)[] {
  const out: (number | null)[] = new Array(items.length).fill(null);
  let i = 0;
  while (i < items.length) {
    const k = keyOf(items[i]);
    let j = i + 1;
    while (j < items.length && k != null && keyOf(items[j]) === k) j++;
    if (k != null && j - i > 1) {
      for (let m = i; m < j; m++) out[m] = j - i;
    }
    i = j;
  }
  return out;
}
