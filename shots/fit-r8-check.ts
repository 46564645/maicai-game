/**
 * fit-r8-check.ts — offline validation of the REAL fitSolver (vite-node).
 * Usage: npx vite-node shots/fit-r8-check.ts [rectsJson]
 * Free rects: estimated from the CSS layout chain (or pass an
 * r8_rects_<tag>.json to use harness-measured rects instead).
 */
import * as THREE from 'three';
import fs from 'node:fs';
import { solveFit, type FreeRect } from '../src/board/three/fitSolver';

const DIR = new THREE.Vector3(0, 21, 18).normalize();
const MIX = { desktop: 0.12, compact: 0.05 };

// name, W, H, phone, estimated free rect (pre-R8 CSS)
const CASES: Array<[string, number, number, boolean, FreeRect]> = [
  ['phone-844x390', 844, 390, true, { x: 0, y: 56, w: 591, h: 270 }],
  ['phone-874x402', 874, 402, true, { x: 0, y: 56, w: 612, h: 282 }],
  ['phone-915x412', 915, 412, true, { x: 0, y: 56, w: 640, h: 292 }],
  ['phone-740x360', 740, 360, true, { x: 0, y: 56, w: 490, h: 240 }],
  ['desktop-1024x768', 1024, 768, false, { x: 206, y: 72, w: 612, h: 507 }],
  ['desktop-1280x800', 1280, 800, false, { x: 206, y: 72, w: 868, h: 539 }],
  ['desktop-1440x900', 1440, 900, false, { x: 270, y: 72, w: 900, h: 639 }],
  ['desktop-1600x1000', 1600, 1000, false, { x: 350, y: 72, w: 900, h: 739 }],
  ['desktop-1920x1080', 1920, 1080, false, { x: 510, y: 72, w: 900, h: 807 }],
];

const rectsArg = process.argv[2];
const measured: Record<string, { free?: FreeRect }> = rectsArg
  ? JSON.parse(fs.readFileSync(rectsArg, 'utf8'))
  : {};

// When run against a harness rects file, also emit r8_fit_<tag>.json
// (consumed by r8-analyze.py for solver-rim cover, the R6-comparable
// region) next to it.
const fitOut: Record<string, unknown> = {};
const tagMatch = rectsArg?.match(/r8_rects_(.+)\.json$/);

for (const [name, w, h, phone, est] of CASES) {
  const free = measured[name]?.free ?? est;
  const src = measured[name]?.free ? 'measured' : 'estimated';
  const r = solveFit({ width: w, height: h, free, mix: phone ? MIX.compact : MIX.desktop, dir: DIR });
  const inX = r.rim.x >= free.x - 1 && r.rim.x + r.rim.w <= free.x + free.w + 1;
  const inY = r.rim.y >= free.y - 1 && r.rim.y + r.rim.h <= free.y + free.h + 1;
  fitOut[name] = {
    distance: r.distance,
    fill: r.fill,
    free,
    rim: { x: r.rim.x, y: r.rim.y, w: r.rim.w, h: r.rim.h },
    inside: inX && inY,
  };
  console.log(
    `${name.padEnd(18)} free=${free.w}x${free.h}@(${free.x},${free.y}) [${src}] ` +
      `d=${r.distance.toFixed(1)} base=(${r.base.x.toFixed(2)},${r.base.z.toFixed(2)}) ` +
      `rim=${r.rim.w.toFixed(0)}x${r.rim.h.toFixed(0)}@(${r.rim.x.toFixed(0)},${r.rim.y.toFixed(0)}) ` +
      `fill=${r.fill.toFixed(3)} inside=${inX && inY ? 'yes' : 'NO'}`,
  );
}

if (rectsArg && tagMatch) {
  const outPath = rectsArg.replace(/r8_rects_.+\.json$/, `r8_fit_${tagMatch[1]}.json`);
  fs.writeFileSync(outPath, JSON.stringify(fitOut, null, 1));
  console.log(`fit json -> ${outPath}`);
}
