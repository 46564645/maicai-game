/**
 * CoinCounter.tsx —— React Bits「Counter」剪枝改造（MIT + Commons Clause，署名见
 * THIRD_PARTY_NOTICES.md）。原版是通用数字滚动器；这里只保留整数 0–99 两位
 * 滚动数字：每位一列 0–9 数字条，值变化时数字条 translateY 滚到位
 * （--coin-roll-ms 内，reduced-motion 120ms），同时维护 aria-live 文本让
 * 读屏报「3 个金币」而不是一串滚动的数字。
 *
 * 用法：<CoinCounter value={coins} label="3 个金币" /> —— label 给读屏，
 * 可视区只渲染数字列。
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface CoinCounterProps {
  /** 0–99 整数（超出会被夹到 0–99；负数显示 0） */
  value: number;
  /** 读屏完整文本（如 "3 个金币"） */
  label: string;
  className?: string;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function DigitColumn({ d }: { d: number }) {
  return (
    <span className="cc-col" aria-hidden="true">
      <span
        className="cc-strip"
        style={{ transform: `translateY(${-d}em)` }}
      >
        {DIGITS.map((n) => (
          <span key={n} className="cc-digit">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

export function CoinCounter({ value, label, className = '' }: CoinCounterProps) {
  const v = Math.max(0, Math.min(99, Math.round(value)));
  const tens = Math.floor(v / 10);
  const ones = v % 10;
  // aria-live 只在值真正变化时重报（SSR/首渲不报）
  const firstRef = useRef(true);
  const liveRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    if (liveRef.current) liveRef.current.textContent = label;
  }, [label]);

  const cols: ReactNode[] = [];
  if (tens > 0) cols.push(<DigitColumn key="t" d={tens} />);
  cols.push(<DigitColumn key="o" d={ones} />);

  return (
    <span className={`coin-counter ${className}`.trim()}>
      <span className="cc-vis" aria-hidden="true">
        {cols}
      </span>
      {/* 读屏：aria-live 文本；可视列已 aria-hidden，不会重读 */}
      <span className="cc-live" ref={liveRef} aria-live="polite" role="status">
        {label}
      </span>
    </span>
  );
}
