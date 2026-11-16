/**
 * WeatherSpinner3D.tsx —— 岛正中央的天气转盘（唯一转盘，不决定步数）。
 * 借 closing-quest roulette.ts（MIT）：canvas 画分区盘面、固定指针(flapper)
 * 被销钉拨动的弹簧抖动、「结果先定只演出」（目标角 + 加整圈 + 指数缓停）。
 * 本项目改动：3 个天气分区（晴/雨/风）、矢量图标不依赖 emoji 字体、
 * 图标是独立网格——落定后结果图标放大弹一下 + 星尘（ART_3D §8.4）；
 * 蓄力+旋转 ≤1.5s、点一下可跳过、prefers-reduced-motion 直接停到结果。
 * 相机推近由 Scene 监听 onSpinChange 交给 CameraRig。
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import { cards } from '../../data/cards';
import type { CardId } from '../../game/types';
import { PALETTE, PLASTIC, SCENE } from './materials';
import { forwardDelta, mod360, sectorTargetAngle, spinAngleAt } from './spinMath';

const WINDUP = 0.16; // 蓄力（反向小回带）秒
const WINDUP_DEG = 14;
const SPIN_DUR = 1.05; // 主旋转秒（蓄力+旋转 ≤1.5s，ART_3D §8）
const LAND_DUR = 0.6; // 落定弹图标 + 星尘
const TURNS = 2; // 额外整圈
const FLAP_LIMIT = 0.55;

const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SECTOR_FILL: Record<string, string> = {
  'wth-sunny': '#FFE9A8',
  'wth-rainy': '#CFE0FF',
  'wth-windy': '#D5F2E3',
};

/** 咔哒声：指针被销钉拨动时的小方波，无音频环境静默 */
let actx: AudioContext | null = null;
function tick() {
  try {
    actx ??= new AudioContext();
    if (actx.state === 'suspended') void actx.resume();
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'square';
    o.frequency.value = 1500;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + 0.035);
  } catch {
    /* 静默 */
  }
}

