/**
 * useFocusTrap.ts —— 弹窗/抽屉打开时焦点进入并圈禁在内部（Tab/Shift+Tab
 * 循环），关闭后焦点还原到原元素。返回容器 ref。
 */
import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const restore = document.activeElement as HTMLElement | null;
    const items = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    // preventScroll：手机横屏右栏的滚动位置由 Game.tsx 的吸底逻辑统一管理，
    // 浏览器延迟的 focus 滚动会把竖栏从栏底拉走、盖住主按钮
    (items()[0] ?? el).focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const cur = document.activeElement as HTMLElement | null;
      // 焦点不在本层（在更上层的弹窗或遮罩外可点元素）时不接管，
      // 避免多层弹窗互抢，也让钱包/求助按钮在站点弹窗开着时可达。
      if (cur === null || !el.contains(cur)) return;
      if (e.shiftKey && cur === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && cur === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      restore?.focus?.();
    };
  }, [active]);

  return ref;
}
