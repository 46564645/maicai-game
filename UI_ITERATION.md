# UI ITERATION — «界面挡道游玩了» A/B loop

User feedback after the T0–T7 visual pass: the interface panels obstruct
gameplay. This loop follows `~/workspace/custom-skills/ui-ab-iteration`:
baseline screenshot matrix → DOM-rect + pixel measurements → one layout
idea per round → re-shoot, keep winners, revert losers. Layout/CSS and
camera-fit constants only — engine (`src/game/`), `src/data/cards.json`
(5 recipes), the 14 ADAPTATION rules, English copy, and the T0 safe-area
fix are untouched (verified by git diff: only `src/board.css`,
`src/hud.css`, `src/phone.css`, `src/board/three/CameraRig.tsx` changed).

## Method

- Harness: `shots/measure-ui.mjs` (Playwright, flows mirror
  `shots/shoot-final.mjs`; board shots wait 4.5 s after entering — the
  camera follow-lerp is frame-based, so the wait defines the camera
  state; a 20 s wait produces a different, converged-follow framing and
  must not be mixed into comparisons) + `shots/analyze-ui.py`.
- Metrics: **canvas cover %** = share of the 3D canvas covered by any DOM
  panel (grid-sampled union of panel rects); **island core** = bounding
  box of grass+road pixels segmented from a panels-hidden reference shot
  (the pale sand rim carries no gameplay and is excluded by design);
  **island cover %** = share of that bbox covered by panels.
- All rendering is SwiftShader on this VM (~3–7 fps): timings/animations
  are not device-representative; settled-state geometry is.

## Baseline measurements (tag `before`, commit 9a69930)

| screen | canvas cover | island core | island cover | primary btn |
|---|---|---|---|---|
| board desktop 1280×800 | 35.7% | 750×580 | **39.3%** | 56px |
| board phone 874×402 | 44.6% | 260×168 | 1.5% | 48px |
| market desktop | 74.9% | — | 97.1% | 56px |
| market phone | 46.6% | — | 4.9% | 48px |
| spinner desktop | 73.8% | — | 97.8% | 56px |
| spinner phone | 47.9% | — | 8.7% | 72px |

Baseline defects found:
- Desktop board: the turn prompt (`.board3d-overlay`) is a 480×184
  centred column card covering the island's top-centre incl. stations;
  the 100px bottom HUD bar crosses the island's middle band; side bot
  cards + lap card frame the rest.
- Desktop lap card: the turn-order string `Sprout→Steady→Zip→Tag`
  cannot wrap and **spills past the card and the screen's right edge**.
- Phone board: the island is small (core 260×168) — not overlapped, but
  squeezed: rail 297px (34%) leaves a 577px board area, and the compact
  fit rect wastes 30% of the height (t16/b14).
- Market/spinner desktop "coverage" is the station modal itself — the
  current step's focus, dimmed backdrop, dismisses on completion.
  Accepted per protocol; not a defect.

## Rounds

### R1 — desktop turn prompt: column card → slim row bar (KEPT, 3 attempts)
- R1a `flex-direction: row` with `width: auto`: the flex container
  shrink-wraps to its widest item, so the bar stacked anyway
  (418×170; island cover 39.3% → 35.0%). Lesson recorded in CSS.
- R1b explicit width 52rem: one row, but 803×132 — wider than the old
  card, island cover rose to 42.1%. **Reverted.**
- R1c (kept): bar holds only status + primary button
  (`width: min(96%, 46rem)`), and **Reset view moves out of the bar**
  to a pill at the bar's top-right (over water). Result: overlay
  736×76 single row, primary button 421×56 on one line; board-desktop
  island cover 39.3% → 31.4% at this step. ≤900px keeps the old
  in-flow column (media query restores it; reset returns in-flow).

### R2 — phone: narrower rail + looser compact fit (KEPT)
- `--rail-w` 34% → 30%: rail 297 → 262px, board area 577 → 612px.
  Rail content was originally tuned for ~190–250px content widths
  (see phone.css 9b/9c notes); 246px content stays in that range.
