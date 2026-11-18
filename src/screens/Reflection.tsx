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
import { missingIngredients } from '../game/selectors';
import { playerDisplayName, reflectionEntryText, reflectionOptionLabel, reflectionPrompt } from '../i18n/cardText';
import { orderOptions, reflectionDone } from '../ui/reflectionPick';
import { supportLevel } from '../ui/supportLevel';
import type { Command, GameState, Player } from '../game/types';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { Hand } from '../components/cards/Hand';
import { TiltCard } from '../components/cards/TiltCard';
import type { HandItem } from '../components/cards/Hand';

/** 自写选项 id（cards.json reflections.humanOptions 最后一项 rho-6） */
const FREE_OPTION_ID = 'rho-6';

/* 选项卡角装饰图标：数据无 icon 字段，按 id 固定一组（纯装饰，不进文案） */
const OPTION_ICON: Record<string, string> = {
  'rho-1': '🥗',
  'rho-2': '✋',
  'rho-3': '🤝',
  'rho-4': '🚌',
  'rho-5': '💬',
  'rho-6': '✏️',
};

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
  /* R10C：从她自己的账本推「今天真做到的事」——做到的选项排前、
     盖「做到了」小标，孩子挑真的那件说（education runner-up） */
  const me = state.players.find((p) => p.id === state.humanId);
  const done = me ? reflectionDone(state, me) : {};
  /* R10D（education #5）：第 3 圈且菜谱买齐的孩子，反思导语换成前瞻句
     「下次去买菜，你会先做哪一步？」；没买齐的孩子保留标准句（撤扶持
     只奖励通关的那条路径，不给还在追的孩子换题） */
  const recipeDone = me ? missingIngredients(me).length === 0 : false;
  const prompt =
    supportLevel(state.lap) === 3 && recipeDone
      ? strings.reflection.forwardPrompt
      : reflectionPrompt();
  const preset = orderOptions(
    options.filter((o) => o.id !== FREE_OPTION_ID),
    done,
  );
  const anyDone = preset.some((o) => done[o.id]);
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
  /* R10 Slice B：反思选项 = 手牌选择卡（§2.8）。预设项打出即选；
     自写项先翻开输入框（与旧按钮版同流程）。键位 1..n 不变。 */
  const optionItems: HandItem[] = preset.map((o) => {
    const k = ++n;
    const label = reflectionOptionLabel(o.id, o.label);
    return {
      key: o.id,
      name: label,
      speakText: label,
      node: (
        <TiltCard
          glare
          front={
            <CardView
              icon={OPTION_ICON[o.id] ?? '💬'}
              name={label}
              tag={done[o.id] ? strings.reflection.didIt : undefined}
              keyHint={String(k)}
              dataKey={k}
              primary={k === 1}
              testid={k === 1 ? 'action-primary' : `action-reflect-${o.id}`}
              ariaLabel={`${k} ${label}`}
              onClick={() => send({ type: 'CHOOSE_REFLECTION', optionId: o.id })}
            />
          }
        />
      ),
    };
  });
  const freeKey = ++n;

  return (
    <main className="intro-shell" data-testid="screen-reflection">
      <h1 className="intro-title intro-title--sm">{prompt}</h1>

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
                <span className="reflection-name">{playerDisplayName(p)}:</span> {reflectionEntryText(r)}
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
            {anyDone && (
              <p className="reflection-personal">{strings.reflection.personalHint}</p>
            )}
            <Hand
              className="reflection-hand"
              items={optionItems}
              ariaLabel={prompt}
            />
            {free && (
              <Button
                variant="secondary"
                keyHint={String(freeKey)}
                data-testid={`action-reflect-${free.id}`}
                data-key={freeKey}
                onClick={() => setWriteOwn(true)}
              >
                {OPTION_ICON[free.id]} {reflectionOptionLabel(free.id, free.label)}
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
