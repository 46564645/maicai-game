/**
 * splash.test.ts —— 首次打开缓冲页接线断言（源码字符串口径，同 r10e）。
 * 缓冲页本体在 index.html（静态、JS 前上屏）；收起逻辑在 src/splash.ts；
 * App 首帧后 dismiss、main.tsx 看门狗兜底，三处缺一不可。
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error —— vitest 运行时是 node，内置模块无类型声明
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const splashTs = readFileSync('src/splash.ts', 'utf8');
const mainTsx = readFileSync('src/main.tsx', 'utf8');
const appTsx = readFileSync('src/App.tsx', 'utf8');

describe('首次打开缓冲页', () => {
  it('index.html 带静态 splash 节点与样式（JS 到达前上屏）', () => {
    expect(html).toContain('id="app-splash"');
    expect(html).toContain('.splash--out');
    expect(html).toContain('prefers-reduced-motion');
  });

  it('index.html 有 6 秒内联兜底（模块没加载成也不会困住页面）', () => {
    expect(html).toContain("getElementById('app-splash')");
    expect(html).toContain('6000');
  });

  it('splash.ts 导出收起与看门狗，且淡出后移除节点', () => {
    expect(splashTs).toContain('export function dismissSplash');
    expect(splashTs).toContain('export function armSplashWatchdog');
    expect(splashTs).toContain('el.remove()');
  });

  it('main.tsx 挂载前武装看门狗', () => {
    expect(mainTsx).toContain('armSplashWatchdog()');
  });

  it('App 首帧后调 dismissSplash', () => {
    expect(appTsx).toContain('dismissSplash()');
  });
});
