/**
 * PendingChip.tsx —— R10C 后悔窗口的撤销片：派发挂起期间显示的
 * 大按钮「等等！收回xxx」。keyboard 自然可达（原生 button），Esc 也可撤销。
 *
 * WS3 C12：倒计时条换成 React Bits「Swipe Toast」引信设计（MIT + Commons
 * Clause，见 THIRD_PARTY_NOTICES.md）——底部一条待燃引线 + 燃头火星，
 * 燃烧进度由组件内 motion `animate()` 驱动（1→0 线性，与 windowMs 同步），
 * 不再依赖 CSS 关键帧（pending-chip-drain 归 WS5 F11，勿动）。
 * usePending/pendingCommit 的时序语义不变；reduced-motion 显示
 * 静止的满引线（与旧「静止满条」同义）。
 */
import { useEffect, useRef, useState } from 'react';
import { animate, useMotionValue, useReducedMotion, useTransform, motion } from 'motion/react';
import { strings } from '../../data/strings';
import { fmt } from '../../game/stations/shared';

/** 火星点直径（px），与 .pending-chip-fuse-ember 的 CSS 保持一致 */
const EMBER_PX = 7;

/** SSR（node 环境无 window）下渲染静态引线——motion.* 元素 SSR 会访问 DOM */
const IS_BROWSER =
  typeof window !== 'undefined' && typeof document !== 'undefined';

export function PendingChip({
  label,
  windowMs = 1500,
  onCancel,
}: {
  /** 挂起中的展示名（卡名/答案句） */
  label: string;
  windowMs?: number;
  onCancel: () => void;
}) {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLSpanElement>(null);
  const [trackW, setTrackW] = useState(0);
  /** 剩余时间进度 1→0（线性，跟 windowMs 同步） */
  const progress = useMotionValue(1);

  useEffect(() => {
    setTrackW(trackRef.current?.clientWidth ?? 0);
  }, [label]);

  // 燃烧：进度 1→0 线性走完整个挂起窗口；label 换 = 新窗口重燃。
  useEffect(() => {
    progress.set(1);
    if (reduce) return undefined;
    const controls = animate(progress, 0, {
      duration: windowMs / 1000,
      ease: 'linear',
    });
    return () => controls.stop();
  }, [windowMs, label, reduce, progress]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  // 燃头火星：钉在引线前端，快燃尽时熄灭。
  const emberX = useTransform(progress, (v) =>
    Math.max(0, v * trackW - EMBER_PX),
  );
  const emberOpacity = useTransform(progress, [0, 0.08, 0.2, 1], [0, 0, 1, 1]);

  return (
    <button
      type="button"
      className="pending-chip"
      style={{ '--pending-ms': `${windowMs}ms` } as React.CSSProperties}
      onClick={onCancel}
    >
      <span className="pending-chip-ico" aria-hidden="true">
        ⏮
      </span>
      {fmt(strings.regret.undo, { item: label })}
      <span ref={trackRef} className="pending-chip-fuse" aria-hidden="true">
        {IS_BROWSER ? (
          <motion.i
            className="pending-chip-fuse-fill"
            style={{ scaleX: progress }}
          />
        ) : (
          <i className="pending-chip-fuse-fill" />
        )}
        {IS_BROWSER && !reduce && (
          <motion.i
            className="pending-chip-fuse-ember"
            style={{ x: emberX, opacity: emberOpacity }}
          />
        )}
      </span>
    </button>
  );
}
