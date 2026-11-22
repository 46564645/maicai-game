/**
 * hudNudge.ts —— 「钱不够」第三通道：点了买不起的卡，币数 HUD 来一圈
 * 柔红晕脉冲（hud-deny-glow 类 → pglow-warn-pulse keyframe，
 * 见 cards.css F20/F21 段；与卡面/宝石的 card-deny 同脉冲同色系）。
 * 桌面瞄底栏 .me-coins（币堆即钱包入口），手机横屏瞄左下钱包圆钮；
 * 两个布局都找得到才写类，找不到就静默。再点重播（先摘类强制重排）。
 * F24：旧 .coins-bump 缩放跳已删——拒付靠光晕脉冲，币数增减靠
 * DeltaChip + CoinCounter（WS3-C4/C5）。
 */

const GLOW_MS = 900;

export function denyCoinGlow(): void {
  if (typeof document === 'undefined') return;
  const els = document.querySelectorAll<HTMLElement>(
    '.me-coins, .phone-quick > .phone-fab:not(.phone-fab--help)',
  );
  for (const el of els) {
    el.classList.remove('hud-deny-glow');
    void el.offsetWidth; /* 强制重排让动画能重播 */
    el.classList.add('hud-deny-glow');
    window.setTimeout(() => el.classList.remove('hud-deny-glow'), GLOW_MS);
  }
}
