/**
 * Coins.tsx —— 一排画出来的硬币 + 币数（G1：不只是数字）。
 * WS3 C4：.coins-count 读数改由 React Bits Count Up 驱动（vendored
 * bits/CountUp，motion 插值）——币数变化本身就是滚动动画，旧的
 * coins-bump 撞一下关键帧不再被组件侧依赖（WS5 F24 收编删除）。
 * reduced-motion：CountUp 直接落终值。读屏走外层 aria-label + sr-only。
 */
import { coinWord } from '../data/strings';
import { CountUp } from './bits/CountUp';

export function Coins({
  count,
  label,
}: {
  count: number;
  label?: string;
}) {
  const text = label ?? `${count} ${coinWord(count)}`;
  return (
    <span className="coins" aria-label={text}>
      <span className="coins-row" aria-hidden="true">
        {Array.from({ length: Math.max(0, count) }, (_, i) => (
          <span key={i} className="coin" />
        ))}
      </span>
      <span className="coins-count">
        <span aria-hidden="true">
          <CountUp to={count} duration={0.6} />
        </span>
        <span className="sr-only">{count}</span>
      </span>
    </span>
  );
}
