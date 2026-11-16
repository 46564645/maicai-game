// follow-check.mjs — R5 跟随手感判定（DISCUSSION_R5 替代标准）
// 原理：CameraRig 跟随只动注视点（机位不动），注视点 = base 与当前站锚点的
// mix 混合。求解器与运行时已验证一致（fitD/机位相等，见 ART_R5.md §1），
// 故用同一投影数学离线计算：mix=0 基线 vs mix=0.12/0.05 时孩子棋子（站 0，
// slot 0）的屏幕位置，校验向自由带中心移动量 ≥10px（桌面）/ ≥4px（手机），
// 方向正确、无过冲；并输出 mix 下 rim bbox 中心，供与实测截图的 rim 中心对照。
// Run from ~/workspace/maicai-work so `three` resolves from node_modules.
import * as THREE from 'three';

// --- 与 CameraRig.tsx / positions.ts 完全一致的常量 ---
const LOOP = { hx: 5.6, hz: 3.9, r: 1.5 };
const TOP_LEN = 2 * (LOOP.hx - LOOP.r);
const SIDE_LEN = 2 * (LOOP.hz - LOOP.r);
const ARC_LEN = (Math.PI * LOOP.r) / 2;
const LOOP_LENGTH = 2 * TOP_LEN + 2 * SIDE_LEN + 4 * ARC_LEN;
function loopPoint(t) {
  let d = (((t % 1) + 1) % 1) * LOOP_LENGTH;
  const { hx, hz, r } = LOOP;
  if (d < TOP_LEN) return { x: -hx + r + d, z: -hz, yaw: 0 };
  d -= TOP_LEN;
  if (d < ARC_LEN) { const a = -Math.PI / 2 + d / r; return { x: hx - r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r, yaw: a + Math.PI / 2 }; }
  d -= ARC_LEN;
  if (d < SIDE_LEN) return { x: hx, z: -hz + r + d, yaw: Math.PI / 2 };
  d -= SIDE_LEN;
  if (d < ARC_LEN) { const a = d / r; return { x: hx - r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r, yaw: a + Math.PI / 2 }; }
  d -= ARC_LEN;
  if (d < TOP_LEN) return { x: hx - r - d, z: hz, yaw: Math.PI };
  d -= TOP_LEN;
  if (d < ARC_LEN) { const a = Math.PI / 2 + d / r; return { x: -hx + r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r, yaw: a + Math.PI / 2 }; }
  d -= ARC_LEN;
  if (d < SIDE_LEN) return { x: -hx, z: hz - r - d, yaw: -Math.PI / 2 };
  const a = Math.PI + d / r;
  return { x: -hx + r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r, yaw: a + Math.PI / 2 };
}
function stationT(index) {
  const top = TOP_LEN / LOOP_LENGTH, side = SIDE_LEN / LOOP_LENGTH, arc = ARC_LEN / LOOP_LENGTH;
  const u = index % 8;
  if (u <= 1) return top * (0.32 + 0.36 * u);
  if (u <= 3) return top + arc + side * (0.32 + 0.36 * (u - 2));
  if (u <= 5) return top + arc + side + arc + top * (0.32 + 0.36 * (u - 4));
  return top + arc + side + arc + top + arc + side * (0.32 + 0.36 * (u - 6));
}
const stationAnchor = (i) => loopPoint(stationT(i));
const SLOT = 0.34;
function pawnAnchor(index, slot) {
  const c = stationAnchor(index);
  const o = { dx: (slot % 2 === 0 ? -SLOT : SLOT), dz: (slot < 2 ? -SLOT : SLOT) };
  const cos = Math.cos(c.yaw), sin = Math.sin(c.yaw);
  return { x: c.x + o.dx * cos - o.dz * sin, z: c.z + o.dx * sin + o.dz * cos };
}

const DEFAULT_POS = new THREE.Vector3(0, 21, 18);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0.4);
const FIT_BOUNDS = { x: 8.55, z: 6.65, top: 1.7 };
const FIT_RECT = {
  desktop: { l: 0.145, r: 0.145, t: 0.145, b: 0.285 },
  compact: { l: 0.03, r: 0.3, t: 0.14, b: 0.16 },
};
const FIT_SHIFT = { desktop: { x: 0, z: 1.5 }, compact: { x: 3.2, z: 0.4 } };
const FOLLOW_MIX = { desktop: 0.12, compact: 0.05 };

// 自由带（ART_R5.md §3）：桌面 868x539（x 206-1074，y 72-611）；手机 612x282（x 0-612，y 52-334）
const FREE_BAND = {
  desktop: { x: 206, y: 72, w: 868, h: 539 },
  compact: { x: 0, y: 52, w: 612, h: 282 },
};

