/**
 * TearTicket.tsx —— React Bits「Tear Ticket」自包含改写（MIT +
 * Commons Clause，署名见 THIRD_PARTY_NOTICES.md）。原版是按住票根
 * 往外撕（drag-to-tear）的车票；本游戏给 1–3 年级孩子用，精细拖拽
 * 不合适 → 改成「点一下就撕」（tap-to-tear），撕裂状态由外部受控：
 * BusPanel 的「选中车票」即撕，再点取消 = 票根贴回（反放同一过渡）。
 *
 * 视觉：横版车票 = 票身（打孔撕缝线 + 上下检票口缺口）+ 票根，
 * 撕离时票根向外下飞旋渐隐（CSS transition，无 @keyframes、无 motion
 * 依赖）；reduced-motion 下位移归零（仅 opacity 兜底档统一处理）。
 * 纯展示组件：交互语义由外层元素（按钮/拖拽壳）承担。
 */
import type { ReactNode } from 'react';

export interface TearTicketProps {
  /** 票价主字（如 '2 coins'；免票时不给） */
  fare?: string;
  /** 票名（'Bus ticket'） */
  name: string;
  /** 副行小字（如 'Not enough coins' / 'I already have my ticket'） */
  sub?: string;
  /** 票根内容（默认 🚌） */
  stub?: ReactNode;
  /** true = 已撕（票根飞走），false = 整票 */
  torn: boolean;
  className?: string;
}

export function TearTicket({ fare, name, sub, stub, torn, className = '' }: TearTicketProps) {
  return (
    <span className={`rb-tt${torn ? ' rb-tt--torn' : ''}${className ? ` ${className}` : ''}`}>
      <span className="rb-tt-notch rb-tt-notch--top" aria-hidden="true" />
      <span className="rb-tt-notch rb-tt-notch--bottom" aria-hidden="true" />
      <span className="rb-tt-body">
        <span className="rb-tt-ico" aria-hidden="true">
          🚌
        </span>
        {fare && <span className="rb-tt-fare">{fare}</span>}
        <span className="rb-tt-name">{name}</span>
        {sub && <span className="rb-tt-sub">{sub}</span>}
      </span>
      <span className="rb-tt-stub" aria-hidden="true">
        {stub ?? '🚌'}
      </span>
    </span>
  );
}
