/**
 * PlayableGlow.tsx —— React Bits「BorderGlow」令牌化改造（MIT + Commons Clause，
 * 署名见 THIRD_PARTY_NOTICES.md）。原版是彩色角点旋转；按 R10_DESIGN §3.2
 * 只留「可打出柔光呼吸」：黄色 55% 外晕沿卡缘一圈 + 每轮 700ms 扫光带一次。
 *
 * 用法：包住一张 CardView；active 时开外晕。`sweepKey` 变化触发一次扫光
 * （重挂载扫光条 = 动画重放）。色值全部走 tokens（--glow-*），无 hsl() 入码。
 */
import type { CSSProperties, ReactNode } from 'react';

export interface PlayableGlowProps {
  /** true = 可打出（买得起/可留）→ 柔光呼吸 */
  active: boolean;
  /** 变化一次播一次 700ms 扫光（如轮到手/摊档刷新） */
  sweepKey?: string | number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function PlayableGlow({
  active,
  sweepKey,
  children,
  className = '',
  style,
}: PlayableGlowProps) {
  const cls = `pglow${active ? ' pglow--on' : ''} ${className}`.trim();
  return (
    <div className={cls} style={style}>
      {children}
      {active && sweepKey !== undefined && (
        <i key={sweepKey} className="pglow-sweep" aria-hidden="true" />
      )}
    </div>
  );
}
