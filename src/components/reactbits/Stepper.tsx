/**
 * Stepper.tsx —— React Bits「Stepper」裁剪移植（MIT + Commons Clause，
 * 署名见 THIRD_PARTY_NOTICES.md）。原版 570 行：垂直/水平两向、
 * numbers/dots/bars 三指示、framer-motion 换页、hugeicons 图标。
 * 这里裁成本产品需要的两个形态，共用同一条步轨：
 *   · <StepTrack>：只出步轨（圆点步标 + 连接条 + 滑行指示块）——
 *     B13 做饭面板把「Got a of b」换成食材步轨；
 *   · <Stepper>：步轨 + 单页内容 + 上一步/下一步页脚——B20 求助牌
 *     分页「How to play」。
 * 裁掉项：垂直轨、dots/bars 指示器、紧凑折叠量测、framer-motion
 * （换页改用本文件自包含的 rAF+transition 一步实现）、hugeicons
 * （✓/箭头手写内联 SVG）、主题板与 frame 外壳。
 * 动效口径：滑行指示与换页只走 transform/opacity transition，
 * 无 @keyframes；reduced-motion 下瞬移到位。
 */
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface StepDef {
  key: string;
  /** 步标下方的小标签（可省——CookPanel 无标签纯图标） */
  label?: ReactNode;
  /** 步标内的图标（替代序号数字）；done 态一律换 ✓ */
  icon?: ReactNode;
  /** 完成态（不传则按位置：序号 < current 视为完成） */
  done?: boolean;
}

export interface StepTrackProps {
  steps: StepDef[];
  /** 当前步（1 起）；> total = 全部完成（滑块停在最后一步） */
  current: number;
  /** 给则步标渲染成可点按钮（跳到该步）；不给则纯展示 span */
  onStepClick?: (index: number) => void;
  ariaLabel?: string;
  /** 步标圆点直径（默认 30px；食材图标档给 34） */
  dotPx?: number;
}

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** 手写 ✓（替代原版 hugeicons Tick02Icon） */
function CheckGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 12.8l5 5L19.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 手写左右箭头（替代 ArrowLeft01Icon/ArrowRight01Icon） */
export function ArrowGlyph({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: dir === 'left' ? 'scaleX(-1)' : undefined }}
    >
      <path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 纯步轨：步标 + 连接条 + 滑行指示块（量当前步 offsetLeft 写 --glide-x） */
export function StepTrack({
  steps,
  current,
  onStepClick,
  ariaLabel,
  dotPx = 30,
}: StepTrackProps) {
  const total = steps.length;
  const cur = Math.min(Math.max(1, Math.round(current)), total);
  const trackRef = useRef<HTMLDivElement>(null);
  const glideRef = useRef<HTMLSpanElement>(null);
  const segRefs = useRef<(HTMLElement | null)[]>([]);
  const placedOnce = useRef(false);

  /* 滑行指示：量当前步标的水平位置滑过去（transition 在 CSS 里） */
  useLayoutEffect(() => {
    const track = trackRef.current;
    const glide = glideRef.current;
    if (!track || !glide) return;
    const place = () => {
      const seg = segRefs.current[cur - 1];
      if (!seg) return;
      const x = seg.offsetLeft + seg.offsetWidth / 2 - 13;
      glide.style.setProperty('--glide-x', `${x.toFixed(1)}px`);
    };
    place();
    placedOnce.current = true;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    ro?.observe(track);
    return () => ro?.disconnect();
  }, [cur, total]);

  return (
    <div
      ref={trackRef}
      className="rb-step-track"
      role="group"
      aria-label={ariaLabel}
      style={{ '--step-dot': `${dotPx}px` } as CSSProperties}
    >
      <span ref={glideRef} className="rb-step-glide" aria-hidden="true" />
      {steps.map((s, i) => {
        const done = s.done ?? i < cur - 1;
        const isCur = i === cur - 1;
        const status = done ? 'done' : isCur ? 'current' : 'next';
        const ind = (
          <>
            <span className="rb-step-dot" aria-hidden="true">
              {done ? <CheckGlyph /> : (s.icon ?? i + 1)}
            </span>
            {s.label && <span className="rb-step-label">{s.label}</span>}
          </>
        );
        const cls = `rb-step-ind rb-step-ind--${status}`;
        const conn = i < total - 1 && (
          <span
            className="rb-step-conn"
            aria-hidden="true"
            style={{ '--conn-fill': i < cur - 1 ? 1 : 0 } as CSSProperties}
          />
        );
        return (
          <span key={s.key} style={{ display: 'contents' }}>
            {onStepClick ? (
              <button
                type="button"
                ref={(el) => {
                  segRefs.current[i] = el;
                }}
                className={cls}
                onClick={() => onStepClick(i)}
                aria-current={isCur ? 'step' : undefined}
              >
                {ind}
              </button>
            ) : (
              <span
                ref={(el) => {
                  segRefs.current[i] = el;
                }}
                className={cls}
                aria-current={isCur ? 'step' : undefined}
              >
                {ind}
              </span>
            )}
            {conn}
          </span>
        );
      })}
    </div>
  );
}

