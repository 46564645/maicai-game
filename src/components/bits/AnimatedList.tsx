/**
 * AnimatedList.tsx —— React Bits「Animated List」裁剪改写（MIT + Commons
 * Clause，THIRD_PARTY_NOTICES.md 有登记）。原组件功能集：行项弹入
 * （scale/opacity 弹簧）、渐变遮罩、滚动、键盘导航、点击选中 +
 * 滑动选中指示。本项目裁剪：只保留「行项错峰弹入」+ 可选「滑动选中环」
 * （GlideRing 同机制）；不搬滚动视口/渐变/键盘导航（本仓流水为静态短表）。
 * WS3 C20：Feast 流水行用本组件排入；reduced-motion 各行静态直出。
 */
import { useReducedMotion, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { GlideRing } from './GlideRing';

export interface AnimatedListItem {
  key: string;
  node: ReactNode;
}

export interface AnimatedListProps {
  items: AnimatedListItem[];
  className?: string;
  itemClassName?: string;
  /** 行入场：'pop'=缩放弹入 'slide'=上移滑入 'fade'=纯淡入，默认 'pop' */
  animation?: 'pop' | 'slide' | 'fade' | 'none';
  /** 每行错峰（秒），默认 0.05 */
  stagger?: number;
  /** 可选选中态：渲染滑动选中环（Animated List 的 gliding selection） */
  selectedIndex?: number;
  ringClassName?: string;
  role?: string;
}

const SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const;

export function AnimatedList({
  items,
  className,
  itemClassName,
  animation = 'pop',
  stagger = 0.05,
  selectedIndex,
  ringClassName,
  role,
}: AnimatedListProps) {
  const reduce = useReducedMotion();
  const [selEl, setSelEl] = useState<HTMLElement | null>(null);
  // SSR（node 环境无 window）下 motion.* 元素会访问 DOM——静态渲染
  const animOff =
    reduce ||
    animation === 'none' ||
    typeof window === 'undefined' ||
    typeof document === 'undefined';

  const initial =
    animation === 'slide'
      ? { opacity: 0, y: 10 }
      : animation === 'fade'
        ? { opacity: 0 }
        : { opacity: 0, scale: 0.85, y: 6 };

  return (
    <div className={className} role={role} style={{ position: 'relative' }}>
      {selectedIndex !== undefined && ringClassName && (
        <GlideRing target={selEl} className={ringClassName} />
      )}
      {items.map((it, i) => {
        const isSel = selectedIndex === i;
        if (animOff) {
          return (
            <div
              key={it.key}
              className={itemClassName}
              data-selected={isSel || undefined}
              ref={isSel ? setSelEl : undefined}
            >
              {it.node}
            </div>
          );
        }
        return (
          <motion.div
            key={it.key}
            className={itemClassName}
            data-selected={isSel || undefined}
            ref={isSel ? setSelEl : undefined}
            initial={initial}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING, delay: i * stagger }}
          >
            {it.node}
          </motion.div>
        );
      })}
    </div>
  );
}
