/**
 * StatusMark.tsx —— 收编自 React Bits「Status Mark」（David Haz，
 * MIT + Commons Clause，已登记 THIRD_PARTY_NOTICES.md）。
 *
 * 适配：环形 → 进度弧 → 对勾的三态标记，映射 bot「想→想好」回合。
 * 原组件同样基于 motion；本版裁剪到项目需要的三态（idle/running/done），
 * 弧线用 SVG stroke-dash 段旋转实现（1.4s/圈，慢速不闪）。
 * prefers-reduced-motion：进度弧不旋转（停在一个静态弧段），对勾瞬现。
 */
import { motion, useReducedMotion } from 'motion/react';

export type StatusMarkStatus = 'idle' | 'running' | 'done';

export interface StatusMarkProps {
  status: StatusMarkStatus;
  /** 边长（px），默认 16——与相邻文字行高齐平 */
  size?: number;
  className?: string;
}

const R = 9;
const CIRC = 2 * Math.PI * R;

export function StatusMark({ status, size = 16, className }: StatusMarkProps) {
  const reduce = useReducedMotion();
  /* node 环境 SSR：motion 元素会炸——给等效静态终态
     （弧停静态段、对勾整画）；判 document 不判 window
     （i18n 测试会装 window 替身） */
  const isServer = typeof document === 'undefined';
  /* 进度弧：约 1/3 周的描边段绕环缓转 */
  const arc = (
    <circle
      cx="12"
      cy="12"
      r={R}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeDasharray={`${CIRC / 3} ${CIRC}`}
    />
  );
  return (
    <svg
      className={`status-mark status-mark--${status}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {/* 底环：idle/running 常驻淡环 */}
      <circle
        cx="12"
        cy="12"
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        opacity={status === 'done' ? 0.25 : 0.4}
      />
      {status === 'running' &&
        (isServer ? (
          <g transform="rotate(45 12 12)">{arc}</g>
        ) : (
          <motion.g
            style={{ originX: '50%', originY: '50%' }}
            animate={reduce ? { rotate: 45 } : { rotate: 360 }}
            transition={
              reduce
                ? { duration: 0 }
                : { repeat: Infinity, ease: 'linear', duration: 1.4 }
            }
          >
            {arc}
          </motion.g>
        ))}
      {status === 'done' &&
        (isServer ? (
          <path
            d="M7 12.6l3.4 3.4L17.5 8.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <motion.path
            d="M7 12.6l3.4 3.4L17.5 8.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduce ? 0 : 0.35, ease: 'easeOut' }}
          />
        ))}
    </svg>
  );
}
