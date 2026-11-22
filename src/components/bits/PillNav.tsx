/**
 * PillNav.tsx —— React Bits「Pill Nav」设计移植（DavidHDev/react-bits，
 * MIT + Commons Clause，见 THIRD_PARTY_NOTICES.md）。
 *
 * 原组件是整站导航（logo/折叠面板/手搓 rAF 弹簧）；本项目只取
 * 「轨道 + 子项 + 跟随指针/焦点的滑动指示丸」一段：
 *   - 指示丸在悬停（细指针）、按下（触屏）与键盘 focus 时滑到该子项，
 *     离开轨道/失焦时淡出；
 *   - 子项仍是原生 <button>，disabled / aria / data-* 原样透传；
 *   - 无 keyframes、无 gsap，滑动走 motion（GlidePill），
 *     prefers-reduced-motion 下指示丸直接跳位。
 */
import type { FocusEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { GlidePill, useGlide } from './GlidePill';

export interface PillNavItem {
  key: string;
  label: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** data-testid / data-key / aria-* 等透传属性 */
  attrs?: Record<string, string | number | boolean | undefined>;
}

export function PillNav({
  items,
  ariaLabel,
  className,
  orientation = 'horizontal',
  itemClassName,
}: {
  items: PillNavItem[];
  ariaLabel?: string;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  itemClassName?: string;
}) {
  const { rect, to, trackRef } = useGlide();

  const enter = (el: HTMLElement, e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    to(el);
  };

  const leaveIfOutside = (e: FocusEvent<HTMLButtonElement>) => {
    const next = e.relatedTarget;
    if (next instanceof Node && trackRef.current?.contains(next)) return;
    to(null);
  };

  return (
    <nav className={['pill-nav', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      <div
        ref={(el) => {
          trackRef.current = el;
        }}
        className={`pill-nav-track pill-nav-track--${orientation}`}
        onPointerLeave={() => to(null)}
      >
        <GlidePill rect={rect} />
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            className={['pill-nav-item', itemClassName, it.className]
              .filter(Boolean)
              .join(' ')}
            disabled={it.disabled}
            aria-label={it.ariaLabel}
            onClick={it.onClick}
            onPointerEnter={(e) => enter(e.currentTarget, e)}
            onPointerDown={(e) => {
              if (!it.disabled) to(e.currentTarget);
            }}
            onFocus={(e) => {
              if (!it.disabled) to(e.currentTarget);
            }}
            onBlur={leaveIfOutside}
            {...it.attrs}
          >
            {it.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
