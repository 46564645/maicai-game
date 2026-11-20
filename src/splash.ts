/**
 * splash.ts —— 缓冲页的 DOM 渲染侧（状态机在 src/boot.ts）。
 *
 * 缓冲页本体是 index.html 里的静态节点 #app-splash（JS 包到达前就上屏，
 * 避免白屏）。本模块只做三件事：
 *   - initSplash()：main.tsx 挂载前调用——置 data-ctl 接管标记
 *     （index.html 内联兜底据此放行），订 store 刷新进度条/错误卡，
 *     绑 Try again（整单重跑，见 boot.retryBoot）。
 *   - status 'ready'（资源真齐 + App 首帧 + 3D 场景首帧）→ 淡出移除。
 *   - status 'error' → 亮错误卡（卡死/失败/断网三种英文短句）。
 * 全部幂等，StrictMode 双挂载无副作用。
 */
import {
  getBoot,
  retryBoot,
  startBoot,
  subscribeBoot,
} from './boot';
import type { BootErrorKind, BootSnapshot } from './boot';

const FADE_MS = 340;
let inited = false;
let removed = false;
let unsubscribe: (() => void) | null = null;

const ERROR_TEXT: Record<BootErrorKind, string> = {
  fail: "Oops! Something didn't load. Check the internet, then try again.",
  stall: 'It is taking a long time to load. Check the internet, then try again.',
  offline: 'Looks like the internet stopped. Connect, then try again.',
};

interface Refs {
  bar: HTMLElement | null;
  fill: HTMLElement | null;
  note: HTMLElement | null;
  error: HTMLElement | null;
  errorText: HTMLElement | null;
  retry: HTMLButtonElement | null;
}

function render(s: BootSnapshot, el: HTMLElement, r: Refs): void {
  if (s.status === 'ready') {
    if (removed) return;
    removed = true;
    el.classList.add('splash--out');
    window.setTimeout(() => el.remove(), FADE_MS);
    unsubscribe?.();
    return;
  }
  if (s.status === 'error') {
    if (r.bar) r.bar.hidden = true;
    if (r.note) r.note.hidden = true;
    if (r.errorText) r.errorText.textContent = ERROR_TEXT[s.errorKind ?? 'stall'];
    if (r.error) r.error.hidden = false;
    r.retry?.focus();
    return;
  }
  // loading：进度 = 真实完成条数 / 总条数（无假动画）
  const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
  if (r.error) r.error.hidden = true;
  if (r.bar) {
    r.bar.hidden = false;
    r.bar.setAttribute('aria-valuenow', String(pct));
  }
  if (r.fill) r.fill.style.width = `${pct}%`;
  if (r.note) {
    r.note.hidden = false;
    r.note.textContent = `Getting ready… ${pct}%`;
  }
}

export function initSplash(): void {
  const el = document.getElementById('app-splash');
  if (!el || inited) return;
  inited = true;
  el.setAttribute('data-ctl', '1'); // 接管标记：index.html 内联兜底放行
  const r: Refs = {
    bar: el.querySelector<HTMLElement>('.splash-bar'),
    fill: el.querySelector<HTMLElement>('.splash-bar-fill'),
    note: el.querySelector<HTMLElement>('.splash-note'),
    error: el.querySelector<HTMLElement>('.splash-error'),
    errorText: el.querySelector<HTMLElement>('.splash-error-text'),
    retry: el.querySelector<HTMLButtonElement>('.splash-retry'),
  };
  if (r.retry) r.retry.onclick = () => retryBoot();
  unsubscribe = subscribeBoot((s) => render(s, el, r));
  startBoot();
  render(getBoot(), el, r);
}
