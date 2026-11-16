/**
 * CardIcon.tsx —— 卡面图标渲染口。
 * cards.json 的 icon 字段两种取值：
 *   - 普通 emoji 占位（如 🍅）→ 原样当文字渲染；
 *   - "svg:<名>" → 查下面的自绘 SVG 登记表（暖色玩具风，版权归本项目，
 *     已登记 THIRD_PARTY_NOTICES.md）。
 * 第一枚自绘图标是豆腐（孩子认不出 ⬜ 白方块，马教授 M4.5.6 反馈 C1）。
 */
import type { JSX } from 'react';

/** 豆腐：奶白方块带一点厚度，上面撒葱花，放在小木碟上（一眼能认出是豆腐） */
function TofuIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      width="1em"
      height="1em"
      role="img"
      aria-label="Tofu"
      style={{ display: 'inline-block', verticalAlign: '-0.12em' }}
    >
      {/* 小木碟 */}
      <ellipse cx="24" cy="37" rx="17" ry="5.5" fill="#E8D3B0" stroke="#C9A97C" strokeWidth="1.6" />
      <ellipse cx="24" cy="35.5" rx="13.5" ry="3.6" fill="#F3E3C4" />
      {/* 豆腐块：正面 + 顶面 + 侧面（暖白、圆润） */}
      <path
        d="M14 14 L34 14 Q37.5 14 37.5 17.5 L37.5 31 Q37.5 34.5 34 34.5 L14 34.5 Q10.5 34.5 10.5 31 L10.5 17.5 Q10.5 14 14 14 Z"
        fill="#FFF9EC"
        stroke="#D9C29A"
        strokeWidth="1.8"
      />
      <path
        d="M14 14 L34 14 Q37.5 14 37.5 17.5 L37.5 21 L10.5 21 L10.5 17.5 Q10.5 14 14 14 Z"
        fill="#FFFDF6"
      />
      {/* 侧面淡淡阴影，出体积 */}
      <path
        d="M33.5 14.5 Q37.5 14.8 37.5 17.8 L37.5 31 Q37.5 34.3 34.2 34.4 L31.8 34.4 L31.8 15 Z"
        fill="#F4E7C9"
        opacity="0.85"
      />
      {/* 葱花 */}
      <g stroke="#4FAE72" strokeWidth="2" strokeLinecap="round">
        <path d="M17 16.6 l3 1.6" />
        <path d="M24 15.8 l3.2 1.8" />
        <path d="M29.5 18.2 l2.8 1.4" />
      </g>
      <circle cx="20.5" cy="19.2" r="1.5" fill="#6FCB8E" />
      {/* 高光 */}
      <path
        d="M13.5 24 Q13.5 18.6 17 16.8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

const SVG_ICONS: Record<string, () => JSX.Element> = {
  tofu: TofuIcon,
};

export function CardIcon({ icon }: { icon: string }) {
  if (icon.startsWith('svg:')) {
    const C = SVG_ICONS[icon.slice(4)];
    if (C) return <C />;
  }
  return <>{icon}</>;
}
