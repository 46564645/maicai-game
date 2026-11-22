/**
 * CoinBar.tsx —— R10C（education #1 / UI runner-up）新加坡条形图金币条：
 * 把 walletSummary 的抽象三段（菜谱还差 / 车费 / 自由花）画成一排金币格，
 * 选中卡时从「自由花」端开始点亮它要吃掉的格子；价格溢出到菜谱/车费
 * 段的格子会警示脉动。纯派生数据展示，不产生任何命令。
 */
import { strings } from '../../data/strings';
import { fmt } from '../../game/stations/shared';
import { coinDeltaText, useCoinDelta } from '../../ui/useCoinDelta';
import { AnimatedContent } from '../bits/AnimatedContent';
import { CoinCounter } from './CoinCounter';

interface Cell {
  key: string;
  seg: 'recipe' | 'bus' | 'free';
  lit: 'idle' | 'spend' | 'warn';
}

/** WS3 C2：算式「12 − 3 → 9」的结果位换成 CoinCounter 滚动数字——
    教学格式与前两位静态不变，三处 .cb-math 共用同一段；父级已
    aria-hidden（读屏口径不变），label 仍供 CoinCounter 的 live 文案 */
export function CoinMath({
  coins,
  spend,
  className = '',
}: {
  coins: number;
  spend: number;
  className?: string;
}) {
  const after = Math.max(0, coins - spend);
  const [pre, post] = strings.coinbar.math.split('{c}');
  return (
    <span className={`cb-math ${className}`.trim()} aria-hidden="true">
      {fmt(pre, { a: coins, b: spend })}
      <CoinCounter
        value={after}
        label={fmt(strings.coinbar.math, { a: coins, b: spend, c: after })}
      />
      {post}
    </span>
  );
}

export function CoinBar({
  coins,
  missingCost,
  busDebt,
  spend = 0,
  hideMath = false,
}: {
  coins: number;
  /** 菜谱还差的菜价总额（walletSummary.missingCost） */
  missingCost: number;
  /** 待付车费（walletSummary.busDebt） */
  busDebt: number;
  /** 选中卡的单价：从自由花端点亮 spend 格，溢出段警示脉动 */
  spend?: number;
  /** R2-14：算式不渲染在金币条下（市场站改由面板放进按钮同一行） */
  hideMath?: boolean;
}) {
  // 段长 clamp：币不够时菜谱段先占位，车费/自由花依次收缩
  const recipe = Math.max(0, Math.min(missingCost, coins));
  const bus = Math.max(0, Math.min(busDebt, coins - recipe));
  const free = Math.max(0, coins - recipe - bus);

  const cells: Cell[] = [];
  const push = (seg: Cell['seg'], n: number) => {
    for (let i = 0; i < n; i++) cells.push({ key: `${seg}-${i}`, seg, lit: 'idle' });
  };
  push('recipe', recipe);
  push('bus', bus);
  push('free', free);

  // 消费从「自由花」端（数组尾）往回吃；吃到菜谱/车费段的格 → warn
  let left = Math.max(0, spend);
  for (let i = cells.length - 1; i >= 0 && left > 0; i--) {
    cells[i].lit = cells[i].seg === 'free' ? 'spend' : 'warn';
    left--;
  }

  // 手感审计 #2：币数落地变化时，条旁升起一枚增减小片（+2 / −3）
  const chip = useCoinDelta(coins);

  const segCells = (seg: Cell['seg']) => cells.filter((c) => c.seg === seg);
  const seg = (name: Cell['seg'], label: string) =>
    segCells(name).length > 0 && (
      <span className={`cb-seg cb-seg--${name}`} key={name}>
        {/* R2-13（E4 口径）：物理金币点旁一律带等宽数字 */}
        <span className="cb-cells-row">
          <span className="cb-cells" aria-hidden="true">
            {segCells(name).map((c) => (
              <i key={c.key} className={`cb-cell cb-cell--${c.lit}`} />
            ))}
          </span>
          <span className="cb-num">{segCells(name).length}</span>
        </span>
        <span className="cb-label">{label}</span>
      </span>
    );

  return (
    <div className="coin-bar">
      {chip && (
        /* WS3 C5：同钱包小片——AnimatedContent（motion）升起+淡出，
           animation:none 摘掉对 CSS 关键帧的依赖（F26 归 WS5 收编） */
        <AnimatedContent
          key={chip.stamp}
          className="coin-delta-chip"
          style={{ animation: 'none' }}
          aria-hidden="true"
          distance={4}
          duration={0.17}
          disappearAfter={0.44}
          disappearDuration={0.5}
          exitDistance={-13}
        >
          {coinDeltaText(chip.delta)}
        </AnimatedContent>
      )}
      <div
        className="cb-segs"
        role="img"
        aria-label={`${coins} − ${spend} → ${coins - spend}`}
      >
        {seg('recipe', strings.coinbar.recipe)}
        {seg('bus', strings.coinbar.bus)}
        {seg('free', strings.coinbar.free)}
      </div>
      {spend > 0 && !hideMath && <CoinMath coins={coins} spend={spend} />}
    </div>
  );
}
