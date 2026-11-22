/**
 * PlayableGlow.tsx —— React Bits「BorderGlow」令牌化改造（MIT + Commons Clause，
 * 署名见 THIRD_PARTY_NOTICES.md）。原版是彩色角点旋转；按 R10_DESIGN §3.2
 * 只留「可打出柔光呼吸」：黄色 55% 外晕沿卡缘一圈 + 每轮 700ms 扫光带一次。
 *
 * 用法：包住一张 CardView；active 时开外晕。`sweepKey` 变化触发一次扫光
 * （重挂载扫光条 = 动画重放）。色值全部走 tokens（--glow-*），无 hsl() 入码。
 *
 * WS5 扩展：一次性柔光脉冲层（pulse + pulseKey）——
 *   'play'  黄晕落地脉冲（F4 打出/买入落定；同 .card-view--just-played）
 *   'warn'  柔红警示脉冲（F10 币条溢出 / F20 卡拒付 / F21 宝石拒付同系）
 * 语义同形换色：都是「沿卡缘绽放一圈柔光、单次播完即静止」，
 * 不引入描边/闪烁。reduced-motion 下脉冲层不渲染（静态端点即终态）。
 */
import type { CSSProperties, ReactNode } from 'react';

export type GlowPulseKind = 'play' | 'warn';

export interface PlayableGlowProps {
  /** true = 可打出（买得起/可留）→ 柔光呼吸 */
  active: boolean;
  /** 变化一次播一次 700ms 扫光（如轮到手/摊档刷新） */
  sweepKey?: string | number;
  /** WS5：一次性柔光脉冲（与 sweepKey 配合：值变才重播） */
  pulse?: GlowPulseKind;
  /** 脉冲的重播键（如 deny 计数 / 落地批次） */
  pulseKey?: string | number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function PlayableGlow({
  active,
  sweepKey,
  pulse,
  pulseKey,
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
      {pulse && pulseKey !== undefined && (
        <i
          key={`p-${pulseKey}`}
          className={`pglow-pulse${pulse === 'warn' ? ' pglow-pulse--warn' : ''}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
