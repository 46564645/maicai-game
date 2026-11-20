/**
 * splash.test.ts —— 首次打开缓冲页「真进度」接线断言（源码字符串口径，
 * 同 r10e）。缓冲页本体在 index.html（静态、JS 前上屏）；状态机在
 * src/boot.ts（资源闸 + App 首帧闸 + 3D 场景首帧闸 + 卡死/失败 →
 * 错误卡）；DOM 适配在 src/splash.ts；资源清单在 src/loadAssets.ts；
 * 暖机在 src/board/three/SceneWarmup.tsx。缺一环都判不过关。
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error —— vitest 运行时是 node，内置模块无类型声明
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const splashTs = readFileSync('src/splash.ts', 'utf8');
const bootTs = readFileSync('src/boot.ts', 'utf8');
const loadTs = readFileSync('src/loadAssets.ts', 'utf8');
const mainTsx = readFileSync('src/main.tsx', 'utf8');
const appTsx = readFileSync('src/App.tsx', 'utf8');
const warmup = readFileSync('src/board/three/SceneWarmup.tsx', 'utf8');
const webglTs = readFileSync('src/board/three/webgl.ts', 'utf8');

describe('首次打开缓冲页', () => {
  it('index.html 带静态 splash 节点与样式（JS 到达前上屏）', () => {
    expect(html).toContain('id="app-splash"');
    expect(html).toContain('.splash--out');
    expect(html).toContain('prefers-reduced-motion');
  });

  it('进度条是真进度：无往返假动画，填充宽度由 JS 驱动', () => {
    expect(html).toContain('splash-bar-fill');
    expect(html).not.toContain('splash-slide'); // 旧往返动画已删
    expect(html).toContain('role="progressbar"');
    expect(splashTs).toContain('fill.style.width');
    expect(splashTs).toContain('aria-valuenow');
  });

  it('界面纯英文：标题/提示/错误卡不带中文', () => {
    expect(html).toContain("Let's Go Shopping");
    expect(html).not.toContain('一起去买菜');
    expect(html).not.toContain('加载中');
    expect(html).toContain('Try again');
    expect(splashTs).toContain('Check the internet');
  });

  it('错误卡：英文短句 + ≥48px Try again（实测 56px 下限）', () => {
    expect(html).toContain('splash-error');
    expect(html).toContain('splash-retry');
    expect(html).toContain('min-height: 56px');
    expect(splashTs).toContain('ERROR_TEXT');
    expect(bootTs).toContain('retryBoot');
  });

  it('内联兜底：模块没接管（data-ctl）时亮错误卡而非白屏', () => {
    expect(html).toContain("getElementById('app-splash')");
    expect(html).toContain('data-ctl');
    expect(html).toContain('window.location.reload');
    expect(splashTs).toContain("setAttribute('data-ctl', '1')");
  });

  it('资源清单是真的：卡图 + GLB + HDR + 场景/后期分包', () => {
    expect(loadTs).toContain('CARD_ART_URLS');
    expect(loadTs).toContain('.glb');
    expect(loadTs).toContain('.hdr');
    expect(loadTs).toContain("import('./board/three/SceneWarmup')");
    expect(loadTs).toContain('detectWebGL');
    expect(loadTs).toContain('predictFlags');
  });

  it('boot 三闸：资源齐 + App 首帧 + 场景首帧，缺一不收', () => {
    expect(bootTs).toContain('assetsDone');
    expect(bootTs).toContain('framePainted');
    expect(bootTs).toContain('sceneDone');
    expect(bootTs).toContain('reportFirstFrame');
    expect(bootTs).toContain('reportSceneFrame');
    expect(bootTs).toContain('reportSceneFailed');
    expect(bootTs).toContain('loadGameAssets');
  });

  it('卡死/失败兜底：零进展 + 断网 + 总超时 → error', () => {
    expect(bootTs).toContain('STALL_MS');
    expect(bootTs).toContain('CAP_MS');
    expect(bootTs).toContain('SCENE_MS');
    expect(bootTs).toContain("'offline'");
    expect(bootTs).toContain('markBoard3DFailed');
  });

  it('main.tsx 挂载前接管缓冲页', () => {
    expect(mainTsx).toContain('initSplash()');
  });

  it('App 报首帧并挂暖机场景', () => {
    expect(appTsx).toContain('reportFirstFrame()');
    expect(appTsx).toContain('LazySceneWarmup');
    expect(appTsx).toContain('subscribeBoot');
  });

  it('暖机真渲场景首帧并回报；失败标记给 BoardMount 兜底', () => {
    expect(warmup).toContain('Canvas');
    expect(warmup).toContain('Scene');
    expect(warmup).toContain('useFrame');
    expect(warmup).toContain('onFrame');
    expect(webglTs).toContain('markBoard3DFailed');
    expect(webglTs).toContain('board3DFailed');
  });
});
