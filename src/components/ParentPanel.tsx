/**
 * ParentPanel.tsx —— 06 AI 家长站（G5）。
 * parentUse：「现在用」/「这次先不用」（每人每局 1 次）。
 * parentAnswer：聊天气泡 + 图卡选项（数字键 1..n）+ 打字提交 + 语音占位
 *   （点了只提示不推进）；判定在引擎（图卡 tags / 打字 keywords），
 *   判不出时 AI 给图卡兜底（fallbackLine 进 log，这里显示为 AI 气泡）。
 * parentSettle：①②说清后「就这样吧（拿 1 币）」或「继续回答」。
 */
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import { parentIntro, parentOptionLabel, parentQuestionText, parentSettleLabel } from '../i18n/cardText';
import type { Command, GameState, ParentDialog } from '../game/types';
import { Button } from './Button';
import { CardView } from './CardView';

export function ParentPanel({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const pd = state.pendingDecision;
  const d = state.parentDialog;
  const me = state.players.find((p) => p.isHuman)!;
  const [text, setText] = useState('');
  const data = cards.parentStation;

  /* —— 开场：现在用 / 这次先不用 —— */
  if (pd.kind === 'parentUse') {
    return (
      <div className="panel-body">
        <div className="chat">
          <p className="chat-bubble chat-bubble--ai">{parentIntro()}</p>
        </div>
        <div className="panel-actions">
          <Button
            variant="primary"
            keyHint="1"
            data-testid="action-primary"
            data-primary="true"
            data-key={1}
            speakText={strings.parent.useNow}
            onClick={() => send({ type: 'PARENT_BEGIN' })}
          >
            {strings.parent.useNow}
          </Button>
          <Button
            variant="secondary"
            keyHint="2"
            data-testid="action-2"
            data-key={2}
            onClick={() => send({ type: 'PARENT_SKIP' })}
          >
            {strings.parent.useLater}
          </Button>
        </div>
        <p className="panel-keyhelp">{strings.parent.ruleNote}</p>
      </div>
    );
  }

  if (!d || d.playerId !== me.id) return null;
  const questions = data.questions;
  const step = Math.min(d.step, questions.length - 1);
  const q = questions[step];
  // AI 家长真正说的话带 asAi 标记（兜底/语音提示）；其余日志是系统提示，
  // 绝不放进 AI 气泡，单独用居中小字灰行展示（ADAPTATION 第 8 条）
  const mine = state.log.filter((e) => e.playerId === me.id);
  const lastAi = [...mine].reverse().find((e) => e.asAi)?.text;
  const lastSystem = [...mine].reverse().find((e) => !e.asAi)?.text;

  const submitText = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    send({ type: 'PARENT_ANSWER', answer: { mode: 'text', text: t } });
  };

  /* —— ①②说清后的「就这样吧 / 继续回答」—— */
  if (pd.kind === 'parentSettle') {
    return (
      <div className="panel-body">
        <ChatHistory d={d} aiText={lastAi} systemText={lastSystem} />
        <div className="panel-actions">
          <Button
            variant="primary"
            keyHint="1"
            data-testid="action-primary"
            data-primary="true"
            data-key={1}
            speakText={parentSettleLabel()}
            onClick={() => send({ type: 'PARENT_SETTLE' })}
          >
            {parentSettleLabel()}
          </Button>
          <Button
            variant="secondary"
            keyHint="2"
            data-testid="action-2"
            data-key={2}
            onClick={() => send({ type: 'ACK' })}
          >
            {strings.parent.settleGo}
          </Button>
        </div>
        <p className="panel-keyhelp">{strings.parent.ruleNote}</p>
      </div>
    );
  }

  /* —— 问答（图卡 + 打字 + 语音占位）—— */
  return (
    <div className="panel-body">
      <ChatHistory d={d} aiText={lastAi} systemText={lastSystem} />
      <p className="panel-subtitle">
        {fmt(strings.parent.questionOf, { a: step + 1, b: questions.length })} ·{' '}
        {strings.parent.pickHint}
      </p>
      <div className="parent-options">
        {q.options.map((o, i) => (
          <CardView
            key={o.id}
            icon={o.icon}
            name={parentOptionLabel(o)}
            keyHint={String(i + 1)}
            dataKey={i + 1}
            primary={i === 0}
            testid={i === 0 ? 'action-primary' : `action-parent-${o.id}`}
            ariaLabel={`${i + 1} ${parentOptionLabel(o)}`}
            onClick={() => send({ type: 'PARENT_ANSWER', answer: { mode: 'card', optionId: o.id } })}
          />
        ))}
      </div>
      <div className="panel-foot">
        <form className="parent-input-row" onSubmit={submitText}>
          <input
            className="parent-input"
            type="text"
            value={text}
            data-testid="parent-text-input"
            placeholder={strings.parent.typePlaceholder}
            aria-label={strings.parent.typePlaceholder}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            variant="secondary"
            type="submit"
            data-testid="action-parent-text"
            disabled={!text.trim()}
          >
            {strings.parent.sendText}
          </Button>
          <Button
            variant="secondary"
            data-testid="action-parent-voice"
            aria-label={strings.parent.voiceBtn}
            onClick={() => send({ type: 'PARENT_ANSWER', answer: { mode: 'voice' } })}
          >
            🎤 {strings.parent.voiceBtn}
          </Button>
        </form>
        <p className="panel-keyhelp">{strings.parent.ruleNote}</p>
      </div>
    </div>
  );
}

/** 聊天气泡：AI 家长提问在左，已答清的问题右侧打「✓ 说清楚了」；
 *  系统提示（如「小禾 去找 AI 家长聊了聊」）走居中小字灰行，不进气泡 */
function ChatHistory({
  d,
  aiText,
  systemText,
}: {
  d: ParentDialog;
  aiText?: string;
  systemText?: string;
}) {
  const questions = cards.parentStation.questions;
  const upto = Math.min(d.step, questions.length - 1);
  const ref = useRef<HTMLDivElement>(null);
  // 竖屏聊天区限高：每次换问题都滚到最新一条，当前问题永远看得见
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [d.step, d.offerSettle, aiText]);
  return (
    <div className="chat" data-testid="parent-chat" ref={ref}>
      {systemText && (
        <p className="chat-system" data-testid="chat-system" aria-live="polite">
          {systemText}
        </p>
      )}
      <p className="chat-bubble chat-bubble--ai">{parentIntro()}</p>
      {questions.slice(0, upto + 1).map((qq, i) => (
        <span key={qq.id} className="chat-pair">
          <p className="chat-bubble chat-bubble--ai">{parentQuestionText(qq)}</p>
          {(i < upto || (i === upto && d.offerSettle)) && (
            <p className="chat-bubble chat-bubble--me">{strings.parent.clearedMark}</p>
          )}
        </span>
      ))}
      {aiText && (
        <p className="chat-bubble chat-bubble--ai" aria-live="polite">
          {aiText}
        </p>
      )}
    </div>
  );
}
