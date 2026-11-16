/**
 * Coins.tsx —— 一排画出来的硬币 + 币数（G1：不只是数字）。
 */
import { coinWord } from '../data/strings';

export function Coins({ count, label }: { count: number; label?: string }) {
  const text = label ?? `${count} ${coinWord(count)}`;
  return (
    <span className="coins" aria-label={text}>
      <span className="coins-row" aria-hidden="true">
        {Array.from({ length: Math.max(0, count) }, (_, i) => (
          <span key={i} className="coin" />
        ))}
      </span>
      <span key={count} className="coins-count coins-bump">
        {text}
      </span>
    </span>
  );
}