/** 盘面：奶油底 + 分区色块 + 白色分隔线 + 外圈圆点带（矢量，不依赖字体） */
function faceTexture(): THREE.CanvasTexture {
  const items = cards.weather;
  const n = items.length;
  const S = 512;
  const c = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const deg = (d: number) => (d * Math.PI) / 180;

  g.fillStyle = '#FFFDF6';
  g.beginPath();
  g.arc(c, c, c, 0, Math.PI * 2);
  g.fill();

  const segR = c * 0.84;
  for (let i = 0; i < n; i++) {
    const a0 = deg((i * 360) / n - 360 / n / 2 - 90);
    const a1 = deg((i * 360) / n + 360 / n / 2 - 90);
    g.fillStyle = SECTOR_FILL[items[i].id] ?? '#EEE7DA';
    g.beginPath();
    g.moveTo(c, c);
    g.arc(c, c, segR, a0, a1);
    g.closePath();
    g.fill();
    // 柔和高光：外缘一层淡白
    g.save();
    g.clip();
    const grad = g.createRadialGradient(c, c, segR * 0.5, c, c, segR);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,0.3)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    g.restore();
  }

  g.strokeStyle = '#FFFFFF';
  g.lineWidth = c * 0.018;
  for (let i = 0; i < n; i++) {
    const a = deg((i * 360) / n + 360 / n / 2 - 90);
    g.beginPath();
    g.moveTo(c + Math.cos(a) * c * 0.18, c + Math.sin(a) * c * 0.18);
    g.lineTo(c + Math.cos(a) * segR, c + Math.sin(a) * segR);
    g.stroke();
  }
  g.lineWidth = c * 0.024;
  g.beginPath();
  g.arc(c, c, segR, 0, Math.PI * 2);
  g.stroke();

  // 外圈圆点带
  g.fillStyle = '#F3DFB8';
  g.beginPath();
  g.arc(c, c, c * 0.985, 0, Math.PI * 2);
  g.arc(c, c, segR + c * 0.014, 0, Math.PI * 2, true);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 24; i++) {
    const a = deg(i * 15 - 90);
    g.beginPath();
    g.arc(c + Math.cos(a) * c * 0.92, c + Math.sin(a) * c * 0.92, c * 0.014, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 8;
  return t;
}

/** 分区图标：透明底矢量天气图（晴=太阳、雨=云雨、风=风纹） */
function iconTexture(id: CardId): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (id === 'wth-sunny') {
    g.strokeStyle = PALETTE.orange;
    g.lineWidth = 7;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 40, 62 + Math.sin(a) * 40);
      g.lineTo(64 + Math.cos(a) * 53, 62 + Math.sin(a) * 53);
      g.stroke();
    }
    g.fillStyle = PALETTE.yellow;
    g.beginPath();
    g.arc(64, 62, 27, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = PALETTE.orange;
    g.lineWidth = 4;
    g.stroke();
  } else if (id === 'wth-rainy') {
    g.fillStyle = '#EFF7FF';
    g.strokeStyle = PALETTE.blue;
    g.lineWidth = 4;
    for (const [x, y, r] of [
      [46, 58, 16],
      [66, 50, 20],
      [86, 60, 14],
    ] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.strokeStyle = PALETTE.blue;
    g.lineWidth = 6;
    for (const x of [48, 66, 84]) {
      g.beginPath();
      g.moveTo(x, 86);
      g.lineTo(x - 5, 100);
      g.stroke();
    }
  } else {
    // wth-windy 及未知天气兜底：两道风纹
    g.strokeStyle = '#4FBF98';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(28, 54);
    g.quadraticCurveTo(70, 46, 88, 54);
    g.quadraticCurveTo(102, 60, 96, 72);
    g.stroke();
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(40, 80);
    g.quadraticCurveTo(64, 74, 80, 80);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

type Phase = 'idle' | 'windup' | 'spin' | 'land';

export interface SpinCtl {
  skip: () => void;
}

export function WeatherSpinner3D({
  weather,
  shadows,
  onSpinChange,
  spinCtl,
}: {
  weather?: { id: CardId | null; nonce: number };
  shadows: boolean;
  onSpinChange?: (spinning: boolean) => void;
  spinCtl?: MutableRefObject<SpinCtl>;
}) {
  const items = cards.weather;
  const count = items.length;
  const segDeg = 360 / count;

  const wheel = useRef<THREE.Group>(null);
  const flapper = useRef<THREE.Group>(null);
  const iconMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const burst = useRef<THREE.Group>(null);
  const burstMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: PALETTE.yellow,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );

  const face = useMemo(() => faceTexture(), []);
  const icons = useMemo(() => items.map((w) => iconTexture(w.id)), [items]);

  const st = useRef({
    phase: 'idle' as Phase,
    angle: 0,
    from: 0,
    spinFrom: 0,
    total: 0,
    finalAngle: 0,
    t0: 0,
    resultIdx: 0,
    popIdx: -1,
    flap: 0,
    flapVel: 0,
    lastKey: '',
  });

  const startSpin = (id: CardId, now: number, invalidate: () => void) => {
    const s = st.current;
    // 上一次落定演出没收尾就重置（连转无缝衔接）
    const prevPop = iconMeshes.current[s.popIdx];
    if (prevPop) prevPop.scale.setScalar(1);
    s.popIdx = -1;
    burstMat.opacity = 0;
    if (burst.current) burst.current.visible = false;
    s.resultIdx = Math.max(0, items.findIndex((w) => w.id === id));
    if (reduced) {
      s.angle = sectorTargetAngle(s.resultIdx, count);
      s.phase = 'idle';
      return;
    }
    s.from = s.angle; // 从当前角度蓄力重转（连转自然衔接）
    s.phase = 'windup';
    s.t0 = now;
    onSpinChange?.(true);
    invalidate();
  };

  const landNow = (now: number) => {
    const s = st.current;
    s.phase = 'land';
    s.t0 = now;
    s.popIdx = s.resultIdx;
    onSpinChange?.(false); // 落定即回俯视（借 closing-quest 焦点切换）
  };

  const nowRef = useRef(0); // useFrame 时钟（skip 与 phase 同一时基）

  const skip = () => {
    const s = st.current;
    const now = nowRef.current;
    if (s.phase === 'windup' || s.phase === 'spin') {
      const base = sectorTargetAngle(s.resultIdx, count);
      s.finalAngle =
        s.phase === 'spin'
          ? s.finalAngle
          : s.from - WINDUP_DEG + TURNS * 360 + forwardDelta(s.from - WINDUP_DEG, base);
      s.angle = s.finalAngle;
      landNow(now);
    } else if (s.phase === 'land') {
      s.t0 = now - LAND_DUR;
    }
  };

  useEffect(() => {
    if (spinCtl) spinCtl.current = { skip };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinCtl]);

  useFrame(({ clock, invalidate }, dt) => {
    const s = st.current;
    const now = clock.elapsedTime;
    nowRef.current = now;
    const key = weather?.id ? `${weather.nonce}:${weather.id}` : '';

    // 触发：weather.id 出现且 (nonce,id) 变化 → 开转；id 消失（离站）→ 收工
    if (key !== s.lastKey) {
      s.lastKey = key;
      if (key && weather?.id) startSpin(weather.id, now, invalidate);
      else if (s.phase !== 'idle') {
        s.phase = 'idle';
        s.popIdx = -1;
        burstMat.opacity = 0;
        if (burst.current) burst.current.visible = false;
        onSpinChange?.(false);
      }
    }

    const h = Math.min(dt, 0.05);

    if (s.phase === 'windup') {
      const k = Math.min(1, (now - s.t0) / WINDUP);
      s.angle = s.from - WINDUP_DEG * (1 - (1 - k) * (1 - k)); // easeOutQuad 回带
      if (k >= 1) {
        const delta = forwardDelta(s.angle, sectorTargetAngle(s.resultIdx, count));
        s.total = TURNS * 360 + delta;
        s.finalAngle = s.angle + s.total;
        s.spinFrom = s.angle;
        s.phase = 'spin';
        s.t0 = now;
      }
      invalidate();
    } else if (s.phase === 'spin') {
      const t = now - s.t0;
      const prev = s.angle;
      s.angle = spinAngleAt(s.spinFrom, s.total, t, SPIN_DUR);
      // 销钉过指针 → 拨一下指针 + 咔哒声（借 roulette.ts 的 pin 碰撞思路，简化为过点脉冲）
      const dA = s.angle - prev;
      for (let i = 0; i < count; i++) {
        const b = i * segDeg + segDeg / 2;
        if (mod360(prev + b) > mod360(s.angle + b)) {
          s.flapVel += Math.min(9, 2.4 + (dA / Math.max(h, 1e-4)) * 0.02);
          tick();
        }
      }
      if (t >= SPIN_DUR) {
        s.angle = s.finalAngle;
        landNow(now);
      }
      invalidate();
    } else if (s.phase === 'land') {
      const k = Math.min(1, (now - s.t0) / LAND_DUR);
      const pop = iconMeshes.current[s.popIdx];
      if (pop) pop.scale.setScalar(1 + 0.42 * Math.sin(Math.PI * k) * (1 - k * 0.25));
      burstMat.opacity = (1 - k) * 0.9;
      if (burst.current) {
        burst.current.visible = true;
        burst.current.scale.setScalar(0.5 + k * 1.2);
      }
      if (k >= 1) {
        if (pop) pop.scale.setScalar(1);
        s.popIdx = -1;
        burstMat.opacity = 0;
        if (burst.current) burst.current.visible = false;
        s.phase = 'idle';
      }
      invalidate();
    }

    // 指针弹簧（+阻尼回中），只在有动静时耗帧
    if (Math.abs(s.flap) > 1e-4 || Math.abs(s.flapVel) > 1e-3) {
      s.flapVel += (-110 * s.flap - 7 * s.flapVel) * h;
      s.flap += s.flapVel * h;
      if (s.flap > FLAP_LIMIT) {
        s.flap = FLAP_LIMIT;
        s.flapVel = Math.min(s.flapVel, 0);
      } else if (s.flap < -FLAP_LIMIT) {
        s.flap = -FLAP_LIMIT;
        s.flapVel = Math.max(s.flapVel, 0);
      }
      invalidate();
    } else {
      s.flap = 0;
      s.flapVel = 0;
    }

    if (wheel.current) wheel.current.rotation.y = -THREE.MathUtils.degToRad(s.angle);
    if (flapper.current) flapper.current.rotation.y = s.flap;
  });

  const segRad = (i: number) => THREE.MathUtils.degToRad(i * segDeg);

  return (
    <group position={[0, 0, -0.4]}>
      {/* 底座：奶油色圆碟托 */}
      <mesh position-y={0.12} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[1.66, 1.82, 0.24, 40]} />
        <meshPhysicalMaterial color={SCENE.islandSide} {...PLASTIC} />
      </mesh>
      <mesh position-y={0.28} receiveShadow={shadows}>
        <cylinderGeometry args={[1.6, 1.66, 0.12, 40]} />
        <meshPhysicalMaterial color="#FFFDF6" {...PLASTIC} />
      </mesh>

      {/* 转轮（children 全随 rotation.y 转） */}
      <group ref={wheel}>
        <mesh position-y={0.35} castShadow={shadows}>
          <cylinderGeometry args={[1.5, 1.54, 0.14, 40]} />
          <meshPhysicalMaterial color="#FFFDF6" {...PLASTIC} />
        </mesh>
        <mesh position-y={0.425} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.44, 48]} />
          <meshPhysicalMaterial map={face} {...PLASTIC} />
        </mesh>
        {/* 分区图标（独立平面：落定后结果图标可放大弹） */}
        {items.map((w, i) => (
          <mesh
            key={w.id}
            ref={(m) => {
              iconMeshes.current[i] = m;
            }}
            position={[Math.sin(segRad(i)) * 0.85, 0.432, -Math.cos(segRad(i)) * 0.85]}
            rotation-x={-Math.PI / 2}
          >
            <planeGeometry args={[0.92, 0.92]} />
            <meshBasicMaterial map={icons[i]} transparent depthWrite={false} />
          </mesh>
        ))}
        {/* 销钉：立在分区边界，过指针时拨动 flap */}
        {items.map((w, i) => {
          const b = THREE.MathUtils.degToRad(i * segDeg + segDeg / 2);
          return (
            <mesh
              key={`pin-${w.id}`}
              position={[Math.sin(b) * 1.36, 0.55, -Math.cos(b) * 1.36]}
              castShadow={shadows}
            >
              <cylinderGeometry args={[0.045, 0.055, 0.3, 10]} />
              <meshPhysicalMaterial color={SCENE.wood} {...PLASTIC} />
            </mesh>
          );
        })}
        {/* 中轴帽 */}
        <mesh position-y={0.52} scale={[1, 0.62, 1]} castShadow={shadows}>
          <sphereGeometry args={[0.28, 18, 12]} />
          <meshPhysicalMaterial color={PALETTE.purple} {...PLASTIC} />
        </mesh>
      </group>

      {/* 固定指针（flapper）：支点在 -z，叶片朝盘心，被销钉拨得轻颤 */}
      <group ref={flapper} position={[0, 0, -1.84]}>
        <mesh position-y={0.42} castShadow={shadows}>
          <cylinderGeometry args={[0.13, 0.17, 0.44, 16]} />
          <meshPhysicalMaterial color="#FFFDF6" {...PLASTIC} />
        </mesh>
        <mesh position={[0, 0.6, 0.25]} rotation-x={Math.PI / 2} castShadow={shadows}>
          <coneGeometry args={[0.13, 0.5, 4]} />
          <meshPhysicalMaterial color={PALETTE.orange} {...PLASTIC} />
        </mesh>
      </group>

      {/* 落定星尘：一圈小星星 + 扩散环 */}
      <group ref={burst} visible={false} position={[0, 0.5, -1.05]}>
        {[
          [0.3, 0.12, 0],
          [-0.26, 0.2, 0.16],
          [0.1, 0.26, -0.28],
          [-0.14, 0.1, -0.26],
          [0.24, 0.2, 0.26],
        ].map((p, i) => (
          <mesh key={i} position={[p[0], p[1], p[2]]} material={burstMat}>
            <octahedronGeometry args={[0.06]} />
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2} material={burstMat}>
          <ringGeometry args={[0.3, 0.42, 28]} />
        </mesh>
      </group>
    </group>
  );
}
