/**
 * CountUp.tsx —— React Bits「Count Up」裁剪改造（MIT + Commons Clause，
 * 署名见 THIRD_PARTY_NOTICES.md）。原组件（DavidHDev/react-bits
 * src/ts-default/TextAnimations/CountUp）有 count/roll 两式；按本仓口径只
 * 留 count 式——数字整体插值滚动（逐位滚动仍归 C1 的 CoinCounter）。
 * 保留原设计要点：easeOut/linear/expo/spring 四档缓动、from→to 插值、
 * prefix/suffix/separator/decimals 格式化、tabular-nums、onStart/onEnd。
 * 本仓改动：动画由 motion 的 animate() 驱动（原版同）；值变化即重播；
 * prefers-reduced-motion 下直接落终值（瞬时、无动画）。
 */
import { animate, cubicBezier, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

type Easing = 'easeOut' | 'linear' | 'expo' | 'spring';

export interface CountUpProps {
  /** 目标值：变化即从当前值滚到新值（motion 插值） */
  to: number;
  /** 首帧起点（默认 0；direction='down' 时终点） */
  from?: number;
  direction?: 'up' | 'down';
  /** 每次播放前的延迟（秒） */
  delay?: number;
  /** 播放时长（秒，默认 0.6——本仓「 toned 」口径，比原版 2s 收短） */
  duration?: number;
  easing?: Easing;
  decimals?: number;
  separator?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
  onStart?: () => void;
  onEnd?: () => void;
}

const makeSpring = (overshoot: number) => {
  const log = Math.log(Math.min(0.5, Math.max(0.001, overshoot)));
  const zeta = -log / Math.sqrt(Math.PI * Math.PI + log * log);
  const damped = Math.PI / 0.52;
  const natural = damped / Math.sqrt(1 - zeta * zeta);
  const raw = (t: number) =>
    1 - Math.exp(-zeta * natural * t) * (Math.cos(damped * t) + ((zeta * natural) / damped) * Math.sin(damped * t));
  const residual = 1 - raw(1);
  return (t: number) => (t >= 1 ? 1 : raw(t) + residual * t * t * t);
};

const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeOut: cubicBezier(0.33, 1, 0.68, 1),
  expo: (t) => (t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10))),
  spring: makeSpring(0.06),
};

const getDecimalPlaces = (num: number): number => {
  const str = num.toString();
  if (str.includes('.')) {
    const decimals = str.split('.')[1];
    if (parseInt(decimals) !== 0) return decimals.length;
  }
  return 0;
};

const group = (int: string, separator: string) =>
  separator ? int.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : int;

export function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 0.6,
  easing = 'easeOut',
  decimals,
  separator = '',
  prefix = '',
  suffix = '',
  className = '',
  style,
  onStart,
  onEnd,
}: CountUpProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const startValue = direction === 'down' ? to : from;
  const endValue = direction === 'down' ? from : to;
  const valueRef = useRef(startValue);
  const places = decimals ?? Math.max(getDecimalPlaces(from), getDecimalPlaces(to));
  const cbRef = useRef({ onStart, onEnd });
  cbRef.current = { onStart, onEnd };

  const formatValue = useCallback(
    (latest: number) => {
      const fixed = Math.abs(latest).toFixed(places);
      const [int, frac = ''] = fixed.split('.');
      const neg = latest < 0 && Number(fixed) !== 0;
      const body = `${neg ? '-' : ''}${group(int, separator)}${frac ? `.${frac}` : ''}`;
      return `${prefix}${body}${suffix}`;
    },
    [places, separator, prefix, suffix],
  );

  useEffect(() => {
    const el = textRef.current;
    if (!el) return undefined;
    const finish = () => {
      valueRef.current = endValue;
      el.textContent = formatValue(endValue);
      cbRef.current.onEnd?.();
    };
    if (reduce || duration <= 0) {
      finish();
      return undefined;
    }
    cbRef.current.onStart?.();
    const fromV = valueRef.current;
    const ease = EASINGS[easing] ?? EASINGS.easeOut;
    const controls = animate(0, 1, {
      duration,
      delay: Math.max(0, delay),
      ease: 'linear',
      onUpdate: (t) => {
        const v = fromV + (endValue - fromV) * ease(t);
        valueRef.current = v;
        el.textContent = formatValue(v);
      },
      onComplete: finish,
    });
    return () => controls.stop();
  }, [endValue, duration, delay, easing, reduce, formatValue]);

  return (
    <span
      ref={textRef}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {formatValue(startValue)}
    </span>
  );
}
