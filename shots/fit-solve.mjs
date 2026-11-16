/**
 * fit-solve.mjs — offline replica of CameraRig.fitDistance (T5 solver),
 * extended with a target-offset parameter (phone: shift island off the rail).
 * Usage: node shots/fit-solve.mjs
 */
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
  if (d < ARC_LEN) {
    const a = -Math.PI / 2 + d / r;
    return { x: hx - r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r };
  }
  d -= ARC_LEN;
  if (d < SIDE_LEN) return { x: hx, z: -hz + r + d };
  d -= SIDE_LEN;
  if (d < ARC_LEN) {
    const a = d / r;
    return { x: hx - r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r };
  }
  d -= ARC_LEN;
  if (d < TOP_LEN) return { x: hx - r - d, z: hz };
  d -= TOP_LEN;
  if (d < ARC_LEN) {
    const a = Math.PI / 2 + d / r;
    return { x: -hx + r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r };
  }
  d -= ARC_LEN;
  if (d < SIDE_LEN) return { x: -hx, z: hz - r - d };
  d -= SIDE_LEN;
  const a = Math.PI + d / r;
  return { x: -hx + r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r };
}
function stationT(index) {
  const top = TOP_LEN / LOOP_LENGTH;
  const side = SIDE_LEN / LOOP_LENGTH;
  const arc = ARC_LEN / LOOP_LENGTH;
  const u = index % 8;
  if (u <= 1) return top * (0.32 + 0.36 * u);
  if (u <= 3) return top + arc + side * (0.32 + 0.36 * (u - 2));
  if (u <= 5) return top + arc + side + arc + top * (0.32 + 0.36 * (u - 4));
  return top + arc + side + arc + top + arc + side * (0.32 + 0.36 * (u - 6));
}
function stationAnchor(i) {
  return loopPoint(stationT(i));
}

const DEFAULT_POS = new THREE.Vector3(0, 21, 18);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0.4);
const FIT_BOUNDS = { x: 8.55, z: 6.65, top: 1.7 };

/** solve min distance; camera position anchored at base+dir*d, lookAt each goal */
function solve(aspect, rect, goals, dir, base) {
  const minX = -1 + 2 * rect.l;
  const maxX = 1 - 2 * rect.r;
  const minY = -1 + 2 * rect.b;
  const maxY = 1 - 2 * rect.t;
  const cam = new THREE.PerspectiveCamera(27, Math.max(0.5, aspect), 0.5, 400);
  const corners = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      corners.push(new THREE.Vector3(sx * FIT_BOUNDS.x, 0, sz * FIT_BOUNDS.z));
      corners.push(new THREE.Vector3(sx * FIT_BOUNDS.x, FIT_BOUNDS.top, sz * FIT_BOUNDS.z));
    }
  const v = new THREE.Vector3();
  const fits = (d) => {
    cam.position.copy(base).addScaledVector(dir, d);
    for (const g of goals) {
      cam.lookAt(g);
      cam.updateMatrixWorld();
      for (const c of corners) {
        v.copy(c).project(cam);
        if (v.x < minX || v.x > maxX || v.y < minY || v.y > maxY) return false;
      }
    }
    return true;
  };
  let lo = 14;
  let hi = 90;
  if (!fits(hi)) return hi;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

function projectBbox(d, W, H, aspect, bounds, goal, dir, base) {
  const cam = new THREE.PerspectiveCamera(27, Math.max(0.5, aspect), 0.5, 400);
  cam.position.copy(base).addScaledVector(dir, d);
  cam.lookAt(goal);
  cam.updateMatrixWorld();
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  const v = new THREE.Vector3();
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      for (const sy of [0, bounds.top]) {
        v.set(sx * bounds.x, sy, sz * bounds.z).project(cam);
        minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x);
        miny = Math.min(miny, v.y); maxy = Math.max(maxy, v.y);
      }
  return {
    x: ((minx + 1) / 2) * W, y: ((1 - maxy) / 2) * H,
    w: ((maxx - minx) / 2) * W, h: ((maxy - miny) / 2) * H,
  };
}

const CORE = { x: 7.6, z: 5.7, top: 0 };
const RIM = { x: 8.55, z: 6.65, top: 1.7 };
const dir = DEFAULT_POS.clone().normalize();

function goalsFor(mix, ox, oz = 0.4) {
  const goals = [new THREE.Vector3(ox, 0, oz)];
  for (let i = 0; i < 8; i++) {
    const a = stationAnchor(i);
    goals.push(new THREE.Vector3(a.x * mix + ox, 0, a.z * mix + oz));
  }
  return goals;
}

function tryCase(label, aspect, W, H, rect, mix, ox, oz = 0.4) {
  const goals = goalsFor(mix, ox, oz);
  const base = new THREE.Vector3(ox, 0, oz);
  const d = solve(aspect, rect, goals, dir, base);
  const rim = projectBbox(d, W, H, aspect, RIM, base, dir, base);
  const core = projectBbox(d, W, H, aspect, CORE, base, dir, base);
  console.log(
    `${label}: d=${d.toFixed(1)} rim=${rim.w.toFixed(0)}x${rim.h.toFixed(0)}@(${rim.x.toFixed(0)},${rim.y.toFixed(0)})` +
      ` core=${core.w.toFixed(0)}x${core.h.toFixed(0)}@(${core.x.toFixed(0)},${core.y.toFixed(0)})` +
      ` rimArea=${((rim.w * rim.h) / 1000).toFixed(0)}k coreArea=${((core.w * core.h) / 1000).toFixed(0)}k`,
  );
}

