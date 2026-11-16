/**
 * Reflection.tsx —— 每人说一个最满意的决定（REQUIREMENTS §4.7）。
 * 真人回合：预设选项按钮 [1..n]（自写项 rho-6 展开输入框，提交带 freeText）；
 * bot 回合由 useBotDriver 自动提交，台词直接出现在列表里；
 * 全部说完（phase='finished'）：「再玩一局」。
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import type { Command, GameState, Player } from '../game/types';
import { Button } from '../components/Button';

/** 自写选项 id（cards.json reflections.humanOptions 最后一项 rho-6） */
const FREE_OPTION_ID = 'rho-6';

/** 角色小头像：真人用所选角色图标，bot 用性格卡图标（cards.json icon 字段） */
function avatarOf(p: Player): string {
  return (
    cards.characters.find((c) => c.id === p.characterId)?.icon ??
    cards.bots.find((b) => b.id === p.characterId)?.icon ??
    '●'
  );
}

export function Reflection({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const pd = state.pendingDecision;
  const humanPending =
    state.phase === 'reflection' && pd.kind === 'reflection' && pd.playerId === state.humanId;
  const finished = state.phase === 'finished';
  const [writeOwn, setWriteOwn] = useState(false);
  const [freeText, setFreeText] = useState('');

  const options = cards.reflections.humanOptions;
  const preset = options.filter((o) => o.id !== FREE_OPTION_ID);
  const free = options.find((o) => o.id === FREE_OPTION_ID);
  // 卡片顺序 = 开饭页座位顺序（players 即座位序，真人 p0 固定左上）；
  // 引擎按座位序依次提问，reflections 本来就是前缀，这里再按 players 显式排
  const said = new Map(state.reflections.map((r) => [r.playerId, r]));

  const submitFree = (e: FormEvent) => {
    e.preventDefault();
    const t = freeText.trim();
    if (!t) return;
    send({ type: 'CHOOSE_REFLECTION', optionId: FREE_OPTION_ID, freeText: t });
  };

  let n = 0;

  return (
    <main className="intro-shell" data-testid="screen-reflection">
      <h1 className="intro-title intro-title--sm">{cards.reflections.prompt}</h1>

      <section className="reflection-list" aria-live="polite">
        {state.players.map((p) => {
          const r = said.get(p.id);
          if (!r) return null;
          return (
            <p
              key={p.id}
              className="reflection-card"
              data-testid={`reflection-card-${p.id}`}
            >
              <span className="reflection-avatar" aria-hidden="true">
                {avatarOf(p)}
              </span>
              <span className="reflection-text">
                <span className="reflection-name">{p.name}:</span> {r.text}
              </span>
            </p>
          );
        })}
        {!finished && !humanPending && (
          <p className="reflection-line reflection-line--muted">
            {strings.reflection.waitingBots}
          </p>
        )}
      </section>

      {finished && (
        <p className="reflection-note" data-testid="reflection-done">
          {strings.reflection.everyoneSaid}
        </p>
      )}

      {finished ? (
        <Button
          variant="primary"
          data-testid="action-replay"
          data-primary="true"
          data-key={1}
          onClick={() => send({ type: 'RESTART' })}
        >
          {strings.buttons.replay}
        </Button>
      ) : (
        humanPending && (
          <div className="reflection-options">
            {preset.map((o) => {
              const k = ++n;
              return (
                <Button
                  key={o.id}
                  variant={k === 1 ? 'primary' : 'secondary'}
                  keyHint={String(k)}
                  data-testid={k === 1 ? 'action-primary' : `action-reflect-${o.id}`}
                  data-primary={k === 1 ? 'true' : undefined}
                  data-key={k}
                  onClick={() => send({ type: 'CHOOSE_REFLECTION', optionId: o.id })}
                >
                  {o.label}
                </Button>
              );
            })}
            {free && (
              <Button
                variant="secondary"
                keyHint={String(++n)}
                data-testid={`action-reflect-${free.id}`}
                data-key={n}
                onClick={() => setWriteOwn(true)}
              >
                {free.label}
              </Button>
            )}
            {writeOwn && (
              <form className="reflection-write" onSubmit={submitFree}>
                <input
                  className="parent-input"
                  type="text"
                  value={freeText}
                  data-testid="reflection-input"
                  placeholder={strings.reflection.placeholder}
                  aria-label={strings.reflection.placeholder}
                  onChange={(e) => setFreeText(e.target.value)}
                />
                <Button
                  variant="secondary"
                  type="submit"
                  data-testid="action-reflect-submit"
                  disabled={!freeText.trim()}
                >
                  {strings.parent.sendText}
                </Button>
              </form>
            )}
          </div>
        )
      )}
    </main>
  );
}
