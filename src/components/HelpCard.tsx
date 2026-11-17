/**
 * HelpCard.tsx —— 求助牌弹卡：缺哪些菜 / 几个币 / 本站能做什么 / 温和建议。
 * 内容全部来自 selectors.helpHints（纯派生，不扣分；计次由打开处
 * TOGGLE_HELP 负责）。随时可举。
 */
import { strings } from '../data/strings';
import { helpHints } from '../game/selectors';
import { fmt } from '../game/stations/shared';
import { gameConfig } from '../config/gameConfig';
import { canDoLabel, cardName, stationName } from '../i18n/cardText';
import type { GameState, PlayerId } from '../game/types';
import { CardIcon } from './CardIcon';
import { StationPopup } from './StationPopup';

export function HelpCard({
  state,
  playerId,
  onClose,
}: {
  state: GameState;
  playerId: PlayerId;
  onClose: () => void;
}) {
  const hints = helpHints(state, playerId);
  return (
    <StationPopup title={strings.help.title} onClose={onClose} testid="card-help">
      <div className="help-lines">
        {hints.recipeName && (
          <p className="help-line">
            {strings.actions.helpMissing}
            {hints.missing.length === 0
              ? '—'
              : hints.missing.map((m) => (
                  <span key={m.id}>
                    <CardIcon icon={m.icon} />
                    {cardName(m.id)}{' '}
                  </span>
                ))}
          </p>
        )}
        <p className="help-line">{fmt(strings.actions.helpCoins, { n: hints.coins })}</p>
        {hints.busDebt > 0 && (
          <p className="help-line">{fmt(strings.actions.helpDebt, { n: hints.busDebt })}</p>
        )}
        {hints.stationName && (
          <p className="help-line">
            {state.phase === 'station'
              ? stationName(gameConfig.stations[state.stationIndex].id)
              : hints.stationName}
          </p>
        )}
        {hints.canDo.length > 0 && (
          <p className="help-line">
            {strings.actions.helpCanDo}
            {hints.canDo.map(canDoLabel).join(', ')}
          </p>
        )}
        <p className="help-line help-line--tip">{hints.tip}</p>
      </div>
    </StationPopup>
  );
}
