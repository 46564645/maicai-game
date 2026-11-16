/**
 * usePhoneMode.ts —— 手机判定与屏幕方向（M4.5.6：手机只支持横屏）。
 *
 * 判定原则：「是手机」= 触屏设备（pointer:coarse 或有触点）且短边 ≤560px
 * （手机短边 360–500px；平板短边 ≥744px，桌面窗口再小也满足不了触屏）。
 * 方向不看 screen.orientation.lock（很多浏览器锁不了），
 * 直接比较视口宽高 + 监听 matchMedia('(orientation: ...)') 变化。
 */
import { useSyncExternalStore } from 'react';

export type PhoneMode = 'phone-portrait' | 'phone-landscape' | 'other';

const PORTRAIT = '(orientation: portrait)';
const COARSE = '(pointer: coarse)';

function read(): PhoneMode {
  if (typeof window === 'undefined') return 'other';
  const coarse =
    window.matchMedia(COARSE).matches || navigator.maxTouchPoints > 0;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isPhone = coarse && Math.min(w, h) <= 560;
  if (!isPhone) return 'other';
  return h > w ? 'phone-portrait' : 'phone-landscape';
}

function subscribe(onChange: () => void) {
  const mqlPortrait = window.matchMedia(PORTRAIT);
  const mqlCoarse = window.matchMedia(COARSE);
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  mqlPortrait.addEventListener('change', onChange);
  mqlCoarse.addEventListener('change', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
    mqlPortrait.removeEventListener('change', onChange);
    mqlCoarse.removeEventListener('change', onChange);
  };
}

export function usePhoneMode(): PhoneMode {
  return useSyncExternalStore(subscribe, read, () => 'other' as PhoneMode);
}