export interface StepperProps {
  steps: (StepDef & { pane?: ReactNode })[];
  /** 受控当前步（1 起）；不传则内部自管 */
  step?: number;
  onStepChange?: (index: number) => void;
  /** 页脚按钮文案（英语 UI）；最后一步 nextText 换 doneText */
  backText?: ReactNode;
  nextText?: ReactNode;
  doneText?: ReactNode;
  /** 最后一步「Done」按钮回调（如关闭弹卡）；不传则末步 next 禁用 */
  onDone?: () => void;
  ariaLabel?: string;
  className?: string;
}

/** 单页换页：按方向从 ±24px 淡滑入（rAF + transition，无 @keyframes） */
function StepPane({ dir, children }: { dir: number; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    el.style.transition = 'none';
    el.style.transform = `translateX(${dir * 24}px)`;
    el.style.opacity = '0';
    void el.offsetHeight;
    el.style.transition = '';
    const raf = requestAnimationFrame(() => {
      el.style.transform = '';
      el.style.opacity = '';
    });
    return () => cancelAnimationFrame(raf);
  }, [dir]);
  return (
    <div ref={ref} className="rb-step-pane">
      {children}
    </div>
  );
}

export function Stepper({
  steps,
  step,
  onStepChange,
  backText = 'Back',
  nextText = 'Next',
  doneText = 'Done',
  onDone,
  ariaLabel,
  className = '',
}: StepperProps) {
  const total = steps.length;
  const [internal, setInternal] = useState(0);
  const controlled = typeof step === 'number';
  const cur = Math.min(Math.max(0, Math.round((controlled ? step! - 1 : internal))), total - 1);
  const dirRef = useRef(1);

  const go = (next: number) => {
    const n = Math.min(Math.max(0, next), total - 1);
    if (n === cur) return;
    dirRef.current = n > cur ? 1 : -1;
    if (!controlled) setInternal(n);
    onStepChange?.(n);
  };

  const isLast = cur === total - 1;
  return (
    <div className={`rb-stepper${className ? ` ${className}` : ''}`}>
      <StepTrack
        steps={steps}
        current={cur + 1}
        onStepClick={(i) => go(i)}
        ariaLabel={ariaLabel}
      />
      <div className="rb-step-panes">
        <StepPane key={steps[cur]?.key ?? cur} dir={dirRef.current}>
          {steps[cur]?.pane}
        </StepPane>
      </div>
      <div className="rb-step-footer">
        <button
          type="button"
          className="rb-step-btn"
          disabled={cur === 0}
          onClick={() => go(cur - 1)}
        >
          <ArrowGlyph dir="left" /> {backText}
        </button>
        <button
          type="button"
          className="rb-step-btn rb-step-btn--next"
          disabled={isLast && !onDone}
          onClick={() => (isLast ? onDone?.() : go(cur + 1))}
        >
          {isLast ? doneText : nextText} <ArrowGlyph dir="right" />
        </button>
      </div>
    </div>
  );
}
