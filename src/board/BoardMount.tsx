/**
 * BoardMount.tsx —— 棋盘挂载口（DEVELOPMENT §9.1）：
 * ?board=2d|3d|auto 选择 + WebGL 检测 + React.lazy 分包 + Suspense +
 * ErrorBoundary + 首帧看门狗（~4s 无 onCreated 判失败）+ webglcontextlost，
 * 任何失败都自动回退 Board2D（永久兜底，不删）。未带 ?board= 时默认 auto：
 * WebGL 可用即 3D，不可用即 2D；?board=2d 强制 2D（M4.5.3 起）。
 */
import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Board2D } from './Board2D';
import type { BoardViewProps } from './BoardView';
import { boardMode, detectWebGL } from './three/webgl';

const LazyBoard3D = lazy(() => import('./three/Board3D'));

type Props = BoardViewProps & { children?: ReactNode };

class Boundary extends Component<
  { fallback: ReactNode; onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.warn('Board3D 渲染失败，回退 2D：', err, info.componentStack);
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function BoardMount(props: Props) {
  const [mode] = useState(boardMode);
  const [webglOk] = useState(() => mode !== '2d' && detectWebGL());
  const [failed, setFailed] = useState(false);
  const readyRef = useRef(false);
  const use3d = webglOk && !failed;

  // 首帧看门狗：Canvas 超时未创建（WebGL 慢/卡死）→ 回退 2D。
  // 4s → 10s（R5）：桌面 high 档懒加载 Effects 子分包 + 首次着色器编译
  // 在软件渲染/低端机上可超过 4s，看门狗误杀把能用的 3D 打回 2D。
  // 等待期间 Suspense 已在渲染 Board2D，用户观感与立即回退相同；
  // 真无 WebGL 由 detectWebGL 前置拦截，不走到这里。
  useEffect(() => {
    if (!use3d || readyRef.current) return;
    const t = window.setTimeout(() => {
      if (!readyRef.current) {
        console.warn('Board3D 首帧超时，回退 2D');
        setFailed(true);
      }
    }, 10_000);
    return () => clearTimeout(t);
  }, [use3d]);

  if (!use3d) return <Board2D {...props} />;

  const onReady = () => {
    readyRef.current = true;
  };

  return (
    <Boundary fallback={<Board2D {...props} />} onError={() => setFailed(true)}>
      <Suspense fallback={<Board2D {...props} />}>
        <LazyBoard3D {...props} onReady={onReady} onContextLost={() => setFailed(true)} />
      </Suspense>
    </Boundary>
  );
}
