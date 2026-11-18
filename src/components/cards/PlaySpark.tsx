/**
 * PlaySpark.tsx —— React Bits「ClickSpark」改造（MIT + Commons Clause，署名见
 * THIRD_PARTY_NOTICES.md）。原版在被点元素下挂小 canvas 画迸溅短线；Slice B
 * 简报允许「canvas 与帧预算冲突时用 DOM 迸溅」——本实现取 DOM 版：零 rAF、
 * 零 canvas，8 根旋转短线各自由 CSS 关键帧向外飞散淡出（transform/opacity
 * only，≤500ms 自毁，reduced-motion 全关）。
 *
 * 用法：命令派发点调 playSparkAt(el)（元素中心迸）或 playSpark(x, y)。
 * 全局并发 ≤3 个（§4.4）；超出即丢弃，不排队。挂在 document.body 上——
 * 面板随 state 更新卸载时迸溅仍能播完。
 */
const MAX_SPARKS = 3;
const SPARK_MS = 480;
const LINES = 8;

let active = 0;

/** 并发闸门（导出供单测）：同屏迸溅上限 3 */
export function sparkAllowed(activeCount: number): boolean {
  return activeCount < MAX_SPARKS;
}

/** 当前在屏迸溅数（测试/调试观测用） */
export function sparkActiveCount(): number {
  return active;
}

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function playSpark(x: number, y: number): void {
  if (typeof document === 'undefined') return;
  if (reducedMotion() || !sparkAllowed(active)) return;
  active += 1;
  const el = document.createElement('div');
  el.className = 'play-spark';
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  for (let i = 0; i < LINES; i++) {
    const line = document.createElement('i');
    line.style.transform = `rotate(${(360 / LINES) * i}deg)`;
    el.appendChild(line);
  }
  document.body.appendChild(el);
  window.setTimeout(() => {
    el.remove();
    active -= 1;
  }, SPARK_MS);
}

/** 元素中心迸溅（投放区/按钮/卡面传入即可） */
export function playSparkAt(el: Element | null | undefined): void {
  if (!el || typeof el.getBoundingClientRect !== 'function') return;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return;
  playSpark(r.x + r.width / 2, r.y + r.height / 2);
}