- `FIT_RECT.compact`: t 0.16 → 0.14 (the top chip row's measured
  bottom edge is 56px = 13.9% of 402), l/r 0.04 → 0.03; b unchanged
  (bottom fabs zone). Island core 260×168 → 276×178 (+6% linear,
  +12.5% area — the fit is height-bound, so gains are modest);
  canvas cover 44.6% → 41.1%. Market grid, event choices and all
  rail buttons re-shot: nothing cropped; event choice buttons wrap
  to taller (92px) but text stays inside, as in baseline behaviour.

### R3 — desktop HUD slimming + lap-order wrap (KEPT)
- Bottom bar 100 → 81px: vertical padding one step down, human
  avatar font xl → lg, chip vertical padding one step down. No text
  size or tap-target changes (chips stay ≥56px min-height).
- `.lap-card-order { overflow-wrap: anywhere; }`: the order string
  now wraps inside its card (card grows 100 → 124px tall in the side
  column, which does not overlap the island) instead of spilling
  off-screen. Copy unchanged.

## Final measurements (tag `after`)

| screen | canvas cover | island core | island cover | primary btn |
|---|---|---|---|---|
| board desktop | **30.6%** | 740×582 | **28.4%** | 56px |
| board phone | **41.1%** | **276×178** | 0.0% | 48px |
| market desktop | 74.7% | — | 97.2% | 56px |
| market phone | **43.0%** | — | 5.3% | 48px |
| spinner desktop | 73.5% | — | 97.8% | 56px |
| spinner phone | **44.4%** | — | 9.2% | 92px (wrapped text, inside) |

Headline: on the board screen — the one the user plays on — desktop
island occlusion fell 39.3% → 28.4% and the phone island grew ~12.5%
in area with zero panel overlap. Remaining desktop cover is mostly
the (now 81px) bottom HUD band across the island's middle and the
76px prompt bar; both are permanent HUD, not modals. The market and
spinner modals still cover the board while open by design (they are
the current task and dismiss when done).

## Verification (final tree)

- `npm run build` — clean (Board3D gzip 282.8 kB, unchanged budget).
- `npm test` — **85/85 passed**.
- `npx playwright test tests/e2e/safearea.spec.ts` — **PASSED**
  (2.7 min; full game at 874×402 with safe-area insets, every primary
  button fully visible — the T0 fix and the narrower rail both hold).
- Other e2e specs (mobile/board3d/keyboard, 240 s timeouts): 3 passed,
  3 failed — every failure is a raw test-timeout under SwiftShader
  (error contexts show `Test timeout … exceeded` on locator waits, no
  layout assertions). This matches both prior passes on this VM
  (Stage A: split varied run to run; T0–T7: same timeout class), and
  the geometry-asserting spec (safearea) passes. `fullgame.spec.ts`
  was not re-run; safearea plays a complete game at the phone
  viewport and is the stricter geometry gate. A fully green suite
  still needs a GPU machine — unchanged from the T0–T7 report.
- Screenshots: `shots/ui_<screen>_<viewport>_before.png` /
  `_after.png` pairs for all six screens, plus `_noui` island
  references and `shots/ui_rects_all.json` (all panel rects).

## R4 — desktop prompt bar docked to the bottom (user order, KEPT)

User, after playing the R1–R3 build: the slim bar still lies across
the middle of the screen and blocks the view — move it to the bottom.
Root cause was structural, not the bar itself: the whole desktop
layout only occupied the top ~460px of an 800px viewport (the board
area's height came from the side columns; the 3D canvas is fixed
full-screen behind it), so the "bottom" HUD sat at y380 and the bar,
anchored to the board area's bottom edge, at y280 — across the
island's upper-middle.

Changes (all scoped to >900px; ≤900px and phone-land untouched):
- `src/theme/layout.css` — new `@media (min-width: 901px)` block:
  the layout chain fills the viewport height (`.app-main` /
  `.game-screen` / `.game-layout` flex:1, grid rows
  `minmax(0,1fr) auto`), so the HUD lands on the real screen bottom
  and the bar — still anchored to the board area's bottom edge —
  docks directly above it. Stack trims: shell bottom padding
  24 → 16, layout row-gap 16 → 8. Bottom stack is now a constant
  189px (padding 16 + HUD 81 + gap 8 + bar offset 8 + bar 76).
  Side columns keep `space-between`, so the bot/lap cards pin to
  the four corners and frame the island instead of crossing it.
