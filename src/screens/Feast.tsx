/**
 * Feast.tsx —— 一起开饭（G6）。
 * 一张浅色长桌上并排 4 张盘子卡：圆盘图 + 名字 + 菜名 + 结局标签
 * （完整的菜 / 简单的菜 / 下次补上，顺序固定为座位顺序，不排序、不比较）。
 * 按钮：① 看看钱花到哪了（真人自己的流水，分组小计）→ 一起说决定；
 *       ② 再玩一局（RESTART）。
 * 竖屏 2×2 盘子网格、按钮纵向全宽（媒体查询）。
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { getRecipe } from '../data/cards';
import { coinWord, strings } from '../data/strings';
import { moneyLedger } from '../game/selectors';
import { fmt } from '../game/stations/shared';
import { cardName, playerDisplayName } from '../i18n/cardText';
import type { Command, GameState, PlateResult } from '../game/types';
import { Button } from '../components/Button';
import { CardIcon } from '../components/CardIcon';
import { cardArtFor, cardBgFor } from '../components/cards/cardArt';
import { CoinCounter } from '../components/cards/CoinCounter';
import { playSparkAt } from '../components/cards/PlaySpark';

/* R6：不能放模块级 —— 语言切换时要按当前语言现取（模块级会冻住英文） */
function kindLabel(kind: PlateResult['kind']): string {
  return {
    full: strings.feast.plateFull,
    simple: strings.feast.plateSimple,
    shadow: strings.feast.plateShadow,
  }[kind];
}

function plateNote(plate: PlateResult): string {
  if (plate.kind === 'full') return strings.feast.noteFull;
  if (plate.kind === 'simple') return fmt(strings.feast.noteSimple, { n: plate.missing.length });
  return strings.feast.noteShadow;
}

export function Feast({ state, send }: { state: GameState; send: (c: Command) => unknown }) {
  const [showLedger, setShowLedger] = useState(false);
  const human = state.players.find((p) => p.isHuman)!;
  // R10 Slice B：满盘（菜谱集齐）的盘子各迸一次 PlaySpark（§3.3 开饭高光）
  const tableRef = useRef<HTMLDivElement | null>(null);
  const sparkedRef = useRef(false);
  const anyFull = (state.plates ?? []).some((p) => p.kind === 'full');
  useEffect(() => {
    if (anyFull && !showLedger && !sparkedRef.current) {
      sparkedRef.current = true;
      playSparkAt(tableRef.current);
    }
  }, [anyFull, showLedger]);

  if (showLedger) {
    const ledger = moneyLedger(state, human.id);
    return (
      <main className="intro-shell" data-testid="screen-feast">
        <h1 className="intro-title intro-title--sm">{strings.ledger.title}</h1>
        <div className="ledger" data-testid="ledger">
          <p className="ledger-line ledger-line--start">
            {fmt(strings.ledger.start, { n: ledger.startCoins })}
          </p>
          <div className="ledger-scroll">
            {ledger.groups.map((g) => (
              <section key={g.kind} className="ledger-group">
                <p className="ledger-group-title">
                  {g.label}
                  <span className="ledger-group-total">
                    {fmt(strings.ledger.groupTotal, { n: g.total })}
                  </span>
                </p>
                {g.lines.map((l) => (
                  <p key={l.id} className="ledger-line">
                    {g.kind === 'gain' ? '+' : '−'}
                    {l.coins} {coinWord(l.coins)} ·{' '}
                    {l.lap !== undefined && (
                      <span className="ledger-line-lap">
                        {fmt(strings.ledger.lapTag, { n: l.lap })} ·{' '}
                      </span>
                    )}
                    {l.text}
                  </p>
                ))}
              </section>
            ))}
          </div>
          <p className="ledger-line ledger-line--left">
            {/* R10 Slice B：句中数字换成 CoinCounter 滚动位（§2.8 币总计） */}
            {strings.ledger.left.split('{n}')[0]}
            <CoinCounter
              value={ledger.coinsLeft}
              label={fmt(strings.ledger.left, { n: ledger.coinsLeft })}
              className="ledger-coins"
            />
            {strings.ledger.left.split('{n}')[1]}
          </p>
          {ledger.busDebt > 0 && (
            <p className="ledger-line screen-note">
              {fmt(strings.ledger.debtLeft, { n: ledger.busDebt })}
            </p>
          )}
        </div>
        <div className="feast-actions">
          <Button
            variant="primary"
            data-testid="action-primary"
            data-primary="true"
            data-key={1}
            onClick={() => send({ type: 'ACK' })}
          >
            {strings.feast.toReflection}
          </Button>
          <Button
            variant="secondary"
            data-testid="action-2"
            data-key={2}
            onClick={() => setShowLedger(false)}
          >
            {strings.feast.ledgerBack}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="intro-shell" data-testid="screen-feast">
      <h1 className="intro-title intro-title--sm">{strings.feast.title}</h1>
      <p className="screen-note">{strings.feast.subtitle}</p>
      <div className="feast-table" ref={tableRef}>
        {(state.plates ?? []).map((plate, i) => {
          const p = state.players.find((x) => x.id === plate.playerId)!;
          const recipe = p.recipeId ? getRecipe(p.recipeId) : null;
          return (
            <div
              key={plate.playerId}
              className={`plate-card plate-card--${plate.kind}${plate.kind === 'full' ? ' card-foil' : ''} plate-in`}
              style={
                {
                  '--stagger': `${i * 60}ms`,
                  // T-1：盘卡底色 = 菜品插画底色（与 CardView 同口径）
                  ...(recipe ? { '--card-bg': cardBgFor(recipe.id) } : {}),
                } as CSSProperties
              }
              data-testid={`plate-${plate.playerId}`}
            >
              <span className={`plate-disc plate-disc--${plate.kind}`} aria-hidden="true">
                {recipe && cardArtFor(recipe.id) ? (
                  <img className="plate-art" src={cardArtFor(recipe.id)} alt="" draggable={false} />
                ) : (
                  <CardIcon icon={recipe?.icon ?? '🍽️'} />
                )}
              </span>
              <span className="plate-name">{playerDisplayName(p)}</span>
              <span className="plate-dish">{recipe ? cardName(recipe.id) : '—'}</span>
              <span className="plate-kind">{kindLabel(plate.kind)}</span>
              <span className="plate-note">{plateNote(plate)}</span>
            </div>
          );
        })}
      </div>
      <div className="feast-actions">
        <Button
          variant="primary"
          keyHint="1"
          data-testid="action-primary"
          data-primary="true"
          data-key={1}
          onClick={() => setShowLedger(true)}
        >
          {strings.feast.ledgerBtn}
        </Button>
        <Button
          variant="secondary"
          keyHint="2"
          data-testid="action-2"
          data-key={2}
          onClick={() => send({ type: 'RESTART' })}
        >
          {strings.buttons.replay}
        </Button>
      </div>
    </main>
  );
}