function fitBase(compact) {
  const s = compact ? FIT_SHIFT.compact : FIT_SHIFT.desktop;
  return new THREE.Vector3(s.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z + s.z);
}
function solve(aspect, rect, goals, dir, base) {
  const minX = -1 + 2 * rect.l, maxX = 1 - 2 * rect.r;
  const minY = -1 + 2 * rect.b, maxY = 1 - 2 * rect.t;
  const cam = new THREE.PerspectiveCamera(27, Math.max(0.5, aspect), 0.5, 400);
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    corners.push(new THREE.Vector3(sx * FIT_BOUNDS.x, 0, sz * FIT_BOUNDS.z));
    corners.push(new THREE.Vector3(sx * FIT_BOUNDS.x, FIT_BOUNDS.top, sz * FIT_BOUNDS.z));
  }
  const v = new THREE.Vector3();
  const fits = (d) => {
    cam.position.copy(base).addScaledVector(dir, d);
    for (const g of goals) {
      cam.lookAt(g); cam.updateMatrixWorld();
      for (const c of corners) {
        v.copy(c).project(cam);
        if (v.x < minX || v.x > maxX || v.y < minY || v.y > maxY) return false;
      }
    }
    return true;
  };
  let lo = 14, hi = 90;
  if (!fits(hi)) return hi;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  return hi;
}
function makeCam(d, W, H, base, goal) {
  const cam = new THREE.PerspectiveCamera(27, W / H, 0.5, 400);
  cam.position.copy(base).addScaledVector(DEFAULT_POS.clone().normalize(), d);
  cam.lookAt(goal); cam.updateMatrixWorld();
  return cam;
}
function project(cam, W, H, p) {
  const v = new THREE.Vector3(p.x, p.y ?? 0, p.z).project(cam);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
}
function rimCenter(cam, W, H) {
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [0, FIT_BOUNDS.top]) {
    const p = project(cam, W, H, { x: sx * FIT_BOUNDS.x, y: sy, z: sz * FIT_BOUNDS.z });
    minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
    miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
  }
  return { x: (minx + maxx) / 2, y: (miny + maxy) / 2, w: maxx - minx, h: maxy - miny };
}

for (const [label, W, H, compact] of [['desktop', 1280, 800, false], ['phone', 874, 402, true]]) {
  const rect = compact ? FIT_RECT.compact : FIT_RECT.desktop;
  const mix = compact ? FOLLOW_MIX.compact : FOLLOW_MIX.desktop;
  const base = fitBase(compact);
  const dir = DEFAULT_POS.clone().normalize();
  const goals = [base.clone()];
  for (let i = 0; i < 8; i++) {
    const a = stationAnchor(i);
    goals.push(new THREE.Vector3(a.x * mix + base.x, 0, a.z * mix + base.z));
  }
  const d = solve(W / H, rect, goals, dir, base);
  const band = FREE_BAND[compact ? 'compact' : 'desktop'];
  const center = { x: band.x + band.w / 2, y: band.y + band.h / 2 };
  const a0 = stationAnchor(0);
  const mixedGoal = new THREE.Vector3(a0.x * mix + base.x, 0, a0.z * mix + base.z);
  const cam0 = makeCam(d, W, H, base, base);        // mix=0 基线
  const camM = makeCam(d, W, H, base, mixedGoal);   // 跟随收敛态
  const pawn = pawnAnchor(0, 0); // 孩子（Sprout，slot 0）在站 0
  const results = [];
  for (const y of [0, 0.8]) {
    const p0 = project(cam0, W, H, { x: pawn.x, y, z: pawn.z });
    const pM = project(camM, W, H, { x: pawn.x, y, z: pawn.z });
    const dist0 = Math.hypot(p0.x - center.x, p0.y - center.y);
    const distM = Math.hypot(pM.x - center.x, pM.y - center.y);
    const shift = Math.hypot(pM.x - p0.x, pM.y - p0.y);
    results.push({ y, p0, pM, dist0, distM, shift });
  }
  const rim0 = rimCenter(cam0, W, H);
  const rimM = rimCenter(camM, W, H);
  const rimShift = Math.hypot(rimM.x - rim0.x, rimM.y - rim0.y);
  const threshold = compact ? 4 : 10;
  console.log(`== ${label} ${W}x${H} (d=${d.toFixed(1)}, mix=${mix}) free-band center=(${center.x.toFixed(0)},${center.y.toFixed(0)})`);
  for (const r of results) {
    const toward = r.distM < r.dist0;
    const overshoot = (r.pM.x - center.x) * (r.p0.x - center.x) < 0 || (r.pM.y - center.y) * (r.p0.y - center.y) < 0;
    console.log(`  pawn y=${r.y}: mix0=(${r.p0.x.toFixed(1)},${r.p0.y.toFixed(1)}) distToCenter=${r.dist0.toFixed(1)} -> follow=(${r.pM.x.toFixed(1)},${r.pM.y.toFixed(1)}) dist=${r.distM.toFixed(1)} | shift=${r.shift.toFixed(1)}px towardCenter=${toward} overshoot=${overshoot} ${r.shift >= threshold && toward && !overshoot ? 'PASS' : 'FAIL'} (>=${threshold}px)`);
  }
  console.log(`  rim bbox center: mix0=(${rim0.x.toFixed(1)},${rim0.y.toFixed(1)}) ${rim0.w.toFixed(0)}x${rim0.h.toFixed(0)} -> follow=(${rimM.x.toFixed(1)},${rimM.y.toFixed(1)}) ${rimM.w.toFixed(0)}x${rimM.h.toFixed(0)} | rim shift=${rimShift.toFixed(1)}px`);
  // 各站跟随量（孩子一局中会走到全部 8 站）：站锚点投影在 mix0 与 mix 下的位移
  const perStation = [];
  for (let i = 0; i < 8; i++) {
    const a = stationAnchor(i);
    const g = new THREE.Vector3(a.x * mix + base.x, 0, a.z * mix + base.z);
    const camG = makeCam(d, W, H, base, g);
    const q0 = project(cam0, W, H, { x: a.x, y: 0, z: a.z });
    const qM = project(camG, W, H, { x: a.x, y: 0, z: a.z });
    const s = Math.hypot(qM.x - q0.x, qM.y - q0.y);
    const toward = Math.hypot(qM.x - center.x, qM.y - center.y) < Math.hypot(q0.x - center.x, q0.y - center.y);
    perStation.push(`${i}:${s.toFixed(1)}${toward ? '' : '!'}`);
  }
  console.log(`  per-station follow shift px (station:shift, !=not-toward-center): ${perStation.join(' ')}`);
}