console.log('=== DESKTOP 1280x800 — band refs: strip 1280x539=690k / cols 868x539=468k / fit 1024x528=541k');
const rectD = { l: 0.1, r: 0.1, t: 0.1, b: 0.24 };
for (const m of [0.45, 0.2, 0.15, 0.12, 0.1, 0.05, 0])
  tryCase(`mix ${m}`, 1280 / 800, 1280, 800, rectD, m, 0);

console.log('=== PHONE canvas 874x402 — free area x0-612 y56-338 → band 612x282=173k');
// rect models: l .03, r = rail 262/874 = .30, t .14, b .16 (bottom fabs at y338 → b=(402-338)/402=.159)
for (const b of [0.14, 0.16]) {
  for (const [mix, ox] of [
    [0.72, 0], [0.4, 0], [0.25, 0], [0.15, 0], [0.1, 0], [0, 0],
    [0.25, 1.5], [0.25, 2.5], [0.15, 2.0], [0.15, 2.5], [0.1, 2.0], [0.1, 2.5], [0, 2.0], [0.05, 2.2],
  ]) {
    tryCase(`b${b} mix ${mix} ox ${ox}`, 874 / 402, 874, 402, { l: 0.03, r: 0.3, t: 0.14, b }, mix, ox);
  }
}

console.log('=== DESKTOP oz sweep (mix 0.1) — recentre island vertically in band');
for (const oz of [0.4, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5]) {
  tryCase(`oz ${oz}`, 1280 / 800, 1280, 800, rectD, 0.1, 0, oz);
}
console.log('=== DESKTOP oz sweep (mix 0.2)');
for (const oz of [1.5, 2.0, 2.5, 3.0]) {
  tryCase(`oz ${oz}`, 1280 / 800, 1280, 800, rectD, 0.2, 0, oz);
}
console.log('=== PHONE oz sweep (mix 0.15, ox 2.0, b0.16)');
for (const oz of [0.4, 1.0, 1.5, 2.0, 2.5]) {
  tryCase(`oz ${oz}`, 874 / 402, 874, 402, { l: 0.03, r: 0.3, t: 0.14, b: 0.16 }, 0.15, 2.0, oz);
}

console.log('=== FINAL CANDIDATES ===');
for (const [mix, oz] of [[0.1, 1.0], [0.12, 1.2], [0.12, 1.5], [0.15, 1.2], [0.15, 1.5], [0.2, 1.5]]) {
  tryCase(`desk mix ${mix} oz ${oz}`, 1280 / 800, 1280, 800, rectD, mix, 0, oz);
}
for (const [mix, ox, oz] of [[0.15, 2.0, 0.5], [0.15, 2.2, 0.5], [0.2, 2.2, 0.5], [0.2, 2.4, 0.5], [0.15, 2.4, 0.7], [0.2, 2.4, 0.7]]) {
  tryCase(`phon mix ${mix} ox ${ox} oz ${oz}`, 874 / 402, 874, 402, { l: 0.03, r: 0.3, t: 0.14, b: 0.16 }, mix, ox, oz);
}

console.log('=== PHONE push (band 612x282; want rim ~150k for seg ~105k) ===');
for (const [mix, ox, oz] of [
  [0.1, 3.0, 0.5], [0.1, 3.5, 0.5], [0.15, 3.0, 0.5], [0.15, 3.5, 0.5],
  [0.1, 3.0, 0.8], [0.1, 3.5, 0.8], [0.15, 3.0, 0.8], [0.15, 3.5, 0.8],
  [0.2, 3.2, 0.6], [0.2, 3.5, 0.6],
]) {
  tryCase(`phon mix ${mix} ox ${ox} oz ${oz}`, 874 / 402, 874, 402, { l: 0.03, r: 0.3, t: 0.14, b: 0.16 }, mix, ox, oz);
}
console.log('=== DESKTOP push (oz 1.5-2.0) ===');
for (const [mix, oz] of [[0.15, 1.5], [0.15, 1.8], [0.12, 1.5], [0.1, 1.5]]) {
  tryCase(`desk mix ${mix} oz ${oz}`, 1280 / 800, 1280, 800, rectD, mix, 0, oz);
}

console.log('=== PHONE final push ===');
for (const [mix, ox, oz] of [
  [0.05, 3.2, 0.6], [0.05, 3.5, 0.6], [0.08, 3.2, 0.6], [0.05, 3.2, 0.4], [0.03, 3.3, 0.5],
  [0.1, 3.2, 0.6],
]) {
  tryCase(`phon mix ${mix} ox ${ox} oz ${oz}`, 874 / 402, 874, 402, { l: 0.03, r: 0.3, t: 0.14, b: 0.16 }, mix, ox, oz);
}
console.log('=== DESKTOP final ===');
for (const [mix, oz] of [[0.12, 1.6], [0.15, 1.6], [0.12, 1.7], [0.1, 1.6]]) {
  tryCase(`desk mix ${mix} oz ${oz}`, 1280 / 800, 1280, 800, rectD, mix, 0, oz);
}

console.log('=== PHONE oz down-shift ===');
for (const [mix, ox, oz] of [
  [0.05, 3.2, 0.2], [0.05, 3.2, 0], [0.05, 3.2, -0.3], [0.03, 3.3, 0], [0.05, 3.5, 0.2],
  [0.05, 3.0, 0.2], [0.05, 3.4, 0.2],
]) {
  tryCase(`phon mix ${mix} ox ${ox} oz ${oz}`, 874 / 402, 874, 402, { l: 0.03, r: 0.3, t: 0.14, b: 0.16 }, mix, ox, oz);
}