- `src/board/three/CameraRig.tsx` — `FIT_RECT.desktop` re-centred
  on the free band between the top bar and the bottom stack:
  t 0.06 → 0.10 (top bar ends at 72px), b 0.10 → 0.24 (the 189px
  stack is 0.236 of 800). Offline replica of the fit solver
  (reproduces the old 39.9 exactly): distance 39.9 → 52.9 — b 0.29+
  would solve at 67+, inside the fog start (60), and was rejected
  on that measurement. The island is ~25% smaller on screen; that
  is the price of a guaranteed-clear band, paid knowingly.
- `src/board.css` — bar height is now constant in every phase: on
  desktop the log line moves inline (status fixed-width via
  `:has(.board-log)`, log takes the remaining row, ellipsis if
  longer; full text stays in the aria-live log). Previously the
  log wrapped to a second row (bar 76 → 104) and would have eaten
  28px of the fit band from below. Reset pill shifted 24px right
  so it hangs over the shallows at the island's south-east rim.

Measurements (same harness/method; tags `r4_before` / `r4_after`):

| screen | canvas cover | island core | island cover | primary btn |
|---|---|---|---|---|
| board desktop before | 30.6% | 680×442 | **35.5%** | 56px |
| board desktop after | 30.6% | 506×304 | **0.0%** | 56px |
| board phone before | 41.1% | 276×178 | 0.0% | 48px |
| board phone after | 41.1% | 276×178 | 0.0% | 48px |

Notes on the numbers:
- Canvas cover is unchanged (30.6%): the same panels exist, they
  just sit over water/background instead of the island now.
- This session's `r4_before` island (680×442, 35.5%) differs from
  the R1–R3 session's `after` (740×582, 28.4%) although the code
  was identical — the frame-based follow-lerp settles differently
  under varying VM load (documented hazard above). The R4 pair was
  captured back-to-back in one session with the same wait, and the
  phone row reproduces byte-identically, so the comparison holds.
- Converged-state check (one-off 25 s wait, not part of the pair):
  island core 510×348 at y262–610, panel cover still **0.0%**;
  Reset pill overlap of the island bbox is a 0.1% corner sliver
  (visually over the shallows). DOM-injected log probe in a
  faithful play-state layout (no enter button): bar height stays
  one row with a long log line — the fit band holds in all phases.
- Rects after: prompt bar y611–687, HUD y703–784 (screen bottom),
  nothing between the status chip (ends y128) and the bar except
  the corner-pinned side cards. Middle of the screen is clear.

Verification (R4 tree):
- `npm run build` — clean. `npm test` — **85/85 passed**.
- `safearea.spec.ts` — **could not complete on this VM today**:
  three runs (240s cap set inside the spec) all ended in the
  documented SwiftShader timeout class with the game progressing
  normally in every snapshot and zero layout assertions failing
  (a fourth run was lost to a runtime restart). The same spec
  passed in 2.7 min in the R1–R3 session on the identical phone
  layout; R4's diff is entirely ≥901px-scoped (media queries) plus
  the desktop-only fit rect, and the phone harness row above is
  byte-identical to the passing round — but the pass itself was
  not re-earned today, and a GPU/real-device run is still owed.
- Guardrails by diff: only `src/theme/layout.css`, `src/board.css`,
  `src/board/three/CameraRig.tsx` changed. Engine, `cards.json`,
  14 rules, English copy, T0 fix untouched.

## Left open

- ww acceptance of the slimmer HUD / row-bar prompt and 马教授
  playtest remain the shipping gates, as before.
- ~~Structural fit lever~~ — done in R4: desktop island cover is
  now 0.0% (was 39.3% at the loop's baseline). The remaining
  desktop trade-off is island size (~25% smaller than R1–R3) in
  exchange for the guaranteed-clear middle; if ww wants it bigger,
  the next lever is shrinking the bottom stack itself (e.g.
  merging the prompt into the HUD row), not the fit.
