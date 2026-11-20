/**
 * boat-proj-check.ts — 用真实 solveFit 相机模型投影三艘 ToyBoat 的
 * 屏幕包围盒，判断「完整可见且不被面板挡」（包围盒 ⊆ 自由矩形 =
 * 无面板区，且 ⊆ 画面）。用法：
 *   npx vite-node shots/boat-proj-check.ts [rectsJson] [boatsJson]
 * boatsJson 可选：[{"x":-13.5,"z":-8.5}, ...] 覆盖默认锚点试算。
 */
import * as THREE from 'three';
import fs from 'node:fs';
import { solveFit, type FreeRect } from '../src/board/three/fitSolver';

const DIR = new THREE.Vector3(0, 21, 18).normalize();
const MIX = { desktop: 0.12, compact: 0.05 };

const rects: Record<string, { free?: FreeRect }> = JSON.parse(
  fs.readFileSync(process.argv[2] ?? 'shots/r8_rects_e8r2.json', 'utf8'),
);
const boats: { x: number; z: number }[] = process.argv[3]
  ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
  : [
      { x: -13.5, z: -8.5 },
      { x: 15.5, z: -4 },
      { x: -15, z: 3.5 },
    ];

// 船体点云（船局部坐标，组原点在水面 y=-0.66）：按 Island.tsx 的
// ToyBoat 几何取极值点——桅顶/旗、帆三角四角、船舷盒四角、壳体
// 四向极值与船底。投影前按各船的 ry 绕 y 旋转再平移到锚点。
const BOAT_PTS: [number, number, number][] = [
  [0.02, 1.1, 0.03], // 桅顶
  [0.19, 1.17, 0.03], // 旗尖
  [0.02, 1.04, 0.03], // 帆1 上角
  [0.02, 0.2, 0.45], // 帆1 前下角
  [0.02, 0.2, -0.39], // 帆1 后下角
  [0.68, 0.42, 0.03], // 帆2 外角
  [0.0, 0.42, 0.37],
  [0.75, 0.21, 0.35],
  [0.75, 0.21, -0.35],
  [-0.75, 0.21, 0.35],
  [-0.75, 0.21, -0.35], // 船舷盒四角
  [0.84, 0, 0],
  [-0.84, 0, 0],
  [0, 0, 0.38],
  [0, 0, -0.38], // 壳体极值
  [0, -0.31, 0], // 船底
];
const BOAT_RY = [0.7, -1.1, 1.35]; // 与 Island.tsx 三艘船的 ry 对应
const BOAT_Y = -0.66;

const VIEWS: [string, number, number, boolean][] = [
  ['desktop-1280x800', 1280, 800, false],
  ['phone-874x402', 874, 402, true],
];

// 浅滩外形：圆角矩形 17.4×13.6、圆角 3.0（FoamRing 外轮廓口径）。
// 锚点到浅滩轮廓的带符号距离 ≥ 船体包围圆半径（≈1.31）才算全船在水里
function shallowsSdf(x: number, z: number): number {
  const hx = 17.4 / 2 - 3.0;
  const hz = 13.6 / 2 - 3.0;
  const qx = Math.abs(x) - hx;
  const qz = Math.abs(z) - hz;
  const ax = Math.max(qx, 0);
  const az = Math.max(qz, 0);
  return Math.hypot(ax, az) + Math.min(Math.max(qx, qz), 0) - 3.0;
}
const BOAT_R = 1.35;

interface Cam {
  cam: THREE.PerspectiveCamera;
  free: FreeRect;
  w: number;
  h: number;
}
function camFor(w: number, h: number, phone: boolean, free: FreeRect): Cam {
  const r = solveFit({
    width: w,
    height: h,
    free,
    mix: phone ? MIX.compact : MIX.desktop,
    dir: DIR,
    compact: phone,
  });
  const cam = new THREE.PerspectiveCamera(27, w / h, 0.5, 400);
  cam.position.copy(r.base).addScaledVector(DIR, r.distance);
  cam.lookAt(r.base);
  cam.updateMatrixWorld();
  return { cam, free, w, h };
}
function boatBbox(c: Cam, bx: number, bz: number, ry = 0.7) {
  const v = new THREE.Vector3();
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [lx, ly, lz] of BOAT_PTS) {
    const wx = bx + lx * cos + lz * sin;
    const wz = bz - lx * sin + lz * cos;
    v.set(wx, BOAT_Y + ly, wz).project(c.cam);
    const px = ((v.x + 1) / 2) * c.w;
    const py = ((1 - v.y) / 2) * c.h;
    x0 = Math.min(x0, px);
    x1 = Math.max(x1, px);
    y0 = Math.min(y0, py);
    y1 = Math.max(y1, py);
  }
  return { x0, y0, x1, y1 };
}

