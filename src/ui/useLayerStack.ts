/**
 * useLayerStack.ts —— 可 Esc 的覆盖层栈：求助卡 > 钱包抽屉 > 演示条。
 * Esc 只关最上层（useHotkeys 调 closeTop）。站点弹窗不进栈。
 */
import { useCallback, useState } from 'react';

export type LayerId = 'help' | 'wallet' | 'demo';

export function useLayerStack() {
  const [stack, setStack] = useState<LayerId[]>([]);

  const openLayer = useCallback((id: LayerId) => {
    setStack((s) => (s.includes(id) ? s : [...s, id]));
  }, []);
  const closeLayer = useCallback((id: LayerId) => {
    setStack((s) => s.filter((x) => x !== id));
  }, []);
  const toggleLayer = useCallback((id: LayerId) => {
    setStack((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);
  const closeTop = useCallback(() => {
    setStack((s) => (s.length > 0 ? s.slice(0, -1) : s));
  }, []);
  const isOpen = useCallback((id: LayerId) => stack.includes(id), [stack]);

  return { stack, openLayer, closeLayer, toggleLayer, closeTop, isOpen };
}

export type LayerStack = ReturnType<typeof useLayerStack>;
