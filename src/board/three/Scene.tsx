/**
 * Scene.tsx —— 3D 场景组装：斜阳长影 + 半球光补环境、岛、街道环路、棋子、
 * 球簇树/石头/花点缀、中央天气转盘（M4.5.3）、相机、画质桥、HDRI 环境反光、
 * 花草灌木撒布（M4.5.7 Flora）、桌面后期链（Effects，React.lazy 子包）。
 * 风格：织梦岛塑料玩具感（ART_3D §9），场景内不放文字。
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { RGBELoader } from 'three-stdlib';
import type { BoardViewProps } from '../BoardView';
import { weatherDressFor } from '../../ui/weatherMoment';
import type { WeatherDress } from '../../ui/weatherMoment';
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
import { fastMode, reducedMotion, useAmbient } from './ambient';

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

/** 小云朵：棉花糖状，慢慢漂（ART_3D §8.6）。
 *  R10E：drift=风天加速（tint=雨天染灰）由天气布景驱动 */
function Cloud({
  p,
  s,
  drift = 1,
  tint = '#FFF8EE',
}: {
  p: readonly [number, number, number];
  s: number;
  drift?: number;
  tint?: string;
}) {
  const g = useRef<THREE.Group>(null);
  useAmbient(110, (t) => {
    if (g.current) {
      g.current.position.x = p[0] + Math.sin(t * 0.1 * drift + p[2]) * 1.3 * drift;
      g.current.position.y = p[1] + Math.sin(t * 0.16 * drift + p[0]) * 0.3;
    }
  });
  return (
    <group ref={g} position={[p[0], p[1], p[2]]} scale={[s, s * 0.62, s]}>
      <mesh>
        <sphereGeometry args={[0.9, 14, 10]} />
        <meshStandardMaterial color={tint} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0.95, -0.12, 0]}>
        <sphereGeometry args={[0.6, 14, 10]} />
        <meshStandardMaterial color={tint} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[-0.9, -0.15, 0.1]}>
        <sphereGeometry args={[0.55, 14, 10]} />
        <meshStandardMaterial color={tint} roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

/* —— R10E（§2 天气布景）：落定天气给世界换装。
   雨=斜丝阵 + 云染灰；风=云快三倍 + 追加一朵掠岛云；晴=光更暖。
   灯光/雾色 900ms 渐变（reduced-motion 120ms 一步到），雨丝 ~15fps
   节流（与 ambient 同一预算）。引擎结果不动，这里全是演出。 */
const DRESS_TARGETS = {
  clear: {
    sun: 2.6, sunC: '#FFF1D6', amb: 0.35, ambC: '#FFF1DD',
    hemi: 0.6, hemiS: '#BFE3FF', hemiG: '#E8D7B0',
    fill: 0.25, fog: '#E7F1F7',
  },
  sunny: {
    sun: 3.0, sunC: '#FFE0A8', amb: 0.4, ambC: '#FFF3E0',
    hemi: 0.62, hemiS: '#BFE3FF', hemiG: '#EFDCAF',
    fill: 0.3, fog: '#E9F3F8',
  },
  rainy: {
    sun: 1.25, sunC: '#D9E4EF', amb: 0.32, ambC: '#DCE6F0',
    hemi: 0.72, hemiS: '#9FB4CC', hemiG: '#9BA6B2',
    fill: 0.16, fog: '#C0CCD6',
  },
  windy: {
    sun: 2.35, sunC: '#FFF1D6', amb: 0.36, ambC: '#F0F4EC',
    hemi: 0.68, hemiS: '#A9CBDD', hemiG: '#E8D7B0',
    fill: 0.28, fog: '#DCEBF0',
  },
} as const;
type DressKey = keyof typeof DRESS_TARGETS;

