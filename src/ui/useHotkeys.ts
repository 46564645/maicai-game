/**
 * useHotkeys.ts —— 全局键位（PLAN 4.1.3）。
 * - Enter / Space：点带 data-primary 的主按钮（无则交给原生焦点按钮）
 * - 1–9：点带 data-key="n" 的第 n 个选项
 * - 方向键：在带 data-testid="action-*" 的按钮间移动焦点
 * - Esc：关覆盖层栈最上层（焦点在输入框时也生效）
 * - W 钱包抽屉 / H 求助牌 / D 演示条
 * 焦点在 input/textarea/select/contenteditable 时，除 Esc 外一律不拦截。
 */
import { useEffect, useRef } from 'react';

export interface HotkeyHandlers {
  closeTopLayer: () => void;
  toggleWallet: () => void;
  toggleHelp: () => void;
  toggleDemo: () => void;
}

const ACTION_SELECTOR = '[data-testid^="action-"]:not(:disabled)';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    el !== null &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  );
}

function clickFirst(selector: string): boolean {
  /* 同键位可能有多个绑定（提议浮签与角落气泡同挂 1/2）：桌面 ≥901px
     气泡被底条裁边而 display:none（见 hud.css）——优先点有布局盒的
     可见面，兜底仍点首个命中保证命令可达（与 e2e helpers 的
     getClientRects 过滤同口径）。 */
  const els = [...document.querySelectorAll<HTMLElement>(selector)];
  const el = els.find((e) => e.getClientRects().length > 0) ?? els[0];
  if (el) {
    el.click();
    return true;
  }
  return false;
}

export function useHotkeys(handlers: HotkeyHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const h = ref.current;

      if (e.key === 'Escape') {
        h.closeTopLayer();
        return;
      }
      if (isTyping(e.target)) return;

      if (e.key === 'Enter' || e.key === ' ') {
        // 焦点在某个可点按钮上时，让原生激活它（「主按钮或焦点按钮」）；
        // 否则点页面上的主动作按钮
        const focused = (e.target as HTMLElement | null)?.closest?.(
          'button:not(:disabled)',
        );
        if (!focused && clickFirst('[data-primary="true"]:not(:disabled)')) {
          e.preventDefault();
        } else if (!focused && e.key === ' ') {
          e.preventDefault(); // 无主动作时阻止页面滚动
        }
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        if (clickFirst(`[data-key="${e.key}"]:not(:disabled)`)) e.preventDefault();
        return;
      }

      if (e.key.startsWith('Arrow')) {
        const items = Array.from(
          document.querySelectorAll<HTMLElement>(ACTION_SELECTOR),
        ).filter((el) => el.getClientRects().length > 0);
        if (items.length === 0) return;
        e.preventDefault();
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const cur = items.indexOf(document.activeElement as HTMLElement);
        items[(cur + dir + items.length) % items.length].focus();
        return;
      }

      const k = e.key.toLowerCase();
      if (k === 'w') h.toggleWallet();
      else if (k === 'h') h.toggleHelp();
      else if (k === 'd') h.toggleDemo();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
