/**
 * textures.ts —— 程序化 canvas 贴图（R5 画风精进，借 TEARDOWN §6.2
 * 「表面变化胜过平涂」：获奖桌游用代码生成的手绘 canvas 调制粗糙度/
 * 凹凸，而不是平 albedo + 清漆）。全部固定种子可复现、零资源体积：
 * 草地斑驳、路面砂砾、水面噪声（bump）、泡沫噪声（alpha 断点）。
 * 贴图在模块内单例生成（document 只在浏览器端用，与 materials.ts
 * 的 blobShadowTexture 同一模式）。
 */
import * as THREE from 'three';
import { SCENE } from './materials';

/** mulberry32 固定种子（与 Flora 同一发生器，撒点可复现） */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, g: c.getContext('2d')! };
}

/** 柔边椭圆斑（斑驳的主力笔触）。3×3 环绕绘制 → 贴图可无缝平铺 */
function blotch(
  g: CanvasRenderingContext2D,
  rng: () => number,
  size: number,
  color: string,
  alpha: number,
  rMin: number,
  rMax: number,
) {
  const x = rng() * size;
  const y = rng() * size;
  const r = rMin + rng() * (rMax - rMin);
  const ry = r * (0.55 + rng() * 0.5);
  const rot = rng() * Math.PI;
  g.globalAlpha = alpha;
  g.fillStyle = color;
  for (const dx of [-size, 0, size])
    for (const dy of [-size, 0, size]) {
      g.beginPath();
      g.ellipse(x + dx, y + dy, r, ry, rot, 0, Math.PI * 2);
      g.fill();
    }
  g.globalAlpha = 1;
}

/** 细砂砾点（同样 3×3 环绕 → 无缝平铺） */
function speckle(
  g: CanvasRenderingContext2D,
  rng: () => number,
  size: number,
  color: string,
  alpha: number,
  rMax: number,
) {
  const x = rng() * size;
  const y = rng() * size;
  const r = 0.6 + rng() * rMax;
  g.globalAlpha = alpha;
  g.fillStyle = color;
  for (const dx of [-size, 0, size])
    for (const dy of [-size, 0, size]) {
      g.beginPath();
      g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      g.fill();
    }
  g.globalAlpha = 1;
}

function toTexture(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export interface SurfaceMaps {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

function surfaceMaps(draw: (g: CanvasRenderingContext2D, size: number) => void, size = 512): SurfaceMaps {
  const { c, g } = makeCanvas(size);
  draw(g, size);
  return { map: toTexture(c, true), bump: toTexture(c, false) };
}

/** 草地：亮绿底 + 深浅绿斑驳 + 细点（玩具草坪的「手绘感」，幅度克制不脏） */
let grass: SurfaceMaps | null = null;
export function grassMaps(): SurfaceMaps {
  if (grass) return grass;
  const rng = mulberry32(20261116);
  grass = surfaceMaps((g, size) => {
    g.fillStyle = SCENE.islandTop;
    g.fillRect(0, 0, size, size);
    // opt/visual V1：割草条纹——6 道纵带交替微明/微暗，草皮先有大
    // 结构再叠斑驳，中央草坪不再是一整块平绿（单幅覆盖不平铺）
    for (let b = 0; b < 6; b++) {
      g.fillStyle = b % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(18,74,18,0.055)';
      g.fillRect(Math.floor((b * size) / 6), 0, Math.ceil(size / 6), size);
    }
    const tones = ['#57B843', '#6BD155', '#5CBF47', '#71D45C', '#4FAE3E'];
    for (let i = 0; i < 900; i++) {
      blotch(g, rng, size, tones[i % tones.length], 0.05 + rng() * 0.07, 8, 42);
    }
    for (let i = 0; i < 2400; i++) {
      speckle(g, rng, size, rng() < 0.5 ? '#4FAE3E' : '#83DC68', 0.05 + rng() * 0.08, 1.8);
    }
  });
  return grass;
}

/** 路面：暖沙底 + 砂砾点 + 淡云斑（积木路面的颗粒感） */
let road: SurfaceMaps | null = null;
export function roadMaps(): SurfaceMaps {
  if (road) return road;
  const rng = mulberry32(20261117);
  road = surfaceMaps((g, size) => {
    g.fillStyle = SCENE.roadBed;
    g.fillRect(0, 0, size, size);
    const tones = ['#D9A95E', '#E8BE78', '#D2A355', '#EFC987'];
    for (let i = 0; i < 500; i++) {
      blotch(g, rng, size, tones[i % tones.length], 0.05 + rng() * 0.07, 10, 52);
    }
    for (let i = 0; i < 3200; i++) {
      speckle(g, rng, size, rng() < 0.55 ? '#C99B52' : '#F2CD8C', 0.06 + rng() * 0.1, 1.6);
    }
  });
  return road;
}

/** 通用灰度噪声（水面 bump：中灰底 + 柔和明暗团） */
let waterNoise: THREE.CanvasTexture | null = null;
export function waterNoiseTexture(): THREE.CanvasTexture {
  if (waterNoise) return waterNoise;
  const rng = mulberry32(20261118);
  const { c, g } = makeCanvas(256);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) {
    blotch(g, rng, 256, rng() < 0.5 ? '#9A9A9A' : '#666666', 0.05 + rng() * 0.06, 6, 30);
  }
  waterNoise = toTexture(c, false);
  return waterNoise;
}

/** 泡沫断点噪声（alphaMap 用：白底 + 柔和灰斑，让泡沫环不再是完美几何环） */
let foamNoise: THREE.CanvasTexture | null = null;
export function foamNoiseTexture(): THREE.CanvasTexture {
  if (foamNoise) return foamNoise;
  const rng = mulberry32(20261119);
  const { c, g } = makeCanvas(256);
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    blotch(g, rng, 256, '#5A5A5A', 0.12 + rng() * 0.2, 8, 34);
  }
  for (let i = 0; i < 500; i++) {
    speckle(g, rng, 256, '#8A8A8A', 0.1 + rng() * 0.15, 2.2);
  }
  foamNoise = toTexture(c, false);
  return foamNoise;
}
