# DEVIN BRIEF — R10 Slice D: close out the remaining five-lens findings

You are the implementer; Muse is PM and will acceptance-check your work.
Baseline: Slice C commit `7fb9d97` on branch `canonical-source`.
Read first: `AGENTS.md`, `R10_DESIGN.md`, `OVERNIGHT_REPORT.md` (esp. the
per-lens tables and 「留待你决定」), and the five files in `critique/`.
Slice C already landed items marked ✅ in the report — do NOT redo them.
This slice closes the items marked ❌ / 部分 (partial) there.

AUDIENCE (the reason behind every fix): left-behind children aged 6–12 in
rural primary schools, welfare-org course, shared low-end school tablets.
Little real money-decision experience, no adult co-pilot, low confidence
expressing needs, many first-time touch users. This lesson teaches how to
spend money (消费课).

## RED LINES (same as every slice — breaking one fails acceptance)
- `git diff 7fb9d97..HEAD -- src/game src/data` must be EMPTY. Engine, rules,
  cards.json, game flow, station order: untouched.
- No new dependencies, no new network calls, no touching `.env.local`.
  (PM decision: do NOT add Web Speech recognition — it is a network service
  in most browsers and violates the zero-network rule. See item 5.)
- Visual tokens only in `src/theme/tokens.css`; list every token change in
  your final record. Borrowed code → credit in THIRD_PARTY_NOTICES.md.
- Every new user-visible string in BOTH `src/i18n/zh.ts` and `en.ts`
  (isomorphic keys). Copy style: short, warm, readable by a 6-year-old.
