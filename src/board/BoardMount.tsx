/**
 * BoardMount.tsx —— 棋盘挂载口（DEVELOPMENT §9.1，2026-11-21 改版）：
 * 棋盘永远挂载 3D。2D 回退棋盘已按 Thong 拍板整体移除——旧版的
 * 「暖机失败标记 / ?board=2d / 检测不过 / 首帧超时 / context 丢失」
 * 五条直落 2D 的路径全部取消（线上实证：Edge 打开 3121d2c 时暖机
 * 阶段一次 context 丢失就把整局毒化成 2D，孩子全程看不到 3D）。
 *
 * 现在的失败呈现只有一种：儿童友好的英文错误卡 + Try again
 * （沿用 T-2 缓冲页错误卡模式：短句 + ≥48px 按钮，样式见 board.css
 * 的 .board-error）。触发条件：WebGL 两次探测都无 / 3D 分包加载
 * 失败 / 渲染报错 / 首帧 10s 看门狗超时 / webglcontextlost。
 * Try again = 重新探测 WebGL + 全新 lazy 分包 + 全新 Canvas 重挂
 * （新 context 本身就是对 context 丢失的一次真恢复尝试），
 * 不再有任何路径渲染出可玩的 2D 棋盘。
 *
 * R1-E6 不变量延续：Suspense 占位与错误卡都不带 children——
 * children 里的全场唯一主按钮只随 Board3D 本体出现一份。
 */
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import type { BoardViewProps } from './BoardView';
import { detectWebGL } from './three/webgl';
import { PressButton } from '../components/bits/PressButton';
import { FadeContent } from '../components/motion/FadeContent';

type Props = BoardViewProps & { children?: ReactNode };

/** 3D 棋盘失败卡：与缓冲页错误卡同一模式（英文短句 + Try again）。
    WS4 D8：卡的进场改走收编 FadeContent（淡入+轻柔焦落定）；
    文案、重试流程、.board-retry 按钮样式一概不动（按钮归 WS1） */
function BoardError({ onRetry }: { onRetry: () => void }) {
  return (
    <FadeContent className="board-error" role="alert" blur={6} show>
      <p className="board-error-text">Oops! The board didn&rsquo;t start. Tap Try again.</p>
      <PressButton className="board-retry" onClick={onRetry}>
        Try again
      </PressButton>
    </FadeContent>
  );
}

class Boundary extends Component<
  { fallback: ReactNode; onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.warn('Board3D 渲染失败，显示错误卡：', err, info.componentStack);
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function BoardMount(props: Props) {
  const [attempt, setAttempt] = useState(0);
  const [glOk, setGlOk] = useState(() => detectWebGL());
  const [failed, setFailed] = useState(false);
  const readyRef = useRef(false);
  /* 每次 Try again 换一个全新的 lazy 包装：旧包装缓存了分包的
     reject 结果，不换包装重试永远解不开分包加载失败 */
  const LazyBoard3D = useMemo(
    () => lazy(() => import('./three/Board3D')),
    [attempt],
  );

  useEffect(() => {
    readyRef.current = false;
  }, [attempt]);

  /* 首帧看门狗：Canvas 10s 未创建（WebGL 慢/卡死）→ 错误卡。
     旧版在这里回退 2D；R5 把 4s 放宽到 10s 的理由不变——桌面 high
     档懒加载 Effects 子分包 + 首次着色器编译在软件渲染/低端机上
     本来就慢，10s 仍无首帧才判真失败，且失败后有 Try again。 */
  useEffect(() => {
    if (!glOk || failed) return;
    const t = window.setTimeout(() => {
      if (!readyRef.current) {
        console.warn('Board3D 首帧超时，显示错误卡');
        setFailed(true);
      }
    }, 10_000);
    return () => clearTimeout(t);
  }, [glOk, failed, attempt]);

  const retry = () => {
    setGlOk(detectWebGL());
    setFailed(false);
    setAttempt((a) => a + 1);
  };

  if (!glOk || failed) return <BoardError onRetry={retry} />;

  const onReady = () => {
    readyRef.current = true;
  };

  /* 加载占位：只占棋盘全屏区域的一块空地，不带 children（R1-E6）；
     缓冲页已把 3D 分包预载完，正式棋盘挂载时这里通常一闪而过 */
  const placeholder = <div className="board-loading" aria-hidden="true" />;

  return (
    <Boundary
      key={attempt}
      fallback={<BoardError onRetry={retry} />}
      onError={() => setFailed(true)}
    >
      <Suspense fallback={placeholder}>
        <LazyBoard3D
          {...props}
          onReady={onReady}
          onContextLost={() => {
            /* 不再降级 2D：错误卡 + Try again 重挂新 Canvas——
               新 context 即是对 GPU 进程重置类丢失的真恢复 */
            console.warn('Board3D context 丢失，显示错误卡');
            setFailed(true);
          }}
        />
      </Suspense>
    </Boundary>
  );
}
