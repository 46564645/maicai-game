/**
 * TiltCard.tsx —— React Bits「TiltedCard」剪枝改造（MIT + Commons Clause，署名见
 * THIRD_PARTY_NOTICES.md）。原版用 useRef+RAF 手写惯性；这里用 Pointer Events +
 * CSS transform，鼠标指哪卡倾哪（最大 ±8°），高光斑随视线反相移动。
 *
 * 兼任 R10 翻牌引擎：外层 .tc-tilt 做倾斜，内层 .tc-flip 做 rotateY(180°)
 * 翻页——翻面在 --flip-ms 内完成，reduced-motion 缩到 120ms 直翻。
 * `foil` 挂 CSS 薄膜（§3.3 的 HoloCard 替代，只给完成菜谱/盛宴盘卡用）。
 *
 * 纯展示组件：内部无按钮语义，交互由外层元素承担。
 */
import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';

export interface TiltCardProps {
  /** 未翻面时朝上的一面（「正面」= 初始面） */
  front: ReactNode;
  /** 翻面后显示的一面 */
  back?: ReactNode;
  /** true → 翻到 back 面；无 back 时忽略 */
  flipped?: boolean;
  /** 指针倾斜开关（默认开；deck 顶卡可关） */
  tilt?: boolean;
  /** 高光斑（默认开） */
  glare?: boolean;
  /** CSS foil 膜 */
  foil?: boolean;
  className?: string;
  style?: CSSProperties;
}

const MAX_TILT = 8;

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function TiltCard({
  front,
  back,
  flipped = false,
  tilt = true,
  glare = true,
  foil = false,
  className = '',
  style,
}: TiltCardProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  // R10D（motion #8）：跟手倾斜 rAF 节流——pointermove 每帧只写一次
  // CSS 变量（最新坐标赢），回位走 .tc--leaving 的 250ms 慢过渡
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const onMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!tilt || reduced() || e.pointerType === 'touch') return;
      posRef.current = { x: e.clientX, y: e.clientY };
      elRef.current?.classList.remove('tc--leaving');
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const el = elRef.current;
        const p = posRef.current;
        if (!el || !p) return;
        const r = el.getBoundingClientRect();
        const px = (p.x - r.left) / r.width - 0.5; // -0.5..0.5
        const py = (p.y - r.top) / r.height - 0.5;
        el.style.setProperty('--tc-rx', `${(-py * MAX_TILT * 2).toFixed(2)}deg`);
        el.style.setProperty('--tc-ry', `${(px * MAX_TILT * 2).toFixed(2)}deg`);
        el.style.setProperty('--tc-gx', `${((px + 0.5) * 100).toFixed(1)}%`);
        el.style.setProperty('--tc-gy', `${((py + 0.5) * 100).toFixed(1)}%`);
      });
    },
    [tilt],
  );

  const onLeave = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    el.classList.add('tc--leaving'); // 回位 250ms（CSS 覆写时长）
    el.style.setProperty('--tc-rx', '0deg');
    el.style.setProperty('--tc-ry', '0deg');
  }, []);

  const cls = `tc${flipped ? ' tc--flipped' : ''}${foil ? ' tc--foil' : ''} ${className}`.trim();
  return (
    <div
      className={cls}
      ref={elRef}
      style={style}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div className="tc-tilt">
        <div className="tc-flip">
          <div className="tc-face tc-face--front">
            {front}
            {glare && <i className="tc-glare" aria-hidden="true" />}
            {foil && <i className="tc-foil" aria-hidden="true" />}
          </div>
          <div className="tc-face tc-face--back" aria-hidden={!flipped}>
            {back}
          </div>
        </div>
      </div>
    </div>
  );
}
