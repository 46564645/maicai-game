/**
 * describeCommand.ts —— 把引擎命令翻译成按钮上的中文短句。
 * 卡牌文字全部来自 cards.json；界面固定文案全部来自 strings.ts。
 */
import { cards, getIngredient } from '../data/cards';
import { gameConfig } from '../config/gameConfig';
import { strings } from '../data/strings';
import { fmt, marketPriceOf, getPlayer } from '../game/stations/shared';
import {
  cardName,
  eventFreeLabel,
  eventSpendLabel,
  parentOptionLabel,
  parentSettleLabel,
  parentVoiceHint,
  playerDisplayName,
  reflectionLineText,
  reflectionOptionLabel,
} from '../i18n/cardText';
import type { Command, GameState } from '../game/types';

const A = strings.actions;

function currentEventLabel(state: GameState, option: 'spend' | 'free'): string {
  const sub = state.turn?.sub;
  const card = sub?.kind === 'event' ? cards.events.find((e) => e.id === sub.eventCardId) : null;
  if (!card) return A.ok;
  return option === 'spend' ? eventSpendLabel(card) : eventFreeLabel(card);
}

function reflectionLabel(optionId: string): string {
  const opt = cards.reflections.humanOptions.find((o) => o.id === optionId);
  if (opt) return reflectionOptionLabel(opt.id, opt.label);
  const line = Object.values(cards.reflections.botLines)
    .flat()
    .find((l) => l.id === optionId);
  return line ? reflectionLineText(line.id, line.text) : optionId;
}

export function describeCommand(state: GameState, c: Command): string {
  const actorId =
    ('playerId' in state.pendingDecision ? state.pendingDecision.playerId : null) ??
    state.humanId;
  const me = getPlayer(state, actorId);
  switch (c.type) {
    case 'START_GAME':
      return strings.intro.startButton;
    case 'CHOOSE_CHARACTER': {
      const ch = cards.characters.find((x) => x.id === c.characterId);
      return fmt(A.chooseChar, { name: ch ? cardName(ch.id) : c.characterId });
    }
    case 'ACK':
      return state.turn?.turnPhase === 'intro' ? A.enter : A.ok;
    case 'DRAW_RECIPE':
      return A.drawRecipe;
    case 'STALL_BUY':
      return fmt(A.buy, { item: cardName(c.cardId), n: marketPriceOf(c.cardId) ?? '?' });
    case 'STALL_HOLD':
      return fmt(A.hold, { item: cardName(c.cardId) });
    case 'RESOLVE_HOLD': {
      const item = cardName(me.holdClip ?? '');
      return fmt(c.buy ? A.holdBuy : A.holdDrop, { item });
    }
    case 'END_TURN':
      return A.endTurn;
    case 'PROPOSE_SWAP':
      return fmt(A.swap, {
        give: cardName(c.giveCardId),
        name: playerDisplayName(getPlayer(state, c.to)),
        want: cardName(c.wantCardId),
      });
    case 'RESPOND_SWAP':
    case 'RESPOND_INVITE':
      return c.accept ? A.yes : A.no;
    case 'PAY_BUS': {
      const fee = gameConfig.busFeeByLap[state.lap - 1] ?? 0;
      if (fee <= 0) return A.busFreeDone;
      return me.coins >= fee ? fmt(A.payBus, { n: fee }) : A.busDebt;
    }
    case 'CHOOSE_EVENT_OPTION':
      return currentEventLabel(state, c.option);
    case 'PARENT_BEGIN':
      return strings.parent.useNow;
    case 'PARENT_SKIP':
      return strings.parent.useLater;
    case 'PARENT_ANSWER': {
      if (c.answer.mode === 'text') return A.sayIt;
      if (c.answer.mode === 'voice') return parentVoiceHint();
      const opt = cards.parentStation.questions
        .flatMap((q) => q.options)
        .find((o) => o.id === (c.answer as { optionId?: string }).optionId);
      return opt ? `${opt.icon} ${parentOptionLabel(opt)}` : A.sayIt;
    }
    case 'PARENT_SETTLE':
      return parentSettleLabel();
    case 'STORE_BUY': {
      const ing = getIngredient(c.ingredientId);
      return fmt(A.storeBuy, {
        item: ing ? cardName(ing.id) : c.ingredientId,
        n: (ing?.marketPrice ?? 0) + gameConfig.store.markup,
      });
    }
    case 'CHOOSE_REFLECTION':
      return reflectionLabel(c.optionId);
    case 'RESTART':
      return A.restart;
    case 'TOGGLE_HELP':
      return strings.help.title;
    case 'DEMO_JUMP':
      return A.demoJump;
    case 'DEMO_SET_PERSONALITY':
      return A.demoPersonality;
    case 'SET_FLAG':
      return A.setFlag;
  }
}
