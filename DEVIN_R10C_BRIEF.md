# DEVIN BRIEF — R10 Slice C: five-lens critique optimization round

You are the implementer; Muse is PM and will acceptance-check your local commit.
Baseline: the Slice B commit on branch `canonical-source` (start only from a tree
that includes Slice B). Read first: `R10_DESIGN.md`, `AGENTS.md`, and the five
critique files in `critique/` (LENS-interaction.md, LENS-motion.md, LENS-ui.md,
LENS-play.md, LENS-education.md) — every item below cites its lens finding.

AUDIENCE (the reason behind every fix): left-behind children aged 6–12 in rural
primary schools, welfare-org course, shared school tablets. Little real
money-decision experience, no adult co-pilot, low confidence expressing needs,
many first-time touch users. This lesson teaches how to spend money.

## P0 — must land

1. **CoinCounter must never show a wrong number** (motion #1). The digit strip
   uses the overshoot spring and flashes the NEXT digit mid-roll. Use a dedicated
   non-overshoot curve `cubic-bezier(0.23, 1, 0.32, 1)`, ~450ms, ones column
   delayed 40ms (the stagger the design promised). Add a test that samples the
   strip mid-animation state class / transform bounds if feasible.
2. **Kill stacked infinite paint animations** (motion #2). Playable glow becomes
   STATIC + the existing one-shot 700ms sweep when a card becomes playable;
   `.tc-foil` drift becomes one-shot; bot "thinking" pulse loses its animated
   box-shadow (opacity pulse is fine). At most ONE continuous animation on
   screen, per R10_DESIGN §4.4.
3. **Fan cards identifiable without tapping each one** (UI #1, play #5,
   education runner-up). In fan state, cards show art + cost gem only (drop the
   covered name band); the SELECTED card's name becomes a ≥28px bold hero pill
   above the fan on ALL viewports (today it exists only on phone-landscape at
   14px). Fans of ≤3 cards never overlap.
4. **Phone-landscape fan must not clip** (UI #3). Fixed fan zone with visible
   overflow inside the panel; fan exposure ≥48px (the project's own
   `--tap-min-size`); drop/action rows full-width stacked, no one-character
   vertical labels.

## P1 — must land

5. **Tap-rescue for young fingers** (interaction #1). Pointer-type drag
   thresholds: touch 18px (mouse stays 8px), plus a time/distance tap-rescue so
   a slow drifting tap still selects. `useDragPlay.ts` + its tests.
6. **Regret window before money/answer commits** (interaction #2). A short
   pending-dispatch window with a cancel affordance (cancel chip; tapping the
   flying card also cancels) before the command fires — pilot on the parent
   station's picture-card answers and on market/event buys. Front-end only; the
   command set and engine stay untouched.
7. **Event deck affordance** (interaction #3). The face-down event deck gets the
   same treatment as the recipe deck: an instruction line ("点一下，翻开看看")
   + idle glow/gentle bob until first tap (respecting finding 2's one-animation
   budget: this bob is the one allowed loop while the panel waits).
8. **Don't spoil the surprise; make the reveal readable** (play #1). The toast /
   log line naming the event result must not appear before the flip completes.
   Revealed state: ONE large story card (event art + full story text legible)
   with the two option cards fully readable below/beside it — no truncated
   labels.
9. **Cook climax: the dish must visibly happen** (play #2, motion #7).
   Assembly scene in CookPanel: collected ingredient cards fly into a big
   pan/plate (stagger within the <500ms total budget), morph into the recipe's
   dish illustration with steam/spark, then the foil stamp. Presentation only,
   driven by existing cook state.
10. **Parent station: conversation, not an exam** (play #3, education #2).
    Entry screen: a warm persistent parent presence (portrait + name + the
    question in a speech bubble). REMOVE the up-front rubric text that spells
    out the coin marking scheme; the coin explanation moves to after-the-fact
    praise at settle (the approveLine already exists). Per cleared answer, the
    parent echoes the child's need back in a full sentence (panel-side copy,
    e.g. "想买鸡蛋 ✓ 说清楚了"). Before Q1, show the model dialogue as skippable
    「示范」 bubbles. Add sentence-starter chips ("我想买…", "我还差…") above the
    free-text input. **Do not touch the R9 live/offline status indicator or the
    parentLive flow** — live and offline both keep working, ZH/EN.
11. **One dominant action per panel** (UI #2). The commit action （买下/收下） is
    the single filled gradient pill; dashed outlines are reserved for drop
    zones and the hold action （先等等 reads as hold, not as a second primary).
    Apply consistently across Market / Store / Event / Bus panels.
12. **Coin bar at decision points** (education #1, UI runner-up). A bar-model
    strip (Singapore-bar style) in Market / Store / Wallet: coin cells
    segmented into 菜谱还差 / 车费 / 自由花 (data already in
    `selectors.walletSummary`); when a card is selected, the cells its price
    would consume light up, alongside the pictorial "9 − 2 → 7" remainder.
    Presentation of existing derived data only.
13. **Bots think aloud** (education #3). Short reason bubbles keyed to existing
    bot log events (steady: "先买菜谱里的菜"; impulsive using hold clip:
    "好想要…先放先等等吧"; follower referencing a friend). Plus a lap-1-only
    coach line at the child's first market visit, composed from her actual
    missing ingredients. Bubbles reuse existing log/toast plumbing; no new
    engine events.
14. **Reduced-motion: gentler, not zero** (motion #3). Remove the global
    `* { transition/animation-duration: 0.01ms !important }` nuke; the global
    rule may only ban infinite/decorative loops. The per-component 120ms
    reduced-motion values in cards.css must actually take effect.

## P2 — stretch (only if P0+P1 are green with time to spare)

15. Contrast pass (UI runner-up): white-on-primary-orange text (2.84:1) and
    colour-only player/glow coding (~1.5–1.7:1) fixed via tokens (darker text
    variant or navy text on orange); functional text floor raised from 14px
    grey.
16. Reflection options personalised from the child's own feast ledger data
    (education runner-up) — presentation selection from existing data only.
17. Touch hover-stickiness guard (motion #5) and draw-ceremony input-dead time
    trim (motion #6).

## Red lines (diffed at acceptance)

- `git diff src/game src/data` EMPTY. No flow/order changes, no rule changes,
  no cards.json edits, no new dependencies, no network calls, `.env.local`
  untouched. Tokens only in tokens.css (additions/derived variants allowed for
  finding 15; do not silently change existing token values — list any change in
  the design-doc record).
- Every new interaction keeps tap-tap + keyboard equivalents; reduced-motion
  stays fully playable; transform/opacity animation only.
- Commit LOCALLY only, message starting `R10 Slice C:`. No push, no zip.

## Acceptance evidence

- Build clean; full tests green (Slice B baseline + new tests for findings
  1, 5, 6 at minimum).
- Screenshots `shots/r10c_*`: market fan with hero pill (desktop + phone),
  phone fan unclipped, event facedown WITH hint, event revealed readable,
  cook assembly mid-flight + dish landed, parent entry (conversation-first),
  coin bar with a card selected.
- R8 fit re-run unchanged (fill 0.658–0.660, cover 0.0%).
- Append an "R10 Slice C" record to R10_DESIGN.md: per-finding shipped/partial/
  skipped with reasons, token changes if any, test count, screenshot list.
