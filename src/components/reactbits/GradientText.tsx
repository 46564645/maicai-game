/**
 * GradientText.tsx —— React Bits「Gradient Text」裁剪移植（MIT +
 * Commons Clause，署名见 THIRD_PARTY_NOTICES.md）。
 *
 * 上游现行版（ts-default）是 rAF 引擎：逐帧重算 --gt-gradient 整段
 * 渐变串直写 DOM。本仓按 WS2 约定改写为纯 CSS 版（见
 * ./GradientText.css）：一张 scale 倍宽的线性渐变经
 * background-clip:text 贴进文字，动画只有 background-position 的
 * 慢速往返漂移（yoyo），零 JS、零 rAF、无 motion/gsap 依赖。
 *
 * 裁掉项：flow/conic 变体、followPointer 指针跟随、pauseOnHover、
 * glow、showBorder、IntersectionObserver 与整套 paint 引擎。
 * 保留项：linear 变体的「活渐变穿字」核心观感、colors 停靠色、
 * angle、scale（背景宽度倍数）、yoyo 往返节奏（animationSpeed 为
 * 半程秒数）。
 *
 * reduced-motion：CSS 媒体查询内 animation 归零——文字停在一张
 * 静止渐变切片上，完全无运动；不支持 background-clip:text 时
 * 退化为 --color-primary-deep 实色字。
 */
import type { CSSProperties, ReactNode } from 'react';

export interface GradientTextProps {
  children?: ReactNode;
  /** 渐变停靠色（CSS 颜色串，可传 token 变量/color-mix；首尾自动闭环） */
  colors?: string[];
  /** 半程漂移秒数（原版 animationSpeed，yoyo 整周期 = 2×）。默认 10s */
  animationSpeed?: number;
  /** 渐变角 deg（原版 angle；90 = 水平流向） */
  angle?: number;
  /** 背景宽度倍数（原版 scale，钳 1–6） */
  scale?: number;
  className?: string;
  style?: CSSProperties;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function GradientText({
  children,
  colors = ['#5227FF', '#FF9FFC', '#B497CF'],
  animationSpeed = 10,
  angle = 90,
  scale = 3,
  className = '',
  style,
}: GradientTextProps) {
  const palette = colors.length > 1 ? colors : [colors[0], colors[0]];
  const loop = [...palette, palette[0]];
  const cssVars = {
    '--rb-gt-gradient': `linear-gradient(${angle}deg, ${loop.join(', ')})`,
    '--rb-gt-size': `${clamp(scale, 1, 6) * 100}%`,
    '--rb-gt-ms': `${Math.max(1, animationSpeed)}s`,
  } as CSSProperties;

  return (
    <span className={`rb-gtext${className ? ` ${className}` : ''}`} style={{ ...cssVars, ...style }}>
      {children}
    </span>
  );
}
