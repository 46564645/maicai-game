/**
 * jellyPick.ts —— React Bits「Jelly Radio」设计移植
 * （DavidHDev/react-bits，MIT + Commons Clause，见 THIRD_PARTY_NOTICES.md）。
 *
 * 原组件：单选列表里被选行做果冻挤压（scaleX/scaleY 弹簧晃动），
 * 相邻行轻让。本移植把它收成一条 WAAPI 脉冲——挂在任意一排
 * .hand-item / .btn 选择行的容器上：
 *   - 选中项的 .card-view 做 squash-stretch（用独立的 scale 属性做
 *     动画，不碰 transform——.hand-item--sel / .card-view--selected
 *     的抬升选中变换原样叠加，不冲突）；
 *   - 左右相邻项用独立的 translate 属性轻挤一下；
 *   - prefers-reduced-motion 下整段不触发。
 * 无 @keyframes、无 gsap、不新增 CSS 文件。
 */

/* 果冻挤压：先沿主轴压扁再回弹——时长 460ms，单次触发不循环 */
const SQUASH: Keyframe[] = [
  { scale: '1 1', offset: 0 },
  { scale: '1.14 0.84', offset: 0.28 },
  { scale: '0.94 1.1', offset: 0.56 },
  { scale: '1.04 0.98', offset: 0.78 },
  { scale: '1 1', offset: 1 },
];

const BUDGE_PX = 7;
const JELLY_MS = 460;
const BUDGE_MS = 380;

/**
 * 在 container 里对「第 index 个选择行（.hand-item）」放一发果冻
 * 脉冲；index < 0 时什么也不做（未选中/刚清空）。
 */
export function fireJellyPick(
  container: HTMLElement | null,
  index: number,
  reduceMotion: boolean,
): void {
  if (!container || reduceMotion || index < 0) return;
  const rows = Array.from(container.querySelectorAll<HTMLElement>('.hand-item'));
  const picked = rows[index];
  if (!picked) return;

  const card = picked.querySelector<HTMLElement>('.card-view') ?? picked;
  card.getAnimations().forEach((a) => a.cancel());
  card.animate(SQUASH, { duration: JELLY_MS, easing: 'ease-out' });

  for (const side of [-1, 1]) {
    const nb = rows[index + side];
    if (!nb) continue;
    nb.getAnimations().forEach((a) => a.cancel());
    nb.animate(
      [
        { translate: '0px 0px', offset: 0 },
        { translate: `${side * BUDGE_PX}px 0px`, offset: 0.35 },
        { translate: '0px 0px', offset: 1 },
      ],
      { duration: BUDGE_MS, easing: 'ease-in-out' },
    );
  }
}
