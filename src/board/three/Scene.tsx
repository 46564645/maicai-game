/**
 * Scene.tsx —— 3D 场景组装：斜阳长影 + 半球光补环境、岛、街道环路、棋子、
 * 球簇树/石头/花点缀、中央天气转盘（M4.5.3）、相机、画质桥、HDRI 环境反光、
 * 花草灌木撒布（M4.5.7 Flora）、桌面后期链（Effects，React.lazy 子包）。
 * 风格：织梦岛塑料玩具感（ART_3D §9），场景内不放文字。
 */
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { RGBELoader } from 'three-stdlib';
import type { BoardViewProps } from '../BoardView';
import { PLASTIC, SCENE } from './materials';
import { Island } from './Island';
import { StreetLoop } from './StreetLoop';
import { StationProps } from './StationProps';
import { Piece } from './Piece';
import { WeatherSpinner3D } from './WeatherSpinner3D';
import type { SpinCtl } from './WeatherSpinner3D';
import { CoinFly } from './CoinFly';
import { CameraRig } from './CameraRig';
import { Flora } from './Flora';
import { useQuality } from './QualityProvider';
import { useAmbient } from './ambient';

/** 桌面后期链（N8AO+Bloom+TiltShift+调色）子分包：仅 high 档加载，手机永不下载 */
const Effects = lazy(() => import('./Effects'));

/** 画质桥：把 flags 同步到 renderer（阴影/dpr/toneMapping），掉帧逐档降 */
function QualityBridge({ sunRef }: { sunRef: React.RefObject<THREE.DirectionalLight | null> }) {
  const { flags, degrade } = useQuality();
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    gl.shadowMap.enabled = flags.shadowMapSize > 0;
    setDpr(Math.min(window.devicePixelRatio, flags.dpr[1]));
    gl.toneMapping =
      flags.toneMap === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping;
    gl.toneMappingExposure = 1.0;
    const sun = sunRef.current;
    if (sun) {
      sun.shadow.mapSize.setScalar(flags.shadowMapSize || 1024);
      sun.shadow.map?.dispose();
      sun.shadow.map = null; // 让 three 按新尺寸重建
    }
    invalidate(); // demand 模式：档位变化也要重绘
  }, [flags, gl, setDpr, sunRef, invalidate]);

  // 持续掉帧 → 自动逐档降（仍不行时 BoardMount 的看门狗/报错兜底回 2D）
  return <PerformanceMonitor onDecline={degrade} />;
}

/** 轻量环境反光：equirect HDR → PMREM → scene.environment
 * （等价 drei <Environment files>，但不拉 GroundProjectedEnv/presets，省分包体积） */
function EnvironmentLite({ url }: { url: string }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let cancelled = false;
    let env: THREE.Texture | null = null;
    new RGBELoader().load(url, (hdr) => {
      if (cancelled) {
        hdr.dispose();
        return;
      }
      const pm = new THREE.PMREMGenerator(gl);
      env = pm.fromEquirectangular(hdr).texture;
      hdr.dispose();
      pm.dispose();
      scene.environment = env;
      invalidate(); // demand 模式：反光就绪后补一帧
    });
    return () => {
      cancelled = true;
      scene.environment = null;
      env?.dispose();
      invalidate();
    };
  }, [url, gl, scene, invalidate]);
  return null;
}

/** 岛缘球簇树（ART §9.8 一切都圆润：树像一团团球），塑料光泽、轻轻摇 */
function Tree({ x, z, s = 1, shadows }: { x: number; z: number; s?: number; shadows: boolean }) {
  const crown = useRef<THREE.Group>(null);
  const phase = x * 0.7 + z * 1.3;
  useAmbient(80, (t) => {
    if (crown.current) {
      crown.current.rotation.z = Math.sin(t * 0.9 + phase) * 0.05;
      crown.current.rotation.x = Math.sin(t * 0.7 + phase * 1.3) * 0.03;
    }
  });
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position-y={0.3} castShadow={shadows}>
        <cylinderGeometry args={[0.09, 0.13, 0.6, 10]} />
        <meshPhysicalMaterial color={SCENE.trunk} {...PLASTIC} />
      </mesh>
      <group ref={crown}>
        <mesh position-y={0.95} castShadow={shadows}>
          <sphereGeometry args={[0.52, 16, 12]} />
          <meshPhysicalMaterial color={SCENE.leaf} {...PLASTIC} />
        </mesh>
        <mesh position={[0.34, 0.7, 0.12]} castShadow={shadows}>
          <sphereGeometry args={[0.3, 14, 10]} />
          <meshPhysicalMaterial color={SCENE.leaf} {...PLASTIC} />
        </mesh>
        <mesh position={[-0.3, 0.74, -0.1]} castShadow={shadows}>
          <sphereGeometry args={[0.26, 14, 10]} />
          <meshPhysicalMaterial color={SCENE.bush} {...PLASTIC} />
        </mesh>
      </group>
    </group>
  );
}

