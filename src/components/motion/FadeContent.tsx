/**
 * FadeContent.tsx —— React Bits「Fade Content」改写
 * （原版依赖 gsap → 本实现用 motion，MIT + Commons Clause，
 * 署名见 THIRD_PARTY_NOTICES.md）。
 *
 * 淡入 + 淡出包装器：show 驱动进出两向。内包 AnimatePresence——
 * 消费方只需 <FadeContent show={open}>…</FadeContent>，退出播完才卸载。
 * 变体：
 *   fade       纯透明（遮罩/布景交叉淡化口径）
 *   fade-down  淡入 + 退场带短距下沉（弹窗退场口径）
 *   blur       淡入淡出带柔焦（天气洗色/聚光口径）
 *   sink       退场下沉缩小淡出（故事卡收走口径）
 *   pocket     退场专用——飞向左下口袋位（大坐标 vw/vh + 缩小 + 摆角；
 *              入场不播，元素直接以终态出现，离场才动画）
 *
 * reduced-motion：duration=0，进退场瞬间到位（无位移无模糊）。
 * 淡出是 tween 不是 spring——淡出不带回弹，柔和即可。
 * enter=false：不播入场直渲终态（元素自带入场动画时的口径，如故事卡）。
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';

export type FadeContentVariant = 'fade' | 'fade-down' | 'blur' | 'sink' | 'pocket';

function shownFor(variant: FadeContentVariant) {
  /* pocket 的终态也用 vw/vh 表写——与 exit 的 -34vw/30vh 同单位才能插值 */
  const isPocket = variant === 'pocket';
  return {
    opacity: 1,
    x: isPocket ? '0vw' : 0,
    y: isPocket ? '0vh' : 0,
    scale: 1,
    rotate: 0,
    filter: 'blur(0px)',
  };
}

function hiddenFor(variant: FadeContentVariant, distance: number) {
  switch (variant) {
    case 'fade':
      return { opacity: 0 };
    case 'fade-down':
      return { opacity: 0, y: distance };
    case 'blur':
      return { opacity: 0, filter: 'blur(4px)' };
    case 'sink':
      return { opacity: 0, y: 40, scale: 0.85 };
    case 'pocket':
      return { opacity: 0, x: '-34vw', y: '30vh', scale: 0.25, rotate: 14 };
  }
}

export interface FadeContentProps {
  show: boolean;
  variant?: FadeContentVariant;
  /** fade-down 退场下沉量（px），默认 10 */
  distance?: number;
  /** 进退场时长（ms），默认 200（与 --popup-out-ms 160–220 同带） */
  duration?: number;
  /** false = 元素出现时不播入场（pocket 固定不播） */
  enter?: boolean;
  /** 退场动画播完的回调（AnimatePresence onExitComplete 透传） */
  onExitComplete?: () => void;
  className?: string;
  style?: CSSProperties;
  testid?: string;
  /** 装饰性残影（ghost 层）：透传 aria-hidden */
  ariaHidden?: boolean;
  /* —— 集成去重（WS4 同名组件并入本实现）：WS4 消费方的三件透传 ——
     blur：进/退场柔焦量（px），给出时覆盖变体自带的模糊量；
     onClick / role：透传到包裹 div（聚光帘点击关闭、错误卡 alert） */
  blur?: number;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  role?: string;
  children: ReactNode;
}

export function FadeContent({
  show,
  variant = 'fade',
  distance = 10,
  duration = 200,
  enter = true,
  onExitComplete,
  className,
  style,
  testid,
  ariaHidden,
  blur,
  onClick,
  role,
  children,
}: FadeContentProps) {
  const reduce = useReducedMotion();
  const transition = reduce
    ? { duration: 0 }
    : { duration: duration / 1000, ease: 'easeInOut' as const };
  const hiddenBase = hiddenFor(variant, distance);
  const hidden =
    blur === undefined
      ? hiddenBase
      : { ...hiddenBase, filter: `blur(${blur}px)` };
  const enterLive = enter && variant !== 'pocket';
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {show ? (
        <motion.div
          className={className}
          style={style}
          initial={reduce || !enterLive ? false : hidden}
          animate={shownFor(variant)}
          exit={reduce ? { opacity: 0 } : hidden}
          transition={transition}
          data-testid={testid}
          aria-hidden={ariaHidden || undefined}
          onClick={onClick}
          role={role}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
