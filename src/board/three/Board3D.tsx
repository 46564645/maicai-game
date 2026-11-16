/**
 * Board3D.tsx —— 3D 棋盘视图（BoardView 接口的 R3F 实现，与 Board2D 同签名）。
 * Canvas 铺底（aria-hidden，读屏走 DOM 层）；children（「轮到你了 / 进入这一站」
 * + 动作日志）以 DOM overlay 盖在画布中下部；右上角 DOM「回默认视角」按钮；
 * 画布下有一行 .board3d-status 文字状态（第几圈第几站、轮到谁）供读屏。
 * 由 BoardMount 以 React.lazy 分包加载，首屏不阻塞。
 */
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { strings } from '../../data/strings';
import { fmt } from '../../game/stations/shared';
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
  const station = props.stations[props.stationIndex];
  const active = props.pawns.find((p) => p.playerId === props.activePlayerId);

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

      <p className="board3d-status">
        {fmt(strings.hud.stationLabel, {
          n: props.stationIndex + 1,
          name: station?.name ?? '',
        })}{' '}
        · {fmt(strings.hud.lapLabel, { lap: props.lap })}
        {active ? ` · ${fmt(strings.game.botTurn, { name: active.name })}` : ''}
      </p>

      {/* 浮层移出 fixed 画布：桌面 fixed 吸底，手机回文档流（在状态行下、
          bot 列上），永远不被其它浮层盖住「进入这一站」主按钮 */}
      <div className="board3d-overlay">
        {props.children}
        <button
          type="button"
          className="board3d-reset"
          aria-label="Reset view"
          onClick={() => setResetKey((k) => k + 1)}
        >
          Reset view
        </button>
      </div>
    </QualityProvider>
  );
}
