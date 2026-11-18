/**
 * CoinDots.tsx —— R10 Slice E（§4 HUD 节食）：币数画成一排小金币，
 * 不再写字。最多摆 cap 枚，超出的收成「+n」尾徽（coinDots 纯派生）。
 * 读屏不数点：整条 aria-hidden，币数走宿主按钮/容器的 aria-label。
 */
import { coinDots } from '../ui/coinDots';

export function CoinDots({
  n,
  cap = 10,
  className = '',
}: {
  n: number;
  cap?: number;
  className?: string;
}) {
  const { dots, extra } = coinDots(n, cap);
  return (
    <span className={`coin-dots ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: dots }, (_, i) => (
        <i key={i} className="coin-dot" />
      ))}
      {extra > 0 && <i className="coin-dots-extra">+{extra}</i>}
    </span>
  );
}
