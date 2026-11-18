/**
 * splash.ts —— 首次打开缓冲页的收起逻辑（用户 2026-11-18 要求）。
 *
 * 缓冲页本体是 index.html 里的静态节点 #app-splash（JS 包到达前就上屏，
 * 避免白屏）。本模块只负责「何时收」：
 * - App 首帧画完（双 rAF）后调 dismissSplash()：至少展示 MIN_MS，
 *   然后加 .splash--out 淡出并从 DOM 移除（不是藏起来，e2e 不会绊到）。
 * - main.tsx 挂载前 armSplashWatchdog()：MAX_MS 后无条件收起，
 *   就算 App 异常也不能把孩子困在加载页；index.html 里另有 6 秒
 *   内联兜底（连本模块都没加载成时）。
 * 两条路径都幂等，StrictMode 双挂载重复调用无副作用。
 */
const MIN_MS = 600;
const MAX_MS = 4000;
const FADE_MS = 340;

const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
let dismissed = false;
let watchdogArmed = false;

export function dismissSplash(): void {
  if (dismissed) return;
  dismissed = true;
  const run = () => {
    const el = document.getElementById('app-splash');
    if (!el) return;
    el.classList.add('splash--out');
    window.setTimeout(() => el.remove(), FADE_MS);
  };
  const wait = Math.max(0, MIN_MS - (performance.now() - t0));
  if (wait > 0) window.setTimeout(run, wait);
  else run();
}

export function armSplashWatchdog(): void {
  if (watchdogArmed) return;
  watchdogArmed = true;
  window.setTimeout(dismissSplash, MAX_MS);
}
