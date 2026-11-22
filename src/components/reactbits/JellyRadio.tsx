/**
 * JellyRadio.tsx —— React Bits「Jelly Radio」自包含弹簧改写（MIT +
 * Commons Clause，署名见 THIRD_PARTY_NOTICES.md）。原版是 radio
 * 组的果冻选中：选中点弹簧胀大、相邻项被挤让。本游戏改写为
 * 「按一下」的拾取反馈层（uncontrolled，纯展示，不进任何命令流）：
 *   · 按下 / 焦点落入选项 → 该项 cell 弹簧胀大（scale 1.1），
 *     左右紧邻 cell 各向外让位 10px（原版「neighbours budge」）；
 *   · 动画只有 transform transition（缓动曲线在 CSS，过冲=果冻感）；
 *     无 @keyframes、无 motion；reduced-motion 下不施加变换。
 *   · 容器 display:contents 不参与布局——包进既有网格即插即用，
 *     布局/角色/选择流程零改动（SSR 静态渲染同构）。
 */
import { Children, useState } from 'react';
import type { ReactNode } from 'react';

export interface JellyRadioProps {
  children: ReactNode;
  className?: string;
}

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** 选中项弹簧胀大；紧邻项沿自身方向让位（原版挤压感的轻量版） */
function cellTransform(i: number, sel: number): string {
  if (i === sel) return 'scale(1.1)';
  const d = i - sel;
  if (d === -1) return 'translateX(-10px)';
  if (d === 1) return 'translateX(10px)';
  return '';
}

export function JellyRadio({ children, className = '' }: JellyRadioProps) {
  const [sel, setSel] = useState<number | null>(null);
  const rm = reduced();
  return (
    <span className={`rb-jelly${className ? ` ${className}` : ''}`}>
      {Children.map(children, (child, i) => {
        const t = rm || sel === null ? '' : cellTransform(i, sel);
        return (
          <span
            key={i}
            className="rb-jelly-cell"
            style={t ? { transform: t } : undefined}
            onPointerDown={() => setSel(i)}
            onFocus={() => setSel(i)}
          >
            {child}
          </span>
        );
      })}
    </span>
  );
}
