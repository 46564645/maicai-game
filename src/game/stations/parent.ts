/**
 * parent.ts —— 06 AI 家长站。
 * 每人每局 1 次、最多 2 币：说清①②→1 币，再说清③④→2 币；图卡看 tags、
 * 打字看 keywords（判不出 AI 给图卡兜底）；「方案合规就必须同意」
 * （mustApproveCompliantPlan 默认 true，合规即按说清数发币，不追问不比较）。
 */
import { cards } from '../../data/cards';
import { gameConfig } from '../../config/gameConfig';
import { strings } from '../../data/strings';
import { parentApproveLine, parentFallbackLine, parentVoiceHint } from '../../i18n/cardText';
import type { GameState, ParentAnswer } from '../types';
import * as S from './shared';
import type { Outcome } from './shared';

export function parentBegin(state: GameState): Outcome {
  const actor = S.currentActorId(state);
  if (!actor) return S.bad('ERR_PHASE');
  const p = S.getPlayer(state, actor);
  if (p.parentUsed) return S.bad('ERR_LIMIT');
  let s = S.updatePlayer(state, actor, (x) => ({ ...x, parentUsed: true }));
  s = {
    ...s,
    parentDialog: { playerId: actor, step: 0, cleared: [false, false, false, false], offerSettle: false },
  };
  s = S.logWith(s, strings.log.parentVisit, { name: p.name }, actor);
  return S.ok(s);
}

/** 按 cleared 数组结算币数（合规必批） */
function grantForCleared(cleared: boolean[]): number {
  if (!cleared[0] || !cleared[1]) return 0;
  return cleared.every(Boolean) ? gameConfig.parent.maxCoins : 1;
}

function finishDialog(state: GameState, coins: number): Outcome {
  const d = state.parentDialog!;
  let s: GameState = { ...state, parentDialog: null };
  if (coins > 0) {
    s = S.gainCoins(s, d.playerId, coins); // 得币先补车费
    s = S.logWith(s, parentApproveLine(), { n: coins }, d.playerId, {
      kind: 'gain',
      coins,
    },
    true);
  }
  return S.ok(s, true);
}

export function parentAnswer(state: GameState, answer: ParentAnswer): Outcome {
  const d = state.parentDialog;
  if (!d) return S.bad('ERR_INVALID');
  // 语音是占位按钮：提示一下，不推进、不算回答
  if (answer.mode === 'voice') {
    return S.ok(S.pushLog(state, parentVoiceHint(), d.playerId, undefined, true));
  }
  const q = cards.parentStation.questions[d.step];
  if (!q) return S.bad('ERR_INVALID');
  let cleared = false;
  if (answer.mode === 'card') {
    const opt = q.options.find((o) => o.id === answer.optionId);
    if (!opt) return S.bad('ERR_NO_CARD');
    cleared = opt.tags.length > 0 && !opt.tags.includes('unclear');
  } else {
    cleared = q.keywords.some((k) => answer.text.includes(k));
  }
  if (!cleared) {
    return S.ok(S.pushLog(state, parentFallbackLine(), d.playerId, undefined, true)); // AI 给图卡兜底，重答本问
  }

  const flags = [...d.cleared];
  flags[d.step] = true;
  const step = d.step + 1;
  // 继续回答即放弃「就这样吧」
  const offerSettle = step === 2 && flags[0] && flags[1];
  if (step >= cards.parentStation.questions.length) {
    const s: GameState = { ...state, parentDialog: { ...d, cleared: flags, offerSettle: false } };
    return finishDialog(s, grantForCleared(flags));
  }
  return S.ok({
    ...state,
    parentDialog: { ...d, step: step as 0 | 1 | 2 | 3, cleared: flags, offerSettle },
  });
}

/** ①②后「就这样吧」→ 拿 1 币走人 */
export function parentSettle(state: GameState): Outcome {
  const d = state.parentDialog;
  if (!d || !d.offerSettle) return S.bad('ERR_INVALID');
  return finishDialog(state, 1);
}

/** ①②后选择「继续回答」 */
export function parentContinue(state: GameState): Outcome {
  const d = state.parentDialog;
  if (!d || !d.offerSettle) return S.bad('ERR_INVALID');
  return S.ok({ ...state, parentDialog: { ...d, offerSettle: false } });
}

export function parentSkip(state: GameState): Outcome {
  const actor = S.currentActorId(state);
  if (!actor) return S.bad('ERR_PHASE');
  const p = S.getPlayer(state, actor);
  return S.ok(S.logWith(state, strings.log.parentSkip, { name: p.name }, actor), true);
}