/* 搜索模式：node ... search —— 在三个候选海域网格扫锚点，找两视口
 * 包围盒都 ⊆ 自由矩形（留 4px 余量）且全船在水的锚点 */
if (process.argv[4] === 'search') {
  const cams = VIEWS.map(([name, w, h, phone]) => {
    const free = rects[name]?.free;
    if (!free) throw new Error(`no free rect for ${name}`);
    return { name, ...camFor(w, h, phone, free) };
  });
  const regions: [string, number, number, number, number, number][] = [
    // tag, xa, xb, za, zb, ry（挪哪艘船就用哪艘的 ry）
    ['TL', -15, -9.5, -12, -6.5, 0.7],
    ['TLc', -9.75, -7, -9.5, -6.25, 0.7],
    ['TRc', 7, 9.75, -9.5, -6.25, -1.1],
    ['R', 9.5, 15.5, -9.5, 3, -1.1],
    ['BL', -15, -9.5, 3, 10.5, 1.35],
    ['B', -6, 6, 7.5, 11, 1.35],
    ['T', -6, 6, -12, -8, 0.7],
  ];
  // 逐视口：每个视口各找自己的达标船（可以不是同一艘）
  for (const c of cams) {
    console.log(`== viewport ${c.name}`);
    for (const [tag, xa, xb, za, zb, ry] of regions) {
      let best: { s: number; desc: string } = { s: -Infinity, desc: '' };
      let count = 0;
      const near: string[] = [];
      for (let x = xa; x <= xb; x += 0.125)
        for (let z = za; z <= zb; z += 0.125) {
          if (shallowsSdf(x, z) < BOAT_R) continue;
          const b = boatBbox(c, x, z, ry);
          const slack = Math.min(
            b.x0 - c.free.x,
            b.y0 - c.free.y,
            c.free.x + c.free.w - b.x1,
            c.free.y + c.free.h - b.y1,
          );
          if (slack >= 4) count++;
          if (slack > best.s)
            best = {
              s: slack,
              desc: `(${x.toFixed(2)},${z.toFixed(2)}) slack=${slack.toFixed(0)} bbox ${b.x0.toFixed(0)}..${b.x1.toFixed(0)}x${b.y0.toFixed(0)}..${b.y1.toFixed(0)}`,
            };
          if (slack >= -4)
            near.push(
              `(${x.toFixed(2)},${z.toFixed(2)}) slack=${slack.toFixed(0)} bbox ${b.x0.toFixed(0)}..${b.x1.toFixed(0)}x${b.y0.toFixed(0)}..${b.y1.toFixed(0)}`,
            );
        }
      console.log(`  region ${tag}: ok=${count} best: ${best.desc}`);
      near
        .sort((a, b2) => Number(b2.match(/slack=(-?\d+)/)?.[1]) - Number(a.match(/slack=(-?\d+)/)?.[1]))
        .slice(0, 5)
        .forEach((s) => console.log(`    near: ${s}`));
    }
  }
  process.exit(0);
}

for (const [name, w, h, phone] of VIEWS) {
  const free = rects[name]?.free;
  if (!free) continue;
  const r = solveFit({
    width: w,
    height: h,
    free,
    mix: phone ? MIX.compact : MIX.desktop,
    dir: DIR,
    compact: phone,
  });
  const c: Cam = { cam: (() => {
    const cc = new THREE.PerspectiveCamera(27, w / h, 0.5, 400);
    cc.position.copy(r.base).addScaledVector(DIR, r.distance);
    cc.lookAt(r.base);
    cc.updateMatrixWorld();
    return cc;
  })(), free, w, h };
  console.log(
    `${name}: d=${r.distance.toFixed(1)} free=${free.w.toFixed(0)}x${free.h.toFixed(0)}@(${free.x},${free.y})`,
  );
  boats.forEach((b, i) => {
    const bb = boatBbox(c, b.x, b.z, BOAT_RY[i] ?? 0.7);
    const { x0, y0, x1, y1 } = bb;
    const inFree =
      x0 >= free.x && y0 >= free.y && x1 <= free.x + free.w && y1 <= free.y + free.h;
    const inView = x0 >= 0 && y0 >= 0 && x1 <= w && y1 <= h;
    console.log(
      `  boat${i + 1} (${b.x},${b.z}): bbox x ${x0.toFixed(0)}..${x1.toFixed(0)} y ${y0.toFixed(0)}..${y1.toFixed(0)} ` +
        `(${(x1 - x0).toFixed(0)}x${(y1 - y0).toFixed(0)}) inFree=${inFree ? 'YES' : 'no'} inView=${inView ? 'YES' : 'no'}`,
    );
  });
}