/** 灯光/雾色向目标渐变（rAF ~900ms，demand 模式下每步 invalidate） */
function WeatherDresser({
  dress,
  sunRef,
  ambRef,
  hemiRef,
  fillRef,
  fogRef,
}: {
  dress: DressKey;
  sunRef: React.RefObject<THREE.DirectionalLight | null>;
  ambRef: React.RefObject<THREE.AmbientLight | null>;
  hemiRef: React.RefObject<THREE.HemisphereLight | null>;
  fillRef: React.RefObject<THREE.DirectionalLight | null>;
  fogRef: React.RefObject<THREE.Fog | null>;
}) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const sun = sunRef.current;
    const amb = ambRef.current;
    const hemi = hemiRef.current;
    const fill = fillRef.current;
    const fog = fogRef.current;
    if (!sun || !amb || !hemi || !fill || !fog) return undefined;
    const target = DRESS_TARGETS[dress];
    const from = {
      sun: sun.intensity,
      sunC: sun.color.clone(),
      amb: amb.intensity,
      ambC: amb.color.clone(),
      hemi: hemi.intensity,
      hemiS: hemi.color.clone(),
      hemiG: hemi.groundColor.clone(),
      fill: fill.intensity,
      fog: fog.color.clone(),
    };
    const toC = new THREE.Color();
    const dur = reducedMotion || fastMode ? 120 : 900;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - k) * (1 - k);
      sun.intensity = from.sun + (target.sun - from.sun) * e;
      sun.color.copy(from.sunC).lerp(toC.set(target.sunC), e);
      amb.intensity = from.amb + (target.amb - from.amb) * e;
      amb.color.copy(from.ambC).lerp(toC.set(target.ambC), e);
      hemi.intensity = from.hemi + (target.hemi - from.hemi) * e;
      hemi.color.copy(from.hemiS).lerp(toC.set(target.hemiS), e);
      hemi.groundColor.copy(from.hemiG).lerp(toC.set(target.hemiG), e);
      fill.intensity = from.fill + (target.fill - from.fill) * e;
      fog.color.copy(from.fog).lerp(toC.set(target.fog), e);
      invalidate();
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dress, sunRef, ambRef, hemiRef, fillRef, fogRef, invalidate]);
  return null;
}

