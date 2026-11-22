/**
 * BubbleMenu.tsx —— React Bits「Bubble Menu」设计移植
 * （DavidHDev/react-bits，MIT + Commons Clause，见 THIRD_PARTY_NOTICES.md）。
 *
 * 原组件靠 gsap 弹出圆形菜单项；本项目 gsap 不引入——展开动作改用
 * motion 弹簧（PlaySpark 口径：保留设计、动效重写）。
 * 结构 = 一枚主泡 + 向上展开的纵向 Pill Nav 托盘（A14：快操槽位走
 * Pill Nav 滑动指示丸）。托盘绝对定位、挂在 .phone-quick 上沿上方，
 * 不撑大布局盒（CameraRig 取景不受影响）。
 *
 * 刻意无包裹层：主泡与托盘都是 .phone-quick 的直子——
 * hudNudge 的 `.phone-quick > .phone-fab` 直子选择器按旧口径命中主泡。
 * DOM 顺序主泡在前、托盘在后：Tab 从主泡自然进托盘项。
 *
 * 可访问性：主泡 aria-expanded/aria-haspopup；点外/Esc 关闭并回焦；
 * prefers-reduced-motion 下托盘直现直隐，无弹簧。
 */
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { canMotion } from './PressButton';
import { PillNav } from './PillNav';
import type { PillNavItem } from './PillNav';

export function BubbleMenu({
  main,
  items,
  mainClassName,
  menuAriaLabel,
  mainAttrs,
}: {
  /** 主泡内容（含币数/徽标等常显信息） */
  main: ReactNode;
  items: PillNavItem[];
  mainClassName?: string;
  menuAriaLabel?: string;
  /** 主泡透传属性（data-testid / aria-label 等） */
  mainAttrs?: Record<string, string | number | boolean | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const trayRef = useRef<HTMLSpanElement>(null);
  const mainRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: globalThis.PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (mainRef.current?.contains(t) || trayRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      mainRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemClick = (it: PillNavItem, e: MouseEvent<HTMLButtonElement>) => {
    setOpen(false);
    it.onClick?.(e);
  };

  return (
    <>
      <button
        ref={mainRef}
        type="button"
        className={mainClassName}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        {...mainAttrs}
      >
        {main}
      </button>
      <AnimatePresence>
        {open && !canMotion() && (
          /* SSR / node 测试：无 motion 环境托盘直现直隐 */
          <span ref={trayRef} className="bubble-tray">
            <PillNav
              orientation="vertical"
              className="bubble-tray-nav"
              itemClassName="bubble-item"
              ariaLabel={menuAriaLabel}
              items={items.map((it) => ({
                ...it,
                onClick: (e) => itemClick(it, e),
              }))}
            />
          </span>
        )}
        {open && canMotion() && (
          <motion.span
            ref={trayRef}
            className="bubble-tray"
            style={{ transformOrigin: 'bottom left' }}
            initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <PillNav
              orientation="vertical"
              className="bubble-tray-nav"
              itemClassName="bubble-item"
              ariaLabel={menuAriaLabel}
              items={items.map((it) => ({
                ...it,
                onClick: (e) => itemClick(it, e),
              }))}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </>
  );
}
