// solver-actual.mjs — one-off: fit-solve math with the ACTUAL CameraRig params
// (fitBase = DEFAULT_TARGET + FIT_SHIFT, i.e. desktop base z = 0.4+1.5 = 1.9,
// phone base = (3.2, 0, 0.4+0.4) = (3.2, 0, 0.8)).
// Run from ~/workspace/maicai-work so `three` resolves from node_modules.
import * as THREE from 'three';

const LOOP = { hx: 5.6, hz: 3.9, r: 1.5 };
const TOP_LEN = 2 * (LOOP.hx - LOOP.r);
const SIDE_LEN = 2 * (LOOP.hz - LOOP.r);
const ARC_LEN = (Math.PI * LOOP.r) / 2;
const LOOP_LENGTH = 2 * TOP_LEN + 2 * SIDE_LEN + 4 * ARC_LEN;
function loopPoint(t) {
  let d = (((t % 1) + 1) % 1) * LOOP_LENGTH;
  const { hx, hz, r } = LOOP;
  if (d < TOP_LEN) return { x: -hx + r + d, z: -hz };
  d -= TOP_LEN;
  if (d < ARC_LEN) { const a = -Math.PI / 2 + d / r; return { x: hx - r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r }; }
  d -= ARC_LEN;
  if (d < SIDE_LEN) return { x: hx, z: -hz + r + d };
  d -= SIDE_LEN;
  if (d < ARC_LEN) { const a = d / r; return { x: hx - r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r }; }
  d -= ARC_LEN;
  if (d < TOP_LEN) return { x: hx - r - d, z: hz };
  d -= TOP_LEN;
  if (d < ARC_LEN) { const a = Math.PI / 2 + d / r; return { x: -hx + r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r }; }
  d -= ARC_LEN;
  if (d < SIDE_LEN) return { x: -hx, z: hz - r - d };
  d -= SIDE_LEN;
  const a = Math.PI + d / r;
  return { x: -hx + r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r };
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

const DEFAULT_POS = new THREE.Vector3(0, 21, 18);
const FIT_BOUNDS = { x: 8.55, z: 6.65, top: 1.7 };
const CORE = { x: 7.6, z: 5.7, top: 0 };
const RIM_FLAT = { x: 8.55, z: 6.65, top: 0 };

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
function projectBbox(d, W, H, aspect, bounds, goal, dir, base) {
  const cam = new THREE.PerspectiveCamera(27, Math.max(0.5, aspect), 0.5, 400);
  cam.position.copy(base).addScaledVector(dir, d);
  cam.lookAt(goal); cam.updateMatrixWorld();
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  const v = new THREE.Vector3();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [0, bounds.top]) {
    v.set(sx * bounds.x, sy, sz * bounds.z).project(cam);
    minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x);
    miny = Math.min(miny, v.y); maxy = Math.max(maxy, v.y);
  }
  return { x: ((minx + 1) / 2) * W, y: ((1 - maxy) / 2) * H, w: ((maxx - minx) / 2) * W, h: ((maxy - miny) / 2) * H };
}
function run(label, W, H, rect, mix, base) {
  const aspect = W / H;
  const dir = DEFAULT_POS.clone().normalize();
  const goals = [base.clone()];
  for (let i = 0; i < 8; i++) {
    const a = stationAnchor(i);
    goals.push(new THREE.Vector3(a.x * mix + base.x, 0, a.z * mix + base.z));
  }
  const d = solve(aspect, rect, goals, dir, base);
  const rim = projectBbox(d, W, H, aspect, FIT_BOUNDS, base, dir, base);
  const rimFlat = projectBbox(d, W, H, aspect, RIM_FLAT, base, dir, base);
  const core = projectBbox(d, W, H, aspect, CORE, base, dir, base);
  console.log(`${label}: d=${d.toFixed(1)}`);
  console.log(`  rim(FIT_BOUNDS incl top) ${rim.w.toFixed(0)}x${rim.h.toFixed(0)}@(${rim.x.toFixed(0)},${rim.y.toFixed(0)}) area=${((rim.w * rim.h) / 1000).toFixed(0)}k`);
  console.log(`  rimFlat(ground plane)    ${rimFlat.w.toFixed(0)}x${rimFlat.h.toFixed(0)}@(${rimFlat.x.toFixed(0)},${rimFlat.y.toFixed(0)}) area=${((rimFlat.w * rimFlat.h) / 1000).toFixed(0)}k`);
  console.log(`  core                       ${core.w.toFixed(0)}x${core.h.toFixed(0)}@(${core.x.toFixed(0)},${core.y.toFixed(0)}) area=${((core.w * core.h) / 1000).toFixed(0)}k`);
}
// desktop: FIT_RECT {l:.1,r:.1,t:.1,b:.24}, mix .12, base (0,0,0.4+1.5=1.9)
run('DESKTOP actual', 1280, 800, { l: 0.1, r: 0.1, t: 0.1, b: 0.24 }, 0.12, new THREE.Vector3(0, 0, 1.9));
// phone: FIT_RECT {l:.03,r:.3,t:.14,b:.16}, mix .05, base (3.2,0,0.4+0.4=0.8)
run('PHONE actual', 874, 402, { l: 0.03, r: 0.3, t: 0.14, b: 0.16 }, 0.05, new THREE.Vector3(3.2, 0, 0.8));
console.log('free bands: desktop cols 868x539=468k ; phone 612x282=173k ; viewport desktop 1024k, phone 351k');
console.log('=== DESKTOP FIT_RECT candidates (target rim ~0.60-0.70 x 468k = 281-328k) ===');
for (const [label, rect] of [
  ['l.14 r.14 t.14 b.28', { l: 0.14, r: 0.14, t: 0.14, b: 0.28 }],
  ['l.16 r.16 t.16 b.30', { l: 0.16, r: 0.16, t: 0.16, b: 0.30 }],
  ['l.18 r.18 t.18 b.32', { l: 0.18, r: 0.18, t: 0.18, b: 0.32 }],
  ['l.15 r.15 t.12 b.30', { l: 0.15, r: 0.15, t: 0.12, b: 0.30 }],
]) {
  run('CAND ' + label, 1280, 800, rect, 0.12, new THREE.Vector3(0, 0, 1.9));
}
console.log('=== mid-band candidates ===');
for (const [label, rect] of [
  ['l.145 r.145 t.145 b.285', { l: 0.145, r: 0.145, t: 0.145, b: 0.285 }],
  ['l.15 r.15 t.15 b.29', { l: 0.15, r: 0.15, t: 0.15, b: 0.29 }],
]) {
  run('CAND ' + label, 1280, 800, rect, 0.12, new THREE.Vector3(0, 0, 1.9));
}
