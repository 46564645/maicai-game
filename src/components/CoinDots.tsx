/**
 * CoinDots.tsx —— R10 Slice E（§4 HUD 节食）：币数画成一排小金币，
 * 不再写字。最多摆 cap 枚，超出的收成「+n」尾徽（coinDots 纯派生）。
 * 读屏不数点：整条 aria-hidden，币数走宿主按钮/容器的 aria-label。
 */
import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { coinDots } from '../ui/coinDots';
import { SPRING_POP } from './motion/springs';

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
  /* 手感审计 #2 + F25：新出现的金币点弹入（coin-dot--new）——旧版点数
     变化是瞬间增减，孩子看不见「多了几枚」。prevRef 记上一次的点数，
     只有下标 ≥ 旧点数的新点走弹入；首帧 prevRef 就等于当前点数，
     挂载不弹。减少时点直接消失（方向由宿主的增减小片交代）。
     F25 → Magnet 弹簧口径：弹入用共享 SPRING_POP（scale 0.6→1），
     点本体仍是自定义样式（计划 C3 口径不变）；reduce 直渲。 */
  const prevRef = useRef(dots);
  const prev = prevRef.current;
  const reduce = useReducedMotion();
  useEffect(() => {
    prevRef.current = dots;
  }, [dots]);
  return (
    <span className={`coin-dots ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: dots }, (_, i) =>
        i >= prev ? (
          <motion.i
            key={i}
            className="coin-dot coin-dot--new"
            initial={reduce ? false : { scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={reduce ? { duration: 0 } : SPRING_POP}
          />
        ) : (
          <i key={i} className="coin-dot" />
        ),
      )}
      {!hideExtra && extra > 0 && <i className="coin-dots-extra">+{extra}</i>}
    </span>
  );
}
