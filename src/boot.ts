/**
 * boot.ts —— 首次打开的启动编排（无 DOM；splash.ts 订阅刷 DOM，
 * App 回报首帧/挂载暖机场景）。
 *
 * 三道闸全绿才收缓冲页（status → 'ready'）：
 *   1. assetsDone —— loadGameAssets 跑完且 0 失败（卡图/GLB/HDR/分包）
 *   2. framePainted —— App 首帧真实上屏（双 rAF 回执，不是定时器）
 *   3. sceneDone —— SceneWarmup 实渲出 3D 场景首帧；
 *      不走 3D 的设备此闸先天满足，首帧超时/报错记 markBoard3DFailed
 *      后也放行（本局棋盘直落 2D，不把孩子困在加载页）
 * 错误（status 'error'）：任一资源失败 / STALL_MS 零进展 / 断网 /
 * CAP_MS 总超时 → splash 亮英文错误卡 + Try again；错误后若资源
 * 其实跑完了会自愈成 ready（不困页面），Try again 手动重跑整单。
 */
import { loadGameAssets, wants3DBoard } from './loadAssets';
import { markBoard3DFailed } from './board/three/webgl';

export type BootStatus = 'loading' | 'ready' | 'error';
export type BootErrorKind = 'fail' | 'stall' | 'offline';

export interface BootSnapshot {
  status: BootStatus;
  /** done/total 含「场景首帧」一格（sceneWanted 时 total 多算 1） */
  done: number;
  total: number;
  errorKind: BootErrorKind | null;
  sceneWanted: boolean;
  sceneDone: boolean;
}

const STALL_MS = 12_000; // 资源阶段 12s 没有任何一条落定 → 判卡死
const SCENE_MS = 8_000; // 暖机挂载后 8s 没出首帧 → 本局回退 2D
const CAP_MS = 30_000; // 总兜底：30s 未 ready 一律亮错误卡

let snap: BootSnapshot = {
  status: 'loading',
  done: 0,
  total: 0,
  errorKind: null,
  sceneWanted: false,
  sceneDone: false,
};

// —— 内部闸门/计时 ——
let assetsDone = false;
let framePainted = false;
let sceneMounted = false;
let assetDoneCount = 0; // 资源条数（场景首帧的 +1 单独记，防止互相覆盖）
let runId = 0; // 每次 retry 递增，过期 run 的回报直接丢
let stallTimer = 0;
let capTimer = 0;
let sceneTimer = 0;
let started = false;

const listeners = new Set<(s: BootSnapshot) => void>();

/** App 只关心暖机闸门两位——进度每次跳动都换 snap，
 *  单独缓存这个派生快照，字段没变不换引用（uSES 不触发重渲染） */
let gateSnap = { sceneWanted: false, sceneDone: false };

function emit(): void {
  if (
    gateSnap.sceneWanted !== snap.sceneWanted ||
    gateSnap.sceneDone !== snap.sceneDone
  ) {
    gateSnap = { sceneWanted: snap.sceneWanted, sceneDone: snap.sceneDone };
  }
  snap = { ...snap };
  listeners.forEach((fn) => fn(snap));
}

export function subscribeBoot(fn: (s: BootSnapshot) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getBoot(): BootSnapshot {
  return snap;
}

export function getSceneGate(): { sceneWanted: boolean; sceneDone: boolean } {
  return gateSnap;
}

function armStall(): void {
  window.clearTimeout(stallTimer);
  stallTimer = window.setTimeout(() => fail('stall'), STALL_MS);
}

function fail(kind: BootErrorKind): void {
  if (snap.status === 'ready') return; // 已收页不回退
  snap = { ...snap, status: 'error', errorKind: kind };
  window.clearTimeout(stallTimer);
  emit();
}

function checkReady(): void {
  if (assetsDone && framePainted && snap.sceneDone && snap.status !== 'ready') {
    window.clearTimeout(stallTimer);
    window.clearTimeout(capTimer);
    window.clearTimeout(sceneTimer);
    snap = { ...snap, status: 'ready', errorKind: null };
    emit();
  }
}

async function runLoad(myRun: number): Promise<void> {
  let failed: string[];
  try {
    failed = (
      await loadGameAssets((done, total) => {
        if (myRun !== runId) return;
        armStall(); // 有进展即续命
        // 「场景首帧」另占一格：总条数 = 资源条数 +（走 3D ? 1 : 0）
        assetDoneCount = done;
        snap = {
          ...snap,
          done: done + (snap.sceneWanted && snap.sceneDone ? 1 : 0),
          total: total + (snap.sceneWanted ? 1 : 0),
        };
        emit();
      })
    ).failed;
  } catch (e) {
    console.warn('资源加载器异常：', e);
    if (myRun === runId) fail('fail');
    return;
  }
  if (myRun !== runId) return;
  if (failed.length > 0) {
    fail('fail');
    return;
  }
  assetsDone = true;
  checkReady();
}

/** main.tsx 挂载前经 splash.initSplash() 调用；幂等 */
export function startBoot(): void {
  if (started) return;
  started = true;
  const want = wants3DBoard();
  snap = {
    ...snap,
    sceneWanted: want,
    sceneDone: !want, // 不走 3D → 场景闸先天满足
  };
  armStall();
  capTimer = window.setTimeout(() => fail('stall'), CAP_MS);
  window.addEventListener('offline', () => fail('offline'));
  void runLoad(runId);
}

/** Try again：清错重跑整单（HTTP/分包缓存让已过条目秒回） */
export function retryBoot(): void {
  if (snap.status === 'ready') return;
  runId += 1;
  assetsDone = false;
  assetDoneCount = 0;
  snap = { ...snap, status: 'loading', errorKind: null, done: 0 };
  emit();
  armStall();
  capTimer = window.setTimeout(() => fail('stall'), CAP_MS);
  void runLoad(runId);
}

/** App 双 rAF 回执：首帧真实上屏（幂等） */
export function reportFirstFrame(): void {
  if (framePainted) return;
  framePainted = true;
  checkReady();
}

/** 暖机场景挂载成功（开始计首帧超时；幂等） */
export function reportSceneMounted(): void {
  if (sceneMounted) return;
  sceneMounted = true;
  sceneTimer = window.setTimeout(() => {
    console.warn('3D 场景首帧超时，本局回退 2D');
    markBoard3DFailed();
    reportSceneFailed();
  }, SCENE_MS);
}

/** 暖机场景真实渲出第一帧（幂等） */
export function reportSceneFrame(): void {
  if (snap.sceneDone) return;
  window.clearTimeout(sceneTimer);
  snap = { ...snap, sceneDone: true, done: assetDoneCount + 1 };
  emit();
  checkReady();
}

/** 暖机场景报错/超时 → 记 3D 不可用并放行场景闸（幂等） */
export function reportSceneFailed(): void {
  markBoard3DFailed();
  reportSceneFrame(); // 场景闸放行（棋盘届时直落 2D）
}
