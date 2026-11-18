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
  /** R10C（interaction #3）：等待期的提示句（「点一下，翻开看看」），
      与 deck--idle 的轻轻上下浮动一起给「这是一张可以点的牌堆」信号 */
  hint?: string;
}

const FLIP_MS = 560;
const FLIP_MS_RM = 120;

/** 翻牌时长（纯函数，单测口径）：reduced-motion 缩到 120ms */
export function deckFlipMs(reducedMotion: boolean): number {
  return reducedMotion ? FLIP_MS_RM : FLIP_MS;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function Deck({ face, onDraw, disabled, ariaLabel, testid, dataKey, hint }: DeckProps) {
  const [flipping, setFlipping] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const draw = () => {
    if (disabled) return;
    // R10C（motion #6）/ R1-E2：翻牌中再点一下 = 跳过——清掉推进
    // 定时器立即落定派发，不再等尾巴（第一次点按仍是完整仪式）
    if (flipping) {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      onDraw();
      return;
    }
    setFlipping(true);
    timerRef.current = window.setTimeout(
      () => onDraw(),
      deckFlipMs(prefersReducedMotion()),
    );
  };

  // R10C：等待期的牌堆轻轻浮动（deck--idle）——同屏唯一的持续动画位
  const idle = !disabled && !flipping;
  return (
    <div className={`deck${flipping ? ' deck--flipping' : ''}${idle ? ' deck--idle' : ''}`}>
      {hint && <p className="deck-hint">{hint}</p>}
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
