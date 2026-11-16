/**
 * RotatePhone.tsx —— 手机竖屏提示层（M4.5.6：手机只支持横屏）。
 * 全屏盖住游戏：一部自绘的小手机慢慢转成横向的循环动画 +
 * 一句「把手机横过来」。不识字的孩子也看得懂；转成横屏后
 * 本组件自动卸载（usePhoneMode 变 phone-landscape），不用再点。
 * 动画只用 CSS，尊重 prefers-reduced-motion（直接停在横向）。
 */
import { strings } from '../data/strings';

export function RotatePhone() {
  return (
    <div className="rotate-gate" role="status" data-testid="rotate-gate">
      <div className="rotate-stage" aria-hidden="true">
        <svg viewBox="0 0 120 120" className="rotate-svg">
          {/* 转弯提示：虚线弧 + 箭头 */}
          <path
            d="M18 78 A 46 46 0 0 1 78 18"
            fill="none"
            stroke="#B9A3F0"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="2 9"
          />
          <path
            d="M70 12 L84 14 L76 26 Z"
            fill="#B9A3F0"
          />
          {/* 手机（一组整体旋转） */}
          <g className="rotate-phone">
            <rect
              x="44"
              y="26"
              width="34"
              height="60"
              rx="8"
              fill="#FFF6EC"
              stroke="#1E1E2A"
              strokeWidth="4"
            />
            <rect x="55" y="31" width="12" height="4" rx="2" fill="#1E1E2A" />
            <rect x="50" y="40" width="22" height="34" rx="3" fill="#FFC93C" opacity="0.55" />
            <circle cx="61" cy="80" r="3" fill="#1E1E2A" />
          </g>
        </svg>
      </div>
      <p className="rotate-text">{strings.rotate.hint}</p>
    </div>
  );
}