const RAIN_N = 90;
/** 雨丝阵：InstancedMesh 斜落细杆，~15fps 节流（ambient 同预算） */
function RainVeil() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () => Float32Array.from({ length: RAIN_N }, () => Math.random()),
    [],
  );
  const last = useRef(-1);
  useFrame(({ clock, invalidate }) => {
    // reduced/fast：矩阵只写一帧（不初始化会 90 个恒等阵叠成原点一坨）
    if ((reducedMotion || fastMode) && last.current >= 0) return;
    const t = clock.elapsedTime;
    if (t - last.current < 0.066) return;
    last.current = t;
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < RAIN_N; i++) {
      const sx = seeds[i];
      const x = ((i * 1.37 + sx * 3) % 16) - 8;
      const z = ((i * 2.11 + sx * 5) % 16) - 8;
      const y = 8 - ((t * (5 + sx * 3) + i * 0.9) % 9);
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0.14);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    invalidate();
  });
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, RAIN_N]}
      frustumCulled={false}
    >
      <boxGeometry args={[0.015, 0.55, 0.015]} />
      <meshBasicMaterial color="#8FA9BE" transparent opacity={0.5} />
    </instancedMesh>
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
  // R10E（§2 天气布景）：灯光/雾 refs 交给 WeatherDresser 渐变
  const ambRef = useRef<THREE.AmbientLight | null>(null);
  const hemiRef = useRef<THREE.HemisphereLight | null>(null);
  const fillRef = useRef<THREE.DirectionalLight | null>(null);
  const fogRef = useRef<THREE.Fog | null>(null);
  const dress: WeatherDress = weatherDressFor(board.weatherDress);
  const dressKey: DressKey = dress ?? 'clear';

  return (
    <>
      {/* 斜阳长影（ART §9.5）：暖色低角度主光仰角约 40°，影软而长；
          半球光补环境，ambient 压低保对比。
          R10E：四灯一雾带 ref——落定天气时 WeatherDresser 渐变换装 */}
      <ambientLight ref={ambRef} intensity={0.35} color="#FFF1DD" />
      <hemisphereLight ref={hemiRef} args={['#BFE3FF', '#E8D7B0', 0.6]} />
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
      <directionalLight ref={fillRef} position={[-6, 7, -5]} intensity={0.25} color="#CFE0FF" />

      {/* HDRI 环境反光（Poly Haven CC0）：给塑料材质高光层次，不作背景 */}
      {flags.env && <EnvironmentLite url="./env/spruit_sunrise_512.hdr" />}

      {/* fog 只做地平线柔化：起点必须在 T5 fit 距离（≈40–52）之外，
          否则整岛被雾洗白（首版 fit 实拍教训）。
          R5 修正：FIT_RECT 收紧后机位拉远到 ≈43，画角处水面距相机
          70–90，已进 60–120 雾程 → 帧角水面被雾洗成底色、渐变盘边
          缘露出（A1 不达标）。按 DISCUSSION_R5 round-1 预案改 90–180：
          画角水面几乎无雾、深水平面铺满全屏；岛体距相机 ≈40 不受影响；
          绝不低于 60（T5 教训）。 */}
      <fog ref={fogRef} attach="fog" args={['#E7F1F7', 90, 180]} />

      <Island shadows={shadows} />
      <StreetLoop stations={board.stations} shadows={shadows} />
      {/* R10E（e2e 修复）：useGLTF 的挂起会穿过 R3F portal 一路上抛到
          BoardMount 的外层 Suspense——已亮出的整棵 Board3D（含 DOM
          overlay 里的 action-primary）被 React 重新藏起 + Board2D
          兜底重挂，同一颗主按钮出现两份（一隐一现），e2e 的
          .first() 命中隐身颗即卡死。挂起必须拦在画布内的本边界：
          模型未就绪时岛面照常渲染，道具/棋子好了再进。 */}
      <Suspense fallback={null}>
        {board.stations.map((s) => (
          <StationProps key={s.id} station={s} shadows={shadows} />
        ))}
      </Suspense>
      <WeatherSpinner3D
        weather={board.weather}
        shadows={shadows}
        onSpinChange={setSpinning}
        spinCtl={spinCtl}
        quick={board.weatherQuick ?? false}
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

      {/* 两朵小云：压扁的圆球拼的棉花糖云，慢慢漂给天空一点活气。
          R10E：风天漂快三倍 + 追加一朵低掠云；雨天云染灰 */}
      <Cloud
        p={[-10.5, 5.2, -8]}
        s={0.9}
        drift={dress === 'windy' ? 3 : 1}
        tint={dress === 'rainy' ? '#D8DFE8' : '#FFF8EE'}
      />
      <Cloud
        p={[10.5, 6.2, -7]}
        s={0.75}
        drift={dress === 'windy' ? 3 : 1}
        tint={dress === 'rainy' ? '#D8DFE8' : '#FFF8EE'}
      />
      {dress === 'windy' && <Cloud p={[0, 4.4, -2]} s={0.7} drift={3.4} />}
      {dress === 'rainy' && <RainVeil />}
      <WeatherDresser
        dress={dressKey}
        sunRef={sunRef}
        ambRef={ambRef}
        hemiRef={hemiRef}
        fillRef={fillRef}
        fogRef={fogRef}
      />

      {/* 硬币飞行动画：最近一次得失币（流水派生） */}
      <CoinFly fx={board.fx} stationIndex={board.stationIndex} pawns={board.pawns} />

      {/* 4 枚棋子：同站 2×2 站位，当前行动者高亮（挂起拦截同上） */}
      <Suspense fallback={null}>
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
      </Suspense>

      <CameraRig
        followStation={board.stationIndex}
        resetKey={resetKey}
        focus={
          /* R1-E2/E3：reduced-motion 或 bot 简版（weatherQuick）时不推近，
             focus 恒 'auto'——不再只靠上游不触发 spinning（spinner 在
             quick/reduced 下本就直落不发 onSpinChange，这里再兜一层） */
          spinning && !reducedMotion && !board.weatherQuick
            ? 'spinner'
            : 'auto'
        }
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
