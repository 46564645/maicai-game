/**
 * Coins.tsx —— 一排画出来的硬币 + 币数（G1：不只是数字）。
 * R10：币数可换 CoinCounter 滚动数字（counter prop）；不传则保持
 * 原来的纯文本（降级路径，§1.4 保留）。
 */
import type { ReactNode } from 'react';
import { coinWord } from '../data/strings';

export function Coins({
  count,
  label,
  counter,
}: {
  count: number;
  label?: string;
  /** R10 CoinCounter 滚动数字；不传渲染纯文本 */
  counter?: ReactNode;
}) {
  const text = label ?? `${count} ${coinWord(count)}`;
  return (
    <span className="coins" aria-label={text}>
      <span className="coins-row" aria-hidden="true">
        {Array.from({ length: Math.max(0, count) }, (_, i) => (
          <span key={i} className="coin" />
        ))}
      </span>
      <span key={count} className="coins-count coins-bump">
        {counter ?? text}
      </span>
    </span>
  );
}
