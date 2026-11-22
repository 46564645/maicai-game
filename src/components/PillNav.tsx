/**
 * PillNav.tsx —— 收编自 React Bits「Pill Nav」（David Haz，
 * MIT + Commons Clause，已登记 THIRD_PARTY_NOTICES.md）。
 *
 * 裁剪适配：原组件是整站导航（logo/移动端抽屉/路由链接）——本项目
 * 只需要它的「胶囊浮条」结构：把现有顶栏动作（设置/玩法/语言开关）
 * 收进一条带描边光圈的奶油胶囊。子项以任意 ReactNode 传入，不动
 * 按钮本体（A5/A6 归 WS1、E7 归本线各自的钮改造）。
 */
import type { ReactNode } from 'react';

export interface PillNavItem {
  key: string;
  node: ReactNode;
  ariaLabel?: string;
}

export interface PillNavProps {
  items: PillNavItem[];
  className?: string;
  ariaLabel?: string;
}

export function PillNav({ items, className, ariaLabel }: PillNavProps) {
  return (
    <nav
      className={`pill-nav${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
    >
      <div className="pill-nav__bar pill-nav__surface">
        <div className="pill-nav__track">
          <ul className="pill-nav__list">
            {items.map((it) => (
              <li key={it.key} className="pill-nav__item">
                <div className="pill-nav__slot" aria-label={it.ariaLabel}>
                  {it.node}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <span className="pill-nav__rim" aria-hidden="true" />
      </div>
    </nav>
  );
}
