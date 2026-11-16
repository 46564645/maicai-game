/**
 * Effects.tsx —— 桌面后期链（M4.5.7 织梦岛风，ART_3D §9.1/5/6 + §10）。
 * 仅 high 档挂载（Scene 里 React.lazy 子分包，手机 medium/low 永不下载）。
 * 链序：N8AO（先算接触影，要吃清晰深度）→ Bloom（HDR 亮部泛光）
 *      → TiltShift（上下移轴虚化，连 AO 一起糊出「桌上模型」感）
 *      → ToneMapping（NEUTRAL 收尾，保亮绿暖橙饱和；?tonemap=aces 对照）
 *      → HueSaturation / BrightnessContrast（显示域轻推饱和+对比）。
 * 全链无任何描边手段（无 OutlinePass/EdgesGeometry/反向外壳）。
 * 移轴清晰带中心跟着真人棋子走：每帧把棋子投影到 NDC 换算 offset（限幅 ±0.15）。
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  EffectComposer,
  HueSaturation,
  N8AO,
  TiltShift,
  ToneMapping,
} from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode } from 'postprocessing';
import type { TiltShiftEffect } from 'postprocessing';
import type { BoardViewProps } from '../BoardView';
import { pawnAnchor } from './positions';
import type { ToneMap } from './QualityProvider';

const OFFSET_LIMIT = 0.15; // 清晰带中心跟棋子的最大偏移（ww：中心 r≈0.5 跟着自己的棋子走）

export default function Effects({
  board,
  toneMap,
  ao,
}: {
  board: BoardViewProps;
  toneMap: ToneMap;
  ao: boolean;
}) {
  const tilt = useRef<TiltShiftEffect | null>(null);
  const camera = useThree((s) => s.camera);
  const v = useRef(new THREE.Vector3());
  const humanSlot = Math.max(
    0,
    board.pawns.findIndex((p) => p.colorVar === 'var(--player-you)'),
  );

  // 清晰带中心跟随真人棋子：世界坐标 → NDC.y → offset（限幅 + 平滑）
  useFrame(({ invalidate }) => {
    const e = tilt.current;
    if (!e) return;
    const a = pawnAnchor(board.stationIndex, humanSlot);
    v.current.set(a.x, 0.6, a.z).project(camera);
    const target = THREE.MathUtils.clamp(v.current.y * 0.5, -OFFSET_LIMIT, OFFSET_LIMIT);
    const cur = e.offset;
    const next = cur + (target - cur) * 0.08;
    if (Math.abs(next - cur) > 0.0008) {
      e.offset = next;
      invalidate();
    }
  });

  return (
    <EffectComposer
      multisampling={4}
      frameBufferType={THREE.HalfFloatType}
      stencilBuffer={false}
    >
      {/* 脚下接触影（N8AO，MIT；先算，要在虚化之前吃清晰深度）。
          注：不开 halfRes——vendored WebGLMultipleRenderTargets compat 的
          .texture getter 返回数组，three r187 setupRenderTarget 读
          texture.mipmaps 会崩；全分辨率 AO 仅桌面档可承受 */}
      {ao ? (
        <N8AO
          aoRadius={0.5}
          distanceFalloff={1}
          intensity={2.5}
          quality="low"
        />
      ) : (
        <></>
      )}
      {/* 淡泛光：水面高光、转盘亮面、亮黄花带一点光晕（阈值在 HDR 域工作） */}
      <Bloom
        intensity={0.25}
        luminanceThreshold={1.0}
        luminanceSmoothing={0.2}
        radius={0.4}
        mipmapBlur
      />
      {/* 移轴：上下两端虚化，中间一条（约画面高 15–20%）清楚 */}
      <TiltShift
        ref={(e) => {
          // d.ts 把 ref 标成了构造函数类型；运行时给的是 TiltShiftEffect 实例
          tilt.current = e as unknown as TiltShiftEffect;
        }}
        offset={0}
        focusArea={0.18}
        feather={0.3}
        kernelSize={KernelSize.MEDIUM}
        resolutionScale={0.5}
      />
      {/* 统一收尾：NeutralToneMapping 保亮绿暖橙（?tonemap=aces 对照组） */}
      <ToneMapping
        mode={toneMap === 'aces' ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.NEUTRAL}
      />
      {/* 显示域推升已去掉（T2 步骤 4）：WIP 的饱和 +0.2 / 对比 +0.1 叠在
          已饱和的材质上把奶油砖推成近白；材质与色板本身即 ART §9.4 的
          饱和目标，不再二次推升。HueSaturation 保留 0 值占位便于 ww 对照。 */}
      <HueSaturation saturation={0} />
    </EffectComposer>
  );
}
