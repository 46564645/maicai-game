/**
 * GlideTrack.tsx —— React Bits「Glide Select」设计移植
 * （DavidHDev/react-bits，MIT + Commons Clause，见 THIRD_PARTY_NOTICES.md）。
 *
 * 原组件是一组选项里「选中项底下有一条滑动高亮丸」。本移植把它收成
 * 一个包裹任意一排 .demo-chip 的轨道：
 *   - 轨道内带 --on 的 chip 是「家」：指示丸平时伏在它底下；
 *   - 悬停（细指针）/ 按下 / 键盘 focus 其它 chip 时指示丸滑过去，
 *     离开轨道或焦点出走后滑回「家」；无 --on 的轨道指示丸平时隐去；
 *   - --go / --warn 变体 chip 让指示丸染上同款色（选中语义不变）。
 *   - 无 keyframes、无 gsap、无 hugeicons，滑动走 motion（GlidePill），
 *     prefers-reduced-motion 下直接跳位（GlidePill 内部处理）。
 */
import { useLayoutEffect, useRef, useState } from 'react';
import type { FocusEvent, PointerEvent, ReactNode } from 'react';
import { GlidePill, useGlide } from './GlidePill';

type Variant = 'go' | 'warn' | null;

const variantOf = (el: HTMLElement | null): Variant => {
  if (!el) return null;
  if (el.classList.contains('demo-chip--go')) return 'go';
  if (el.classList.contains('demo-chip--warn')) return 'warn';
  return null;
};

export function GlideTrack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { rect, to, trackRef } = useGlide();
  const insideRef = useRef(false);
  const [variant, setVariant] = useState<Variant>(null);

  const home = () =>
    trackRef.current?.querySelector<HTMLElement>('.demo-chip--on') ?? null;

  const chipOf = (t: EventTarget | null) =>
    t instanceof Element ? t.closest<HTMLElement>('.demo-chip') : null;

  /* 每轮渲染后：指针/焦点不在轨道里时，指示丸重锚到当前 --on chip
     （选中项换位置时滑过去；to() 对同矩形 bail-out，不会打循环） */
  useLayoutEffect(() => {
    if (insideRef.current) return;
    const el = home();
    to(el);
    setVariant(variantOf(el));
  });

  const aimAt = (el: HTMLElement | null) => {
    to(el);
    setVariant(variantOf(el));
  };

  const enter = (e: PointerEvent<HTMLSpanElement>) => {
    const chip = chipOf(e.target);
    if (!chip) return;
    insideRef.current = true;
    aimAt(chip);
  };

  const press = (e: PointerEvent<HTMLSpanElement>) => {
    const chip = chipOf(e.target);
    if (chip) aimAt(chip);
  };

  const focusIn = (e: FocusEvent<HTMLSpanElement>) => {
    const chip = chipOf(e.target);
    if (!chip) return;
    insideRef.current = true;
    aimAt(chip);
  };

  const leave = () => {
    insideRef.current = false;
    const el = home();
    to(el);
    setVariant(variantOf(el));
  };

  const focusOut = (e: FocusEvent<HTMLSpanElement>) => {
    const next = e.relatedTarget;
    if (next instanceof Node && trackRef.current?.contains(next)) return;
    insideRef.current = false;
    const el = home();
    to(el);
    setVariant(variantOf(el));
  };

  /* span 不用 div：可嵌进 .demo-bot / .demo-group 这类短语容器 */
  return (
    <span
      ref={(el) => {
        trackRef.current = el;
      }}
      className={['glide-track', className].filter(Boolean).join(' ')}
      onPointerOver={(e) => {
        if (e.pointerType !== 'touch') enter(e);
      }}
      onPointerDown={press}
      onPointerLeave={leave}
      onFocus={focusIn}
      onBlur={focusOut}
    >
      <GlidePill rect={rect} className={variant ? `glide-pill--${variant}` : undefined} />
      {children}
    </span>
  );
}
