/**
 * QualityProvider.tsx —— 画质档上下文（借 closing-quest 的档位思路，M4.5.7 改三档）。
 * 档位与派生 flags（ART_3D §9 画质分档）：
 *   high   桌面默认：全效果（后期链 N8AO+Bloom+TiltShift+调色、影图 2048、dpr≤1.75）
 *   medium 手机/触屏默认：关移轴+泛光+N8AO，其余保留（影图 1024、dpr≤2、HDRI 反光、密度×0.6）
 *   low    掉帧自动降：关实时阴影改贴片影、dpr=1、关 HDRI、密度×0.4
 * URL 兜底：?fx=0 强制关后期链；?tonemap=neutral|aces 供 ww 对照截图；
 * ?env=0 关 HDRI 环境反光（塑料件仍有方向光高光）。
 * Scene 内 PerformanceMonitor 持续掉帧 → setQuality 逐档降（high→medium→low）。
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Quality = 'high' | 'medium' | 'low';
export type ToneMap = 'neutral' | 'aces';

export interface QualityFlags {
  /** 后期链整体（EffectComposer；含移轴/泛光/N8AO/调色） */
  post: boolean;
  /** 手机档廉价镜头（T4：CSS backdrop-filter 上下虚化带 + 暗角，
   *  近似移轴；仅 medium 档，?fx=0 与 low 档关） */
  lens: boolean;
  /** N8AO 脚下接触影（仅 post 内） */
  ao: boolean;
  /** 实时阴影贴图尺寸；0 = 关实时阴影改贴片影 */
  shadowMapSize: number;
  /** dpr 上限（[min,max]） */
  dpr: [number, number];
  /** HDRI 环境反光（PMREM） */
  env: boolean;
  /** 花草灌木密度系数 */
  flora: number;
  /** 色调映射（?tonemap= 覆盖） */
  toneMap: ToneMap;
}

function urlParams(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}

/** 档位 → flags 纯函数（可单测）；URL 覆盖在 Provider 里合入 */
export function flagsFor(q: Quality): QualityFlags {
  switch (q) {
    case 'high':
      return {
        post: true,
        lens: false,
        ao: true,
        shadowMapSize: 2048,
        dpr: [1, 1.75],
        env: true,
        flora: 1,
        toneMap: 'neutral',
      };
    case 'medium':
      return {
        post: false,
        lens: true,
        ao: false,
        shadowMapSize: 1024,
        dpr: [1, 2],
        env: true,
        flora: 0.6,
        toneMap: 'neutral',
      };
    case 'low':
      return {
        post: false,
        lens: false,
        ao: false,
        shadowMapSize: 0,
        dpr: [1, 1],
        env: false,
        flora: 0.4,
        toneMap: 'neutral',
      };
  }
}

/** 掉帧逐档降（不是直降 low） */
export function lowerQuality(q: Quality): Quality {
  return q === 'high' ? 'medium' : 'low';
}

interface QualityCtx {
  quality: Quality;
  setQuality: (q: Quality) => void;
  /** 降一档（PerformanceMonitor onDecline 用） */
  degrade: () => void;
  flags: QualityFlags;
}

const Ctx = createContext<QualityCtx>({
  quality: 'high',
  setQuality: () => {},
  degrade: () => {},
  flags: flagsFor('high'),
});

/** 初始档：窄屏/粗指针（手机、平板触屏）→ medium；其余 → high（M4.5.7 三档） */
function initialQuality(): Quality {
  if (typeof window === 'undefined') return 'high';
  const narrow = window.matchMedia('(max-width: 700px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return narrow || coarse ? 'medium' : 'high';
}

export function QualityProvider({ children }: { children: ReactNode }) {
  const [quality, setQuality] = useState<Quality>(initialQuality);
  const value = useMemo<QualityCtx>(() => {
    const flags = { ...flagsFor(quality) };
    const p = urlParams();
    if (p.get('fx') === '0') {
      flags.post = false; // 低配排查/e2e 兜底
      flags.lens = false;
    }
    if (p.get('ao') === '0') flags.ao = false; // T3 接地对照：只关 N8AO，其余后期不变
    if (p.get('env') === '0') flags.env = false;
    const tm = p.get('tonemap');
    if (tm === 'aces' || tm === 'neutral') flags.toneMap = tm;
    return {
      quality,
      setQuality,
      degrade: () => setQuality((q) => lowerQuality(q)),
      flags,
    };
  }, [quality]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQuality(): QualityCtx {
  return useContext(Ctx);
}
