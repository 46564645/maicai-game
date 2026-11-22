/**
 * GlideRing.tsx —— 「滑动选中环」原语，React Bits「Animated List」选中指示
 * 机制的设计改写（MIT + Commons Clause，THIRD_PARTY_NOTICES.md 登记）：
 * 绝对定位的指示环放在 relative 容器里，目标元素变化时用 motion 弹簧
 * 「滑」到新目标的盒子上（位置 + 尺寸一起弹簧到位）。原组件的指示环
 * 机制同此（gsap→motion 改写）。
 * 用途：C8 顺序条的「下一个」高亮、C9 步进轨的当前步、C20 AnimatedList
 * 的选中指示。reduced-motion：直接瞬移到终态。
 */
import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';

export interface GlideRingProps {
  /** 要套住的目标元素；null 时隐藏 */
  target: HTMLElement | null;
  className?: string;
  /** 额外 Y 偏移（如 .order-chip--next 的 -3px 抬升），默认 0 */
  offsetY?: number;
  /** 指示环外扩 px（正值环更大），默认 0 */
  outset?: number;
}

const SPRING = { type: 'spring', stiffness: 420, damping: 34 } as const;

export function GlideRing({
  target,
  className,
  offsetY = 0,
  outset = 0,
}: GlideRingProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const host = el.offsetParent as HTMLElement | null;
    if (!target || !host) {
      el.style.opacity = '0';
      return undefined;
    }

    const place = (snap: boolean) => {
      const hostBox = host.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      const to = {
        x: box.left - hostBox.left - outset,
        y: box.top - hostBox.top + offsetY - outset,
        width: box.width + outset * 2,
        height: box.height + outset * 2,
      };
      if (snap || reduce) {
        el.style.transform = `translate(${to.x}px, ${to.y}px)`;
        el.style.width = `${to.width}px`;
        el.style.height = `${to.height}px`;
        el.style.opacity = '1';
      } else {
        animate(el, { ...to, opacity: 1 }, SPRING);
      }
    };

    place(false);
    // 目标自身的 CSS 过渡（如 .order-chip--next 上抬）不在 RO 视野内——
    // 落定节拍补几次瞬移贴合，覆盖过渡/换行等位置漂移
    const settle = [120, 300, 560].map((ms) =>
      window.setTimeout(() => place(true), ms),
    );
    const ro = new ResizeObserver(() => place(true));
    ro.observe(host);
    if (target) ro.observe(target);
    return () => {
      settle.forEach(clearTimeout);
      ro.disconnect();
    };
  }, [target, offsetY, outset, reduce]);

  return <span ref={ref} className={className} aria-hidden="true" />;
}
