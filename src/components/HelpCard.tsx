/**
 * HelpCard.tsx —— 求助牌弹卡：缺哪些菜 / 几个币 / 本站能做什么 / 温和建议。
 * 内容全部来自 selectors.helpHints（纯派生，不扣分；计次由打开处
 * TOGGLE_HELP 负责）。随时可举。
 */
import { strings } from '../data/strings';
import { helpHints } from '../game/selectors';
import { fmt } from '../game/stations/shared';
import { gameConfig } from '../config/gameConfig';
import { canDoLabel, cardName, stationGoal, stationName } from '../i18n/cardText';
import type { GameState, PlayerId } from '../game/types';
import { CardIcon } from './CardIcon';
import { MetaIcon } from './cards/MetaIcon';
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
        {/* R2-6（团队第 2 轮）：本站的「Practice: …」练习标签从站点
            顶部挪进这张「How to play」卡里——顶部只留站名 + 一句说明，
            练习目标想看时来这里看（当前站的 goal，stationGoal 既有口径） */}
        {state.phase === 'station' && (
          <p className="help-line">
            {stationGoal(gameConfig.stations[state.stationIndex].id)}
          </p>
        )}
        {hints.canDo.length > 0 && (
          <p className="help-line">
            {strings.actions.helpCanDo}
            {hints.canDo.map(canDoLabel).join(', ')}
          </p>
        )}
        {/* R6（ww Part 2.4）：类别记号图例——与卡面记号同图同名，
            孩子在卡上看到记号，来这里能查到全名 */}
        <div className="help-line help-legend">
          <span className="help-legend-title">{strings.help.iconLegend}</span>
          <span className="help-legend-item">
            <MetaIcon kind="list" />
            {strings.panel.tagNeeded}
          </span>
          <span className="help-legend-item">
            <MetaIcon kind="food" />
            {strings.panel.tagIngredient}
          </span>
          <span className="help-legend-item">
            <MetaIcon kind="fun" />
            {strings.panel.tagTemptation}
          </span>
        </div>
        <p className="help-line help-line--tip">{hints.tip}</p>
      </div>
    </StationPopup>
  );
}
