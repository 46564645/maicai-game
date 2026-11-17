/**
 * Deck.tsx —— 自研轻量牌堆（React Bits 无对应组件）。视觉：3 张牌背略错位
 * 叠放成一小摞，顶卡是按钮；点按/Enter/Space → 顶卡绕 Y 轴翻 180°
 * 露出正面（菜谱任务卡），翻牌动画结束后回调 onDraw（派发 DRAW_RECIPE）。
 *
 * 顶卡正面/背面都是传入的 ReactNode 面——背面默认用 PM 生成的牌背图
 * （CARD_BACK_ART），正面由 DrawTaskPanel 传入菜谱卡面。翻面引擎复用
 * TiltCard（tilt 关闭——牌堆不倾斜，只翻）。
 *
 * 时序（R10_DESIGN §4.2 抽牌仪式）：点牌 → 560ms 翻 → onDraw →
 * 引擎 state 更新、弹窗换成任务卡确认条（牌堆随 popup 内容切换退场）。
 * reduced-motion：翻牌缩到 120ms。
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CARD_BACK_ART } from './cardArt';
import { TiltCard } from './TiltCard';

export interface DeckProps {
  /** 顶卡翻开后显示的面（菜谱任务卡卡面） */
  face: ReactNode;
  /** 翻牌动画结束后的回调（派发引擎命令） */
  onDraw: () => void;
  /** 禁用（已翻开/不可抽） */
  disabled?: boolean;
  /** 顶卡按钮的 a11y 文案 + 测试钩子 */
  ariaLabel: string;
  testid?: string;
  dataKey?: number;
}

const FLIP_MS = 560;
const FLIP_MS_RM = 120;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function Deck({ face, onDraw, disabled, ariaLabel, testid, dataKey }: DeckProps) {
  const [flipping, setFlipping] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const draw = () => {
    if (disabled || flipping) return;
    setFlipping(true);
    timerRef.current = window.setTimeout(
      () => onDraw(),
      prefersReducedMotion() ? FLIP_MS_RM : FLIP_MS,
    );
  };

  return (
    <div className={`deck${flipping ? ' deck--flipping' : ''}`}>
      {/* 底层两张 = 纯装饰错位牌背 */}
      <i className="deck-under deck-under--a" aria-hidden="true" />
      <i className="deck-under deck-under--b" aria-hidden="true" />
      <button
        type="button"
        className="deck-top"
        disabled={disabled}
        onClick={draw}
        aria-label={ariaLabel}
        data-testid={testid}
        data-key={dataKey}
        data-primary="true"
      >
        <TiltCard
          className="deck-card"
          tilt={false}
          glare={false}
          flipped={flipping}
          front={
            <img
              className="deck-back-art"
              src={CARD_BACK_ART}
              alt=""
              draggable={false}
            />
          }
          back={face}
        />
      </button>
    </div>
  );
}
