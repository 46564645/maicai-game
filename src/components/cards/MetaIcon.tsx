/**
 * MetaIcon.tsx —— 卡面类别记号（R6 决策 2 + ww Part 2 定稿）：
 * 文字标签（On my list / Food / Fun stuff）全部下卡面，换成三枚
 * 形状互不相同的记号（不只靠颜色区分）：
 * - list：绿圆 + 白勾——只给「菜谱里有」（On my list），别处禁用；
 * - food：橙色胡萝卜（食材）；
 * - fun：紫色星星（趣味/诱惑品）。
 * 每枚记号带 aria-label（全名）。消息减负审计 B20（§7 风险项，
 * 独立提交）：点按/悬停的可见全名提示泡（WS3 C11 暖组提示条）
 * 删除——它是全游戏最后一处「点小图标出说明文字」的隐藏面。
 * 全名改由三处明面承载：新手指南第 4 页图例、市场选中读数
 * （记号 + 卡名 + 类别全名）、读屏 aria-label。注意：这推翻了
 * ww Part 2 验收条件里「点按记号出全名」一条，交付时须点名。
 * 视觉尺寸：布局 26px——手机市场卡扇整扇 zoom 0.79（T-1 口径），
 * 26×0.79≈20.5px 渲染，桌面 26px，都 ≥20px（Part 2.1）。
 * 配色按 Part 2.3 定：记号主色 vs 最浅卡底（#fcf1df）对比 ≥3:1
 * （首测绿 #1e9e57=2.87:1、橙 #f06423=2.50:1 不达标，已加深；
 * 逐卡实测见 R10_DESIGN R6 节）。
 */
import { strings } from '../../data/strings';
/* WarmTooltip 已随审计 B20 删除（其唯一消费者就是本组件） */

export type MetaIconKind = 'list' | 'food' | 'fun';

/** 记号全名（与原文字标签同词，en/zh 走 strings.panel 既有条目） */
export function metaIconLabel(kind: MetaIconKind): string {
  return kind === 'list'
    ? strings.panel.tagNeeded
    : kind === 'food'
      ? strings.panel.tagIngredient
      : strings.panel.tagTemptation;
}

export function MetaIcon({ kind }: { kind: MetaIconKind }) {
  const label = metaIconLabel(kind);
  return (
    <span
      className={`meta-icon meta-icon--${kind}`}
      role="img"
      aria-label={label}
    >
      {kind === 'list' && (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="#14713a" />
          <path
            d="M7 12.5 L10.5 16 L17 8.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {kind === 'food' && (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M13.5 3.5 C15 2 17.5 2.2 18.6 3.6 C17.2 4.2 16.4 4.9 15.9 6 L14.4 5.2 C14.7 4.4 14.3 3.8 13.5 3.5 Z"
            fill="#1f7a33"
          />
          <path
            d="M14.8 6.2 C16.4 7.3 16.9 9.6 15.7 12.4 C13.9 16.6 9.9 20.3 6.9 21.2 C5.9 21.5 5 20.6 5.3 19.6 C6.2 16.6 9.3 11.9 12.4 8.9 C13.9 7.4 13.9 7.4 14.8 6.2 Z"
            fill="#cf4a0e"
          />
          <path
            d="M9.5 13.5 L12 12 M8 16.5 L10.8 15.2"
            stroke="#a63e0a"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )}
      {kind === 'fun' && (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M12 2.6 L14.6 8.7 L21.1 9.3 L16.1 13.7 L17.7 20.1 L12 16.6 L6.3 20.1 L7.9 13.7 L2.9 9.3 L9.4 8.7 Z"
            fill="#7b4fd0"
            stroke="#5b34a8"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {/* 审计 B20：原 C11 暖组释义条（WarmTipBubble）已删除 */}
    </span>
  );
}
