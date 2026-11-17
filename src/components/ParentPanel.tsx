/**
 * ParentPanel.tsx —— 06 AI 家长站（G5）。
 * parentUse：「现在用」/「这次先不用」（每人每局 1 次）。
 * parentAnswer：聊天气泡 + 图卡选项（数字键 1..n）+ 打字提交 + 语音占位
 *   （点了只提示不推进）；判定在引擎（图卡 tags / 打字 keywords），
 *   判不出时 AI 给图卡兜底（fallbackLine 进 log，这里显示为 AI 气泡）。
 * parentSettle：①②说清后「就这样吧（拿 1 币）」或「继续回答」。
 *
 * R7 真对话（src/parent/parentLive.ts）：本地构建注入了 DeepSeek key 时，
 * 问答区改为真对话——家长的话由大模型生成（按当前语言的系统提示词），
 * 图卡仍是快捷回复、打字照旧；孩子在真对话里给出的答案先记在面板里，
 * 道别后**原样回放给引擎**（PARENT_ANSWER 序列），说清判定与发币仍
 * 100% 由引擎按既有规则决定，LLM 碰不到币。对话任一步失败（超时/断网/
 * 接口错误）先由 parentLive 自动重试一次（~800ms，非超时失败才重试），
 * 仍失败则无缝切回下面的离线脚本流程（引擎对话还停在原地，
 * 孩子不会看到报错、不会卡住）。没有 key 时本文件行为与 R6/R8 完全一致。
 * R9：每个分支顶部有状态点——真对话绿「Live chat」/离线脚本灰
 * 「Offline script」，不再分不清当前走的是哪条路。
 */
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import {
  parentIntro,
  parentOptionLabel,
  parentQuestionText,
  parentSettleLabel,
  parentVoiceHint,
} from '../i18n/cardText';
import type { Command, GameState, ParentAnswer, ParentDialog } from '../game/types';
import { fetchParentReply, isGoodbyeTurn, parentLiveAvailable } from '../parent/parentLive';
import type { ParentTurn } from '../parent/parentLive';
import { Button } from './Button';
import { CardView } from './CardView';

interface LiveBubble {
  who: 'ai' | 'me' | 'sys';
  text: string;
  /** 本地提示（如语音占位）：只显示，不进 API 对话历史 */
  local?: boolean;
}

interface LiveSession {
  bubbles: LiveBubble[];
  /** 孩子在真对话里给出的答案，道别后按顺序回放给引擎判定 */
  answers: ParentAnswer[];
  turns: number;
  busy: boolean;
  done: boolean;
}

/** R9 状态点（仅展示）：真对话进行中绿点「Live chat/真对话」，
 *  离线脚本（未注入 key / 失败回退后）灰点「Offline script/离线脚本」。
 *  家长站每个渲染分支都挂在面板顶部，方便一眼分辨当前走的是哪条路。 */