- Animation: transform/opacity only, no new infinite paint animations
  (Slice C's one-loop budget stands), reduced-motion = gentler not zero.
- `npm run build` clean + `npm run test` all green, with NEW unit tests for
  each pure-logic helper you add (target ≥171 + your new tests).
- Append a 「Slice D 落地记录」 section to R10_DESIGN.md when done.
- Commit locally on `canonical-source`. Do NOT push.

## P0 — the nine un-landed findings

1. **Scaffolding fades across laps** (education #5). Presentation only,
   keyed off existing `state.lap`:
   - Lap 1: full support (current behaviour).
   - Lap 2: market/store instruction lines collapse to a short icon+short
     form; bot reason bubbles stop EXCEPT the hold-clip （先等等） move.
   - Lap 3: no instruction line in market/store panels; reflection prompt
     upgrades to the forward-looking stem （下次去买菜，你会先做哪一步？ /
     EN equivalent) ONLY for a child who completed their recipe, standard
     stem otherwise.
   Implement as a small pure helper (e.g. `supportLevel(lap)` → 1|2|3) with
   unit tests. No config/engine change.

2. **Event choices get consequence feedback** (education #7).
   (i) The spend option card shows the market-style remainder preview:
   「花 {price} 币 · 还剩 {n} 币」 (price + coin count already in scope in
   EventPanel). (ii) After a choice, BEFORE the panel closes, show one
   consequence-echo line composed panel-side from existing selectors:
   spent & recipe still covered → 「花了 {p} 币，买菜的钱还够」;
   spent into the recipe gap → 「注意：买菜还差 {n} 币了」;
   chose free → 「1 个币也没花，留给后面的车费和买菜」.
   EN equivalents for all three. Pure helper for the echo decision + tests.
   The choice itself still goes through the existing command path and the
   Slice C regret window.

3. **Long-press inspect on touch** (interaction #4). In the Hand/TiltCard
   layer: touch long-press 300ms → card scales 1.15, hero name tag floats
   above it (reuse the Slice C hero pill), and the existing CardView speak
   （朗读） fires if already wired. Releasing restores everything: NO
   selection change, NO command dispatch, NO pending window triggered.
   Must not fight useDragPlay: a press that becomes a drag cancels inspect;
   a press released as a tap keeps today's tap behaviour (tap-rescue from
   Slice C must keep working). Mouse hover inspect unchanged. Unit-test the
   press-state logic if you factor it pure; at minimum do not regress the
   existing drag tests.

4. **One "not enough money" feedback everywhere** (interaction #6).
   EventPanel's spend card: remove the silent `disabled` behaviour — make
   it "clickable but not playable", mirroring MarketPanel: tap → card shake
   180ms + price gem red-flashes once + coin HUD bump; the command gate
   still reads `availableCommands` and NO command is dispatched. Keep the
   existing 「钱不够」 text line as the second channel. Check BusPanel too:
   if its can't-afford path differs, align it to the same shake+flash+bump
   pattern (presentation only).

5. **Parent-station voice button must stop lying** (interaction #7).
   PM decision: NO speech recognition (zero-network red line). Instead the
   button becomes honest: relabel/re-icon it as 「听一听问题」 (EN: "Hear the
   question") — tapping it reads the current question aloud via the EXISTING
   TTS/speak path and expands the picture-card fan. Remove BOTH fake
   behaviours: the live-mode chat-bubble hint that pretends input, and the
   offline-mode preset `mode:'voice'` answer dispatch (tapping it must never
   submit an answer again). Picture cards and free text stay the real input
   paths. If an honest label needs a new icon, use an ear/speaker glyph, not
   a microphone.

6. **Station popups enter and exit, they don't teleport** (interaction #8).
   `.popup`: 240ms entrance (opacity + translateY(8px)→0 + scale .98→1,
   `--ease-out`), 150ms fade exit; reduced-motion: 120ms fade only. One
   place, all stations. Mind the e2e drivers: entrance must not leave the
   popup box unstable for clicks (animate a wrapper/inner, or keep the
   hit-box static like the Slice C deck-bob fix).

7. **TiltCard tilt must follow the finger, not trail it** (motion #8).
   Split durations: pointer-follow transition 120ms `var(--ease-out)`;
   pointer-leave return 250ms (via a leaving class or parent state).
   Throttle pointermove var writes with rAF (≤1 write per frame). Touch
   still ignores tilt.

8. **Store "全部食材" grid must be findable** (UI #7). Grid tiles stop
   cropping the art: each tile shows the FULL illustration (contain, not a
   middle slice) + a visible name band + its price gem ON the tile. Remove
   the stray duplicate floating price-gem row between grid and buy button.
   If vertical space is tight, move the 「全部食材」 label into the panel
   header instead of shrinking tiles. Tile tap behaviour unchanged.

9. **Pictorial lap/turn progress** (UI #8). Next to the existing lap chip
   add a compact pictorial cluster: 3 lap dots (filled = done, outlined
   pulse = current) + an 8-pip station ring/strip with a "you are here"
   marker driven by existing state; in the turn strip, highlight the NEXT
   player's avatar with the same lift/outline language as a selected card.
   Pure presentation from existing state; no new strings beyond a11y labels
   if needed (both languages).

## P1 — finish the partials

10. **Goal stays visible while deciding** (education #6 remainder).
    Pin a mini recipe-progress strip inside every station panel header:
    ingredient icons with ✓ / still-missing state from existing
    `missingIngredients` data (same data the bottom bar uses). Under each
    panel title, show the station's existing learning-goal tag
    (「练 · …」 strings already in `cardText.ts`) as a small chip. Also:
    when two IDENTICAL cards sit adjacent in a fan, add a count badge
    (「×2」) so duplicates are distinguishable.

11. **Press/hover springs retire** (motion #4 remainder). Verify current
    state first (Slice C added `--ease-roll` only): introduce/confirm
    `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` and
    `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` tokens; buttons press
    at 140ms var(--ease-out) with NO overshoot; hand raise/neighbour-push
    at 180ms var(--ease-out). No other motion timings change.

12. **Bot personalities visible, not just textual** (play #4 remainder +
    UI #5 remainder). Each bot gets a small persistent trait badge (icon +
    1–2 char label from EXISTING personality data — do not invent new bot
    data in src/data) shown on its turn-strip avatar and beside its Slice C
    think bubble; bubble accent colour per bot via tokens. This also gives
    turn order a non-colour cue. Keep it presentation-only.

## Verification you must run and report honestly
- `npm run build`, `npm run test` (report exact counts).
- Screenshots (ZH, desktop 1440×900 + phone-land 844×390 where relevant),
  saved as `shots/r10d_*.png`: event consequence echo, event can't-afford
  shake state (or note why a still can't show it), store grid fixed,
  progress cluster, panel-header recipe strip, lap-3 market (no instruction
  line), parent voice button new label. PLUS the four Slice C shots that
  were never captured: event face-down with hint, event revealed, cook
  assembly mid-flight, cook landed — name them `shots/r10c_*` as the C
  brief specified.
- e2e: run `npm run e2e` ONCE, serially, with nothing else heavy running.
  Report pass/fail per test exactly; if board3d/fullgame time out again,
  say so plainly — do not loop-retry more than twice total, and never run
  e2e in parallel with screenshot/fit captures (that contention corrupted
  earlier runs).
- R8 fit: if a fit hook exists in this build, re-run the 9-viewport fit and
  report fill numbers; if the hook is still absent, state that in one line
  (do not rebuild the hook — out of scope).
- Final message: files changed, token changes, test counts, screenshot
  list, e2e result, anything you could NOT land and why.
