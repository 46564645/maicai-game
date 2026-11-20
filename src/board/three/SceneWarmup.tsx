/**
 * SceneWarmup.tsx —— 3D 场景暖机（首次打开缓冲期的「场景首帧」真验）。
 *
 * 在屏外（opacity:0 + z-index:-1，静态 splash 盖住）按正式参数真渲：
 * GLB 解析、材质/着色器编译、Canvas 首帧全部真做——缓冲页「场景首帧
 * 已渲染」闸门的回执由此出；产物（HTTP/模块缓存）留给正式棋盘提速。
 * 与 Board3D 同一 Canvas 参数同一 Scene，但不走 BoardMount——
 * 不渲染 overlay/状态行，不带 data-testid（e2e 的 board3d 断言
 * 仍只见正式棋盘一颗）。超时/报错由 boot 记 markBoard3DFailed →
 * 本局 BoardMount 直落 2D。
 */
import { Component, useEffect, useRef } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { BoardViewProps } from '../BoardView';
import { QualityProvider } from './QualityProvider';
import { Scene } from './Scene';

class WarmBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.warn('3D 场景暖机失败，本局回退 2D：', err, info.componentStack);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** 帧探针：场景真实渲出第一帧（demand 模式的第一次 useFrame tick）回执 */
function FrameProbe({ onFrame }: { onFrame: () => void }) {
  const sent = useRef(false);
  useFrame(() => {
    if (sent.current) return;
    sent.current = true;
    onFrame();
  });
  return null;
}

export default function SceneWarmup({
  board,
  onMounted,
  onFrame,
  onFail,
}: {
  board: BoardViewProps;
  onMounted: () => void;
  onFrame: () => void;
  onFail: () => void;
}) {
  const fired = useRef(false);
  const fire = () => {
    if (fired.current) return;
    fired.current = true;
    onFrame();
  };
  useEffect(() => {
    onMounted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="scene-warmup" aria-hidden="true">
      <WarmBoundary onError={onFail}>
        <QualityProvider>
          <Canvas
            frameloop="demand"
            shadows="percentage"
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [0, 21, 18], fov: 27, near: 0.5, far: 140 }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                onFail();
              });
              /* 帧探针兜底：onCreated 后若探针迟迟未回（demand 边缘态）
                 也按「渲染器已建、首帧已发」放行 */
              window.setTimeout(fire, 2500);
            }}
          >
            <Scene board={board} resetKey={0} />
            <FrameProbe onFrame={fire} />
          </Canvas>
        </QualityProvider>
      </WarmBoundary>
    </div>
  );
}
