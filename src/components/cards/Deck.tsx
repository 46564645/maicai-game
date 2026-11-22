/**
 * Deck.tsx —— 抽牌堆：3 张牌背略错位叠成一小摞，顶卡是按钮；
 * 点按/Enter/Space → 顶卡绕 Y 轴翻 180° 露出正面（菜谱任务卡），
 * 翻牌动画结束后回调 onDraw（派发 DRAW_RECIPE）。
 *
 * B5（React Bits "Stack" 裁剪移植，见 reactbits/Stack.tsx）：顶卡
 * 还可按住拖动/甩——拖时底卡向前挪一档，小位移松手弹回，大位移
 * 「甩穿牌堆」（飞出后从摞底弹回）。**点按抽牌永远是主路径**——
 * 位移不过阈值/tap-rescue 一律走原生 click，拖甩只是增强；
 * 一年级孩子不用拖也能玩。命令时序照旧：点牌 → 560ms 翻 → onDraw。
 * deck-lift/deck-bob @keyframes 归 WS5 所有，本层不动。
 * reduced-motion：翻牌缩到 120ms，甩/弹瞬移归位。
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CARD_BACK_ART } from './cardArt';
import { TiltCard } from './TiltCard';
import { Stack } from '../reactbits/Stack';

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
    <Stack
      className={`deck${flipping ? ' deck--flipping' : ''}${idle ? ' deck--idle' : ''}`}
      top={
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
      }
      topAriaLabel={ariaLabel}
      topTestId={testid}
      topDataKey={dataKey}
      topPrimary
      topDisabled={disabled}
      topClassName="deck-top"
      onTopTap={draw}
      unders={[
        /* 底层两张 = 纯装饰错位牌背（视觉类名沿用 cards.css 既有档） */
        <i key="a" className="deck-under deck-under--a" aria-hidden="true" />,
        <i key="b" className="deck-under deck-under--b" aria-hidden="true" />,
      ]}
    >
      {hint && <p className="deck-hint">{hint}</p>}
    </Stack>
  );
}
