/**
 * ProfileCard.tsx —— R10 Slice E（§3 角色高光时刻）：竖版 ID 卡。
 * 出处（与 THIRD_PARTY_NOTICES.md 的 Slice E 条目互相指引）：组件概念与
 * 高光卡形态借 React Bits 的 ProfileCard、版式借 React Bits 的
 * ReflectiveCard（均为 David Haz / react-bits，许可证 MIT + Commons
 * Clause）——ReflectiveCard 的「ID 卡」骨架：头行小徽 + 状态点 / 中段
 * 大头像砖 + 名 + 头衔 / 底行属性栏 + 右下 48px 方块接触钮
 * （--tap-min-size，见 cards.css 的 .pc-contact）。本文件为本仓重写：
 * holo 用 TiltCard 的 foil（克制一档），倾转、高光、彩虹膜全部复用
 * TiltCard 引擎，不另造交互；未移植 WebGL2 着色器，无摄像头/视频路径，
 * 图标为手写内联 SVG（未引入 @hugeicons）。
 *
 * 内容全部来自既有 state（spotlightInfo 纯派生）：名字、性格/菜谱
 * 头衔、角色 icon 头像砖、币数、买到的小卡缩略图、是否在行动。
 * 无外取图片：头像砖 = cards.json 角色/bot icon（emoji），与棋子、
 * 徽章同一来源——「头像策略」记 R10_DESIGN Slice E 落地记录。
 */
import type { CSSProperties } from 'react';
import { cards, getIngredient } from '../../data/cards';
import { strings } from '../../data/strings';
import { spotlightInfo, spotlightStatus } from '../../ui/spotlight';
import type { SpotlightInfo } from '../../ui/spotlight';
import type { CardId, Player } from '../../game/types';
import { CardIcon } from '../CardIcon';
import { CoinDots } from '../CoinDots';
import { TiltCard } from './TiltCard';
import { cardArtFor } from './cardArt';

/** 底行右下的「看看篮子」接触钮（SVG 篮筐，矢量不依赖 emoji 字体） */
function BasketGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 10h15l-1.5 8.2a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8L4.5 10z" />
      <path d="M8.5 10 11 4.5M15.5 10 13 4.5" />
      <path d="M9.5 13v4M14.5 13v4M12 13v4" />
    </svg>
  );
}

function Thumb({ id }: { id: CardId }) {
  const art = cardArtFor(id);
  const icon =
    getIngredient(id)?.icon ??
    cards.temptations.find((t) => t.id === id)?.icon ??
    '❔';
  return (
    <span className="pc-thumb" data-thumb={id} aria-hidden="true">
      {art ? <img src={art} alt="" draggable={false} /> : <CardIcon icon={icon} />}
    </span>
  );
}

export function ProfileCard({
  player,
  info,
  contact,
  onContact,
  onDismiss,
  testid = 'spotlight-card',
}: {
  player: Player;
  /** spotlightInfo() 派生结果（Game 侧可缓存；不传则内部现算） */
  info?: SpotlightInfo;
  /** 接触钮文案（真人=看看篮子；不给则底行无钮） */
  contact?: string;
  onContact?: () => void;
  /** 点卡面本身也收帘（与点帘同一路手势） */
  onDismiss?: () => void;
  testid?: string;
}) {
  const i = info ?? spotlightInfo(player, false);
  return (
    <div
      className="pc"
      style={
        {
          '--pc-accent': i.accentVar,
          '--pc-backdrop': `color-mix(in srgb, ${i.accentVar} 22%, var(--color-surface))`,
        } as CSSProperties
      }
      data-testid={testid}
    >
      <TiltCard
        glare
        foil
        front={
          <div
            className="pc-card"
            role="button"
            tabIndex={0}
            aria-label={`${i.name} · ${spotlightStatus(i.acting)}`}
            onClick={onDismiss}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                e.preventDefault();
                onDismiss?.();
              }
            }}
          >
            <div className="pc-head">
              <span className="pc-badge" title={i.title}>
                {i.title}
              </span>
              <span
                className={'pc-status' + (i.acting ? ' pc-status--live' : '')}
              >
                <i className="pc-dot" aria-hidden="true" />
                {spotlightStatus(i.acting)}
              </span>
            </div>
            <div className="pc-id">
              <span className="pc-avatar" aria-hidden="true">
                {i.icon}
              </span>
              <span className="pc-name">{i.name}</span>
            </div>
            {i.thumbs.length > 0 && (
              <div className="pc-thumbs" aria-hidden="true">
                {i.thumbs.map((id, k) => (
                  <Thumb key={`${id}-${k}`} id={id} />
                ))}
                {i.thumbsExtra > 0 && (
                  <span className="pc-thumb pc-thumb--more">
                    +{i.thumbsExtra}
                  </span>
                )}
              </div>
            )}
            <div className="pc-foot">
              <div className="pc-field">
                <span className="pc-label">{strings.hud.spotlightCoins}</span>
                <span className="pc-value">
                  <CoinDots n={i.coins} cap={8} />
                  {i.coins}
                </span>
              </div>
              {i.missing !== null && (
                <div className="pc-field">
                  <span className="pc-label">{strings.hud.basket}</span>
                  <span className="pc-value">
                    {i.missing === 0
                      ? strings.panel.recipeDone
                      : strings.hud.spotlightMissing.replace('{n}', String(i.missing))}
                  </span>
                </div>
              )}
              {contact && onContact && (
                <button
                  type="button"
                  className="pc-contact"
                  aria-label={contact}
                  onClick={(e) => {
                    e.stopPropagation();
                    onContact();
                  }}
                >
                  <BasketGlyph />
                </button>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}
