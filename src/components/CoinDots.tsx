/**
 * CoinDots.tsx —— R10 Slice E（§4 HUD 节食）：币数画成一排小金币，
 * 不再写字。最多摆 cap 枚，超出的收成「+n」尾徽（coinDots 纯派生）。
 * 读屏不数点：整条 aria-hidden，币数走宿主按钮/容器的 aria-label。
 */
import { useEffect, useRef } from 'react';
import { coinDots } from '../ui/coinDots';

export function CoinDots({
  n,
  cap = 10,
  className = '',
  hideExtra = false,
}: {
  n: number;
  cap?: number;
  className?: string;
  /** R2-9（团队第 2 轮）：「+数字」在 HUD 里只表示这一圈拿到的钱
   * （lapGain），金币点的溢出尾徽也是「+n」会撞义——带可见余额数字
   * 的宿主（角落卡/顺序片/手机头像片/高光卡/币堆）一律关掉尾徽，
   * 精确币数由旁边的数字负责（E4 口径不变） */
  hideExtra?: boolean;
}) {
  const { dots, extra } = coinDots(n, cap);
  /* 手感审计 #2：新出现的金币点弹入（coin-dot--new）——旧版点数变化
     是瞬间增减，孩子看不见「多了几枚」。prevRef 记上一次的点数，
     只有下标 ≥ 旧点数的新点带弹入类；首帧 prevRef 就等于当前点数，
     挂载不弹。减少时点直接消失（方向由宿主的增减小片交代）。 */
  const prevRef = useRef(dots);
  const prev = prevRef.current;
  useEffect(() => {
    prevRef.current = dots;
  }, [dots]);
  return (
    <span className={`coin-dots ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: dots }, (_, i) => (
        <i key={i} className={'coin-dot' + (i >= prev ? ' coin-dot--new' : '')} />
      ))}
      {!hideExtra && extra > 0 && <i className="coin-dots-extra">+{extra}</i>}
    </span>
  );
}
