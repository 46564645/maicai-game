/**
 * StarBorder.tsx —— React Bits「Star Border」改写（MIT + Commons Clause，
 * 署名见 THIRD_PARTY_NOTICES.md）。vendored 口径：内容壳 + 顶/底缘两条
 * 300% 宽渐变光带反向巡游（纯 transform 的 sb-travel，见 cards.css）。
 *
 * 用法：包一层选中/强调元素；同一时刻只允许一个 active 实例在场
 * （由消费方保证——手牌扇/选项网格内天然单选）。active=false 藏光带。
 * reduced-motion：光带静止居中，成一条柔光（不巡游）。
 */
import type { CSSProperties, ReactNode } from 'react';

export interface StarBorderProps {
  /** false = 隐藏两条光带（「同一时刻只一个 active」由消费方切换） */
  active?: boolean;
  /** 光带主色（默认 --glow-amber，配套 --glow-ring 晕） */
  color?: string;
  /** 巡游一周时长（秒），默认 2.8 */
  speed?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function StarBorder({
  active = true,
  color,
  speed = 2.8,
  className,
  style,
  children,
}: StarBorderProps) {
  return (
    <span
      className={`sb${active ? ' sb--on' : ''}${className ? ` ${className}` : ''}`}
      style={
        {
          '--sb-color': color,
          '--sb-speed': `${speed}s`,
          ...style,
        } as CSSProperties
      }
    >
      <span className="sb-body">{children}</span>
      <span className="sb-star sb-star--top" aria-hidden="true" />
      <span className="sb-star sb-star--bot" aria-hidden="true" />
    </span>
  );
}
