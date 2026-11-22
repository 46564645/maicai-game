/**
 * Board3D.tsx —— 3D 棋盘视图（BoardView 接口的 R3F 实现，与 Board2D 同签名）。
 * Canvas 铺底（aria-hidden，读屏走 DOM 层）；children（「进入这一站」等）
 * 以 DOM overlay 盖在画布中下部；右上角 DOM「回默认视角」按钮。
 * 消息减负审计 B3：画布下的 .board3d-status 文字状态行已删——圈数看
 * 进度簇、站名看弹窗标题浮签、轮到谁看角落卡高光，同屏不第三次复读。
 * 由 BoardMount 以 React.lazy 分包加载，首屏不阻塞。
 */
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { strings } from '../../data/strings';
import type { BoardViewProps } from '../BoardView';
import { QualityProvider, useQuality } from './QualityProvider';
import { Scene } from './Scene';

/**
 * T4 手机档廉价镜头：不用后期链（零 WebGL 成本、不新增分包），
 * 用 CSS backdrop-filter 在画布上下各铺一条渐隐虚化带 + 一层暗角，
 * 近似桌面移轴的「桌上模型」感。仅 medium 档渲染（flags.lens）；
 * PerformanceMonitor 降到 low 或 ?fx=0 时自动消失。
 */
function PhoneLens() {
  const { flags } = useQuality();
  if (!flags.lens) return null;
  return (
    <div className="board3d-lens" aria-hidden="true">
      <div className="board3d-lens-band board3d-lens-band--top" />
      <div className="board3d-lens-band board3d-lens-band--bottom" />
      <div className="board3d-lens-vignette" />
    </div>
  );
}

export default function Board3D(
  props: BoardViewProps & {
    children?: ReactNode;
    onReady?: () => void;
    onContextLost?: () => void;
  },
) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <QualityProvider>
      <div className="board3d" data-testid="board3d">
        <div className="board3d-canvas" aria-hidden="true">
          <Canvas
            frameloop="demand"
            shadows="percentage"
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [0, 21, 18], fov: 27, near: 0.5, far: 140 }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                props.onContextLost?.();
              });
              props.onReady?.();
            }}
          >
            <Scene board={props} resetKey={resetKey} />
          </Canvas>
        </div>
        <PhoneLens />
      </div>

      {/* 浮层移出 fixed 画布：桌面 fixed 吸底，手机回文档流，
          永远不被其它浮层盖住「进入这一站」主按钮 */}
      <div className="board3d-overlay">
        {props.children}
        <button
          type="button"
          className="board3d-reset"
          aria-label={strings.board.resetView}
          onClick={() => setResetKey((k) => k + 1)}
        >
          {strings.board.resetView}
        </button>
      </div>
    </QualityProvider>
  );
}
