/**
 * CookPanel.tsx —— 08 回家一起做饭（第 1、2 圈）：
 * 把已有材料放进自己的盘子位（ACK 确认），随后进「我的篮子」圈末小结。
 * R10 Slice C（play #2 / motion #7）：组装演出一眼看得见——
 * 已收食材卡逐张「飞进锅」（JS 量好到锅心的 --fx/--fy，错峰 ≤500ms
 * 内全部落锅），锅里随即长出菜谱成品菜（弹簧入场 + 蒸汽两朵），
 * 集齐时成品盖 CSS foil 闪光 + PlaySpark。纯表现，命令仍是 ACK。
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { getIngredient, getRecipe } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import type { Command, GameState } from '../game/types';
import { Button } from './Button';
import { CardView } from './CardView';
import { playSparkAt } from './cards/PlaySpark';
import { cardArtFor } from './cards/cardArt';
import { RecipeCard } from './RecipeCard';

const FLY_MS = 220; // 单张飞锅时长
const STAGGER_MS = 50; // 逐张错峰（5 张全落锅 ≈ 420ms < 500ms 预算）

export function CookPanel({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const me = state.players.find((p) => p.isHuman)!;
  const recipe = me.recipeId ? getRecipe(me.recipeId) : null;
  const complete =
    recipe != null && recipe.ingredientIds.every((id) => me.collected.includes(id));
  const dishArt = recipe ? cardArtFor(recipe.id) : undefined;
  const recipeRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const sparked = useRef(false);
  const n = me.collected.length;
  const dishDelay = n * STAGGER_MS + FLY_MS;
  /* R10E（§3 大卡时刻）：集齐时成品菜以「大卡」弹到舞台等点——
     点掉才见 OK（命令照旧 ACK，节奏与旧「自动弹成品+OK」等价） */
  const [dishPop, setDishPop] = useState<'wait' | 'show' | 'done'>('wait');
  /* R1-E2：等待段可点击跳过——定时器存 ref，点舞台即清掉并立即
     显示大卡（飞锅动画照常在 CSS 层播，点的是「等」不是「演」） */
  const dishTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!complete || dishPop !== 'wait') return undefined;
    dishTimer.current = window.setTimeout(
      () => setDishPop('show'),
      dishDelay + 320,
    );
    return () => {
      if (dishTimer.current !== null) window.clearTimeout(dishTimer.current);
      dishTimer.current = null;
    };
  }, [complete, dishPop, dishDelay]);

  const skipDishWait = () => {
    if (!complete || dishPop !== 'wait') return;
    if (dishTimer.current !== null) window.clearTimeout(dishTimer.current);
    dishTimer.current = null;
    setDishPop('show');
  };

  // 量出每张食材卡到锅心的位移，写成 --fx/--fy 由 CSS keyframe 飞过去
  useEffect(() => {
    const line = lineRef.current;
    const pan = panRef.current;
    if (!line || !pan) return;
    const pr = pan.getBoundingClientRect();
    const px = pr.left + pr.width / 2;
    const py = pr.top + pr.height / 2;
    for (const el of line.querySelectorAll<HTMLElement>('.cook-card')) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--fx', `${px - (r.left + r.width / 2)}px`);
      el.style.setProperty('--fy', `${py - (r.top + r.height / 2)}px`);
    }
  }, [n]);

  useEffect(() => {
    if (complete && !sparked.current) {
      sparked.current = true;
      const t = window.setTimeout(
        () => playSparkAt(panRef.current ?? recipeRef.current),
        dishDelay,
      );
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [complete, dishDelay]);

  return (
    <div className="panel-body">
      <p className="panel-text">{strings.panel.cookPut}</p>

      <div
        className={
          'cook-stage' + (complete && dishPop === 'wait' ? ' cook-stage--waiting' : '')
        }
        data-testid="cook-stage"
        onClick={skipDishWait}
      >
        {/* 大锅/盘：食材卡飞进来，成品菜从这里长出来 */}
        <div className="cook-pan" ref={panRef} aria-hidden="true">
          <span
            className={`cook-dish${complete ? ' card-foil' : ''}`}
            style={{ '--dish-delay': `${dishDelay}ms` } as CSSProperties}
          >
            {dishArt ? (
              <img className="cook-dish-img" src={dishArt} alt="" draggable={false} />
            ) : (
              <span className="cook-dish-icon">{recipe?.icon ?? '🍲'}</span>
            )}
          </span>
          <span className="cook-steam cook-steam--a" style={{ '--dish-delay': `${dishDelay}ms` } as CSSProperties} />
          <span className="cook-steam cook-steam--b" style={{ '--dish-delay': `${dishDelay}ms` } as CSSProperties} />
        </div>

        {me.collected.length > 0 && (
          <div className="cook-line" ref={lineRef} aria-hidden="true">
            {me.collected.map((id, i) => {
              const ing = getIngredient(id);
              return (
                <span
                  key={`${id}-${i}`}
                  className="cook-card"
                  style={{ '--stagger': `${i * STAGGER_MS}ms` } as CSSProperties}
                >
                  <CardView cardId={id} icon={ing?.icon ?? '❔'} name={cardName(id)} />
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div ref={recipeRef}>
        <RecipeCard recipeId={me.recipeId} collected={me.collected} />
      </div>
      {recipe && (
        <p className="panel-text">
          {fmt(strings.screens.progress, {
            a: me.collected.length,
            b: recipe.ingredientIds.length,
          })}
        </p>
      )}

      {/* R10E（§3）：成品大卡时刻——菜出锅弹到世界中心等孩子点掉，
          期间 OK 不出场（避免两颗「主按钮」抢戏） */}
      {complete && dishPop === 'show' && (
        <div className="moment-pop-wrap">
          <button
            type="button"
            className="moment-card"
            data-testid="dish-card"
            data-key={1}
            data-primary="true"
            aria-label={strings.panel.dishReady}
            onClick={() => setDishPop('done')}
          >
            <span className="card-foil">
              <CardView
                cardId={recipe!.id}
                icon={recipe!.icon}
                name={cardName(recipe!.id)}
              />
            </span>
            <span className="moment-tap" aria-hidden="true">
              {strings.panel.dishReady}
            </span>
          </button>
        </div>
      )}

      {dishPop !== 'show' && (
        <Button
          variant="primary"
          keyHint="1"
          data-testid="action-primary"
          data-primary="true"
          data-key={1}
          onClick={() => send({ type: 'ACK' })}
        >
          {strings.actions.ok}
        </Button>
      )}
    </div>
  );
}