function ParentStatus({ live }: { live: boolean }) {
  return (
    <p
      className={'parent-status' + (live ? ' parent-status--live' : '')}
      data-testid="parent-status"
      data-live={live ? 'on' : 'off'}
    >
      <span className="parent-status-dot" aria-hidden="true" />
      {live ? strings.parent.statusLive : strings.parent.statusOffline}
    </p>
  );
}

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

  /* —— R7 真对话会话状态 —— */
  const [live, setLive] = useState<LiveSession | null>(null);
  const liveCtl = useRef({ started: false, completing: false, settleWatch: false });
  const liveChatRef = useRef<HTMLDivElement>(null);
  const dialogOpen = !!d && d.playerId === me.id;

  /* R9 状态点取色：live 会话在 = 绿；还没启动过（parentUse 阶段或
     开场瞬间）按 key 预判——有 key 即将会话真对话 = 绿；一旦启动过
     而 live 落空（任一失败回退）= 灰；无 key 永远 = 灰。 */
  const statusLive = live !== null || (parentLiveAvailable() && !liveCtl.current.started);

  // 对话打开且本地有 key → 开一场真对话（每场只开一次；失败后 started
  // 保持 true，本局内不再重试，面板回退到离线脚本）。对话关闭 → 复位。
  useEffect(() => {
    if (dialogOpen && parentLiveAvailable() && !liveCtl.current.started) {
      liveCtl.current.started = true;
      setLive({ bubbles: [], answers: [], turns: 0, busy: false, done: false });
    }
    if (!d) {
      liveCtl.current.started = false;
      liveCtl.current.completing = false;
      liveCtl.current.settleWatch = false;
      setLive(null);
    }
  }, [dialogOpen, d]);

  // 真对话收尾回放后看引擎落点：已结束 → 无事；停在「就这样吧」→ 对话
  // 已经道别，按既有 PARENT_SETTLE 信号收尾（币数仍由引擎定）；还剩
  // 步数没判完 → 关掉真对话层，离线脚本从当前步继续（不会卡住）。
  useEffect(() => {
    if (!liveCtl.current.settleWatch) return;
    if (!d) {
      liveCtl.current.settleWatch = false;
      return;
    }
    if (pd.kind === 'parentSettle') {
      liveCtl.current.settleWatch = false;
      send({ type: 'PARENT_SETTLE' });
    } else if (pd.kind === 'parentAnswer') {
      liveCtl.current.settleWatch = false;
      setLive(null);
    }
  }, [pd.kind, d, send]);

  // 真对话聊天区滚到最新一条
  useEffect(() => {
    const el = liveChatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [live?.bubbles.length, live?.busy]);

  /* —— 开场：现在用 / 这次先不用 —— */
  if (pd.kind === 'parentUse') {
    return (
      <div className="panel-body">
        <ParentStatus live={statusLive} />
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

  /* —— R7 真对话（有 key 且会话进行中） —— */
  if (live) {
    const liveQ = questions[Math.min(live.turns, questions.length - 1)];

    const completeLive = (answers: ParentAnswer[]) => {
      if (liveCtl.current.completing) return;
      liveCtl.current.completing = true;
      liveCtl.current.settleWatch = true;
      for (const a of answers) send({ type: 'PARENT_ANSWER', answer: a });
    };

    const liveAnswer = async (answer: ParentAnswer, displayText: string) => {
      if (live.busy || live.done) return;
      const turns = live.turns + 1;
      const answers = [...live.answers, answer];
      const history: ParentTurn[] = [
        { role: 'assistant', content: parentIntro() },
        { role: 'assistant', content: parentQuestionText(questions[0]) },
        ...live.bubbles
          .filter((b) => !b.local && b.who !== 'sys')
          .map<ParentTurn>((b) => ({
            role: b.who === 'ai' ? 'assistant' : 'user',
            content: b.text,
          })),
        { role: 'user', content: displayText },
      ];
      setLive({
        ...live,
        bubbles: [...live.bubbles, { who: 'me', text: displayText }],
        answers,
        turns,
        busy: true,
      });
      try {
        const reply = await fetchParentReply({ history, childTurns: turns });
        const doneNow = isGoodbyeTurn(turns);
        setLive((cur) =>
          cur
            ? {
                ...cur,
                bubbles: [...cur.bubbles, { who: 'ai', text: reply }],
                busy: false,
                done: doneNow,
              }
            : cur,
        );
        if (doneNow) {
          // 让孩子看完道别再收尾结算
          setTimeout(() => completeLive(answers), 1800);
        }
      } catch {
        // 任一失败：无缝回退离线脚本（引擎对话未动，从当前步继续答）
        setLive(null);
      }
    };

    const submitLiveText = (e: FormEvent) => {
      e.preventDefault();
      const t = text.trim();
      if (!t) return;
      setText('');
      void liveAnswer({ mode: 'text', text: t }, t);
    };

    return (
      <div className="panel-body">
        <ParentStatus live={statusLive} />
        <div className="chat" data-testid="parent-chat" ref={liveChatRef}>
          <p className="chat-bubble chat-bubble--ai">{parentIntro()}</p>
          <p className="chat-bubble chat-bubble--ai">{parentQuestionText(questions[0])}</p>
          {live.bubbles.map((b, i) =>
            b.who === 'sys' ? (
              <p key={i} className="chat-system">
                {b.text}
              </p>
            ) : (
              <p key={i} className={`chat-bubble chat-bubble--${b.who}`}>
                {b.text}
              </p>
            ),
          )}
          {live.busy && (
            <p className="chat-bubble chat-bubble--ai" aria-live="polite">
              {strings.game.thinking}
            </p>
          )}
        </div>
        <p className="panel-subtitle">
          {fmt(strings.parent.questionOf, {
            a: Math.min(live.turns + 1, questions.length),
            b: questions.length,
          })}{' '}
          · {strings.parent.pickHint}
        </p>
        <div className="parent-options">
          {liveQ.options.map((o, i) => (
            <CardView
              key={o.id}
              icon={o.icon}
              name={parentOptionLabel(o)}
              keyHint={String(i + 1)}
              dataKey={i + 1}
              primary={i === 0}
              testid={i === 0 ? 'action-primary' : `action-parent-${o.id}`}
              ariaLabel={`${i + 1} ${parentOptionLabel(o)}`}
              onClick={() => void liveAnswer({ mode: 'card', optionId: o.id }, parentOptionLabel(o))}
            />
          ))}
        </div>
        <div className="panel-foot">
          <form className="parent-input-row" onSubmit={submitLiveText}>
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
              disabled={!text.trim() || live.busy || live.done}
            >
              {strings.parent.sendText}
            </Button>
            <Button
              variant="secondary"
              data-testid="action-parent-voice"
              aria-label={strings.parent.voiceBtn}
              onClick={() =>
                setLive((cur) =>
                  cur
                    ? {
                        ...cur,
                        bubbles: [...cur.bubbles, { who: 'ai', text: parentVoiceHint(), local: true }],
                      }
                    : cur,
                )
              }
            >
              🎤 {strings.parent.voiceBtn}
            </Button>
          </form>
          <p className="panel-keyhelp">{strings.parent.ruleNote}</p>
        </div>
      </div>
    );
  }

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
        <ParentStatus live={statusLive} />
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
      <ParentStatus live={statusLive} />
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