/** 小云朵：棉花糖状，慢慢漂（ART_3D §8.6） */
function Cloud({ p, s }: { p: readonly [number, number, number]; s: number }) {
  const g = useRef<THREE.Group>(null);
  useAmbient(110, (t) => {
    if (g.current) {
      g.current.position.x = p[0] + Math.sin(t * 0.1 + p[2]) * 1.3;
      g.current.position.y = p[1] + Math.sin(t * 0.16 + p[0]) * 0.3;
    }
  });
  return (
    <group ref={g} position={[p[0], p[1], p[2]]} scale={[s, s * 0.62, s]}>
      <mesh>
        <sphereGeometry args={[0.9, 14, 10]} />
        <meshStandardMaterial color="#FFF8EE" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0.95, -0.12, 0]}>
        <sphereGeometry args={[0.6, 14, 10]} />
        <meshStandardMaterial color="#FFF8EE" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[-0.9, -0.15, 0.1]}>
        <sphereGeometry args={[0.55, 14, 10]} />
        <meshStandardMaterial color="#FFF8EE" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

export function Scene({
  board,
  resetKey,
}: {
  board: BoardViewProps;
  resetKey: number;
}) {
  const { flags } = useQuality();
  const shadows = flags.shadowMapSize > 0;
  // 转盘演出 → 相机焦点（推近）；孩子一拖动画布 → skip 跳过演出
  const [spinning, setSpinning] = useState(false);
  const spinCtl = useRef<SpinCtl>({ skip: () => {} });
  const sunRef = useRef<THREE.DirectionalLight | null>(null);

  return (
    <>
      {/* 斜阳长影（ART §9.5）：暖色低角度主光仰角约 40°，影软而长；
          半球光补环境，ambient 压低保对比 */}
      <ambientLight intensity={0.35} color="#FFF1DD" />
      <hemisphereLight args={['#BFE3FF', '#E8D7B0', 0.6]} />
      <directionalLight
        ref={sunRef}
        position={[9.5, 8, 4.5]}
        intensity={2.6}
        color="#FFF1D6"
        castShadow={shadows}
        shadow-mapSize={[flags.shadowMapSize || 1024, flags.shadowMapSize || 1024]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
      <directionalLight position={[-6, 7, -5]} intensity={0.25} color="#CFE0FF" />

      {/* HDRI 环境反光（Poly Haven CC0）：给塑料材质高光层次，不作背景 */}
      {flags.env && <EnvironmentLite url="./env/spruit_sunrise_512.hdr" />}

      {/* fog 只做地平线柔化：起点必须在 T5 fit 距离（≈40–52）之外，
          否则整岛被雾洗白（首版 fit 实拍教训）。
          R5 修正：FIT_RECT 收紧后机位拉远到 ≈43，画角处水面距相机
          70–90，已进 60–120 雾程 → 帧角水面被雾洗成底色、渐变盘边
          缘露出（A1 不达标）。按 DISCUSSION_R5 round-1 预案改 90–180：
          画角水面几乎无雾、深水平面铺满全屏；岛体距相机 ≈40 不受影响；
          绝不低于 60（T5 教训）。 */}
      <fog attach="fog" args={['#E7F1F7', 90, 180]} />

      <Island shadows={shadows} />
      <StreetLoop stations={board.stations} shadows={shadows} />
      {board.stations.map((s) => (
        <StationProps key={s.id} station={s} shadows={shadows} />
      ))}
      <WeatherSpinner3D
        weather={board.weather}
        shadows={shadows}
        onSpinChange={setSpinning}
        spinCtl={spinCtl}
      />

      {/* 岛缘球簇树 + 石头（花草灌木撒布交给 Flora，不堆满） */}
      <Tree x={-6.7} z={-4.4} s={1.05} shadows={shadows} />
      <Tree x={6.8} z={-4.6} s={0.85} shadows={shadows} />
      <Tree x={-6.6} z={4.6} s={0.9} shadows={shadows} />
      <Tree x={6.7} z={4.5} s={1.15} shadows={shadows} />
      <mesh position={[-5.9, 0.16, 5.0]} castShadow={shadows}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshPhysicalMaterial color={SCENE.stone} {...PLASTIC} />
      </mesh>
      <mesh position={[6.1, 0.13, -5.0]} castShadow={shadows}>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshPhysicalMaterial color={SCENE.stone} {...PLASTIC} />
      </mesh>

      {/* 地面花草灌木栅栏（ART §9.7：沿路撒满、不留大片空白） */}
      <Flora density={flags.flora} shadows={shadows} />

      {/* 两朵小云：压扁的圆球拼的棉花糖云，慢慢漂给天空一点活气 */}
      <Cloud p={[-10.5, 5.2, -8]} s={0.9} />
      <Cloud p={[10.5, 6.2, -7]} s={0.75} />

      {/* 硬币飞行动画：最近一次得失币（流水派生） */}
      <CoinFly fx={board.fx} stationIndex={board.stationIndex} pawns={board.pawns} />

      {/* 4 枚棋子：同站 2×2 站位，当前行动者高亮 */}
      {board.pawns.map((p, i) => (
        <Piece
          key={p.playerId}
          pawn={p}
          stationIndex={board.stationIndex}
          slot={i}
          active={p.playerId === board.activePlayerId}
          shadows={shadows}
        />
      ))}

      <CameraRig
        followStation={board.stationIndex}
        resetKey={resetKey}
        focus={spinning ? 'spinner' : 'auto'}
        compact={board.compact ?? false}
        onUserGesture={() => spinCtl.current.skip()}
      />
      <QualityBridge sunRef={sunRef} />

      {/* 桌面后期链：移轴虚化上下两端 + 泛光 + 接触影 + 调色（仅 high 档） */}
      {flags.post && (
        <Suspense fallback={null}>
          <Effects board={board} toneMap={flags.toneMap} ao={flags.ao} />
        </Suspense>
      )}
    </>
  );
}
