/**
 * hudNudge.ts —— R10 Slice D（interaction #6）：「钱不够」第三通道。
 * 面板里点了买不起的卡 → 币数 HUD 轻跳一下（复用 ART_3D §8.5 的
 * coins-bump keyframes，纯 transform）。桌面瞄底栏 .me-coins，
 * 手机横屏瞄左下钱包圆钮；两个布局都找得到才写类，找不到就静默。
 * 再点重播：摘除 → 强制回流 → 重挂。
 */
const BUMP_MS = 500;

export function bumpCoinHud(): void {
  if (typeof document === 'undefined') return;
  const els = document.querySelectorAll<HTMLElement>(
    '.me-coins, .phone-quick > .phone-fab:not(.phone-fab--help)',
  );
  for (const el of els) {
    el.classList.remove('coins-bump');
    void el.offsetWidth; // 强制回流，同一帧内重挂才重播
    el.classList.add('coins-bump');
    window.setTimeout(() => el.classList.remove('coins-bump'), BUMP_MS);
  }
}
