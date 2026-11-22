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
    // 交互审 U2：初始焦点落弹窗容器本身（.popup 本就带 tabIndex={-1}），
    // 不再落第一个可聚焦子元素——市场/小卖部的卡是「焦点即选中」，
    // 旧版把焦点给第一张摊卡，等于面板一开就替孩子选好第一张、Buy
    // 直接待命（与已撤的 useState 预选同罪，实测两面板都中招）。
    // 容器不进 Tab 序：Tab 照常走第一个控件，焦点即选中的键盘流
    // 不变，只是开局不预选。
    el.focus({ preventScroll: true });

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
      // 焦点在容器本身（初始态）按 Shift+Tab = 想往回绕到最后一项
      if (e.shiftKey && (cur === first || cur === el)) {
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
