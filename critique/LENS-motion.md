# LENS: Motion / Animation Design — 《一起去买菜》 R10 critique

Standards applied: Emil Kowalski design-engineering + animation-review rules
(strong custom easings, UI < 300ms, never `scale(0)`, transitions over keyframes
for interruptible UI, reduced-motion = gentler not zero, hover gated behind
`(hover: hover) and (pointer: fine)`, GPU-only properties) and LottieFiles
motion design (Playful archetype: 150–300ms, ease-out-back, 10–20% overshoot;
stagger budgets: standard 50–100ms, total < 500ms; three motion layers; 1/3 rule).

Reality check for every finding: the audience is 6–12-year-old left-behind
children, many first-time touch users, on low-end school tablets where a WebGL
3D board is already consuming the frame budget. 30fps there is the target, and
motion's job is to *teach* — where the card went, what the money did, whose turn
it is — before it decorates.

---

## Finding 1 — CoinCounter roll overshoots and briefly displays a coin total the child does not have

**(a) Problem + evidence.** `.cc-strip` rolls the digit column with
`transition: transform var(--coin-roll-ms) var(--ease-spring)`
(`cards.css`, `.cc-strip`), where `--coin-roll-ms: 700ms` (tokens.css) and
`--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)`. The 1.56 control point
overshoots: rolling to 5 carries the strip *past* 5, showing a slice of 6,
before settling back. Both digit columns also roll simultaneously — the
design's 40ms per-digit stagger (§4.2) was never implemented in
`CoinCounter.tsx`. And 700ms is long for an event that fires on every purchase
(a dozen-plus times per game — "tens of times" frequency class, where the
review standard says *reduce*).

**(b) Why it matters here.** This is a money-teaching game for children with
almost no real money-decision experience. The HUD total is the one number they
are learning to trust and plan against ("买完还剩 7 币"). A counter that
visibly flashes a *wrong, higher* number mid-roll teaches the wrong total at
the exact moment of the lesson, and a 6-year-old cannot tell a transient
overshoot digit from the real one.

**(c) Fix.** Give the strip its own non-overshooting curve and shorten it:
`--ease-roll: cubic-bezier(0.23, 1, 0.32, 1)` (Emil's strong ease-out),
`--coin-roll-ms: 450ms`; add `transition-delay: 40ms` to the ones column so
digits land in sequence. Keep `--ease-spring` for cards, never for numerals.

**(d) Severity: High** — correctness of the core teaching signal, seen every purchase.

## Finding 2 — Stacked infinite paint animations fight the WebGL board for the 30fps budget

**(a) Problem + evidence.** Three always-on animations can run simultaneously
over the 3D board:
- `.pglow--on` breathes `box-shadow` (0 0 20px → 30px blur) at 2.6s infinite
  (`cards.css` `@keyframes pglow-breathe`) — applied to *every* affordable
  market card at once (up to 6 in `MarketPanel`), plus store/parent fans.
- `.tc-foil` runs `foil-drift 4s linear infinite` animating
  `background-position` on a 260%-sized gradient — a repaint every frame, for
  as long as the feast/completion screen sits open.
- `.bot-card--thinking` pulses box-shadow at 1.4s infinite (`board.css`).

`box-shadow` and `background-position` animations are paint-bound, not
compositor-bound: each frame repaints the element and its blur. R10_DESIGN
§4.4 promised *one* continuous animation total ("同屏持续动画只允许『可打出
柔光呼吸』一处"); the shipped code has three systems, one of them multiplied
across six cards. (Related dead risk: the unused `.card-view--just-played`
class animates box-shadow over `--motion-slow` = 900ms — if anyone wires it
up, it joins this problem.)

**(b) Why it matters here.** School tablets are the weakest devices in the
deployment, and Board3D already spends the frame. Six breathing box-shadows +
a drifting foil + a WebGL scene is exactly how a game drops to visible jank —
and jank reads to a first-time user as "I broke it" or "it doesn't listen to
me," the opposite of reassurance. The glow's *information* ("this card can be
played") is static; only its breathing is decorative.

**(c) Fix.** Make the playable glow static (ring + halo, no keyframes) and let
the existing one-shot 700ms sweep (`.pglow-sweep`, already built) carry the
"look here" moment when a card *becomes* playable. If a breath is kept, keep
it on one hero element only and animate a pseudo-element's `opacity`
(compositor-friendly), 2.6s ease-in-out. Replace `.tc-foil`'s infinite drift
with the one-shot sweep pattern Slice B already uses for `.card-foil`
(900ms, once, transform-only). Cap: one ambient animation on screen, per the
design's own §4.4.

**(d) Severity: High** — performance on the actual deployment hardware.

## Finding 3 — Reduced-motion: the global 0.01ms nuke silently overrides the designed 120ms degradations

**(a) Problem + evidence.** `src/theme/base.css` applies the classic reset:
under `prefers-reduced-motion: reduce`, `* { animation-duration: 0.01ms
!important; transition-duration: 0.01ms !important; }`. That `!important`
overrides every careful per-component value in `cards.css`'s own
reduced-motion blocks — flip 120ms (`.tc-flip`), coin roll 120ms (`.cc-strip`),
parent flight 120ms (`.card-fly`), and the JS-side 120ms drag return in
`useDragPlay.ts` (whose CSS transition is likewise crushed). R10_DESIGN §4.3's
whole degradation spec is effectively dead code.

**(b) Why it matters here.** The review standard is explicit: reduced motion
means *fewer and gentler*, not zero — keep the opacity/color changes that aid
comprehension, remove the travel. A card that teleports back to the hand with
a 0.01ms transition gives a low-confidence child *no* spatial trace of where
it went; the designed 120ms slide is precisely the teaching version ("it went
back to your hand"). Children who need reduced motion are also the ones who
most need that trace.

**(c) Fix.** Delete the global `!important` duration reset; keep a global rule
only against *infinite/decorative* animations. Let the per-component values
stand: flips/flights/returns at 120ms ease-out, entrances as 120–200ms opacity
fades, CoinCounter jumping straight to the final value (its 120ms transition
already reads as instant), popup/toast as pure opacity fades.

**(d) Severity: Medium-High** — accessibility correctness; the spec'd behaviour currently never runs.

## Finding 4 — Weak built-in easing everywhere, and the overshoot spring curve driving press/hover micro-interactions

**(a) Problem + evidence.** The project's default UI curve is
`--motion-ease: ease-out` (tokens.css:183) — the built-in CSS keyword the
Emil standards single out as too weak ("built-in CSS easings lack the punch;
use strong custom curves"). It drives popups, toasts, the weather wheel, the
foil sweep, the spark lines. Meanwhile `--ease-spring:
cubic-bezier(0.34, 1.56, 0.64, 1)` (56% overshoot — far beyond the Playful
archetype's 10–20%) drives: `.btn` transform transitions (`base.css`, 150ms —
a pressed toy button *bounces past* its pressed depth), `.hand-item`
hover/select raise at `--motion-med` = 300ms (the design's own table says
150–200ms), drop-zone state changes, and the drag spring-back (where a spring
*is* right). One curve is being asked to do four different jobs.

**(b) Why it matters here.** Hover/select raise is the highest-frequency motion
in the game — every card inspection. At 300ms with a big overshoot it feels
like the card is wobbling away from the child's finger instead of answering
it. Button presses that bounce read as toy-like in the bad sense: imprecise.
First-time users build trust from the first ten touches; those touches are
exactly these two interactions.

**(c) Fix.** Introduce the standard strong curves as tokens —
`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`,
`--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` — and point `--motion-ease`
at `--ease-out`. Buttons: `transition: transform 140ms var(--ease-out)`
(press feedback budget 100–160ms), no overshoot. Hand raise/neighbour-push:
180ms `var(--ease-out)`. Reserve `--ease-spring` for entrances, the drag
spring-back (420ms, in the design's 380–450 band), flights, and pops — where
overshoot is the playful teaching signal. Optionally soften the spring itself
to `cubic-bezier(0.34, 1.35, 0.64, 1)` (≈ the Playful archetype's ceiling).

**(d) Severity: Medium-High** — feel of the two most-touched interactions in the game.

## Finding 5 — Hand hover-raise is not gated behind `(hover: hover) and (pointer: fine)` — sticky raised cards on tablets

**(a) Problem + evidence.** In `cards.css`, `.hand-item:hover` (and the
neighbour-push rules `.hand-item:hover + .hand-item`,
`.hand-item:has(+ .hand-item:hover)`) apply the raise/straighten/scale(1.06)
with no media-query gate. Elsewhere the codebase knows better: the drag
cursor is gated (`@media (hover: hover) and (pointer: fine)` on `.hand-drag`)
and `TiltCard` ignores touch pointers in JS. Touch browsers fire `:hover` on
tap and *keep* it until another element is tapped.

**(b) Why it matters here.** The deployment device is a tablet: there is no
hover. A child taps a card to select it (the `--sel` class raises it,
correctly), then taps a second card — the first card can stay visually raised
by the stuck `:hover` even though selection moved. Two raised cards = "which
one did I pick?" for a 6-year-old, and the neighbour-push offsets stick too,
shifting the fan layout under the child's finger.

**(c) Fix.** Wrap the `:hover` variants of the raise and push rules in
`@media (hover: hover) and (pointer: fine)`. Keep `:focus-within` and
`.hand-item--sel` ungated — they are the touch/keyboard selection paths and
already carry the same transform.

**(d) Severity: Medium** — state legibility on the primary device class.

## Finding 6 — Draw/event ceremony stacks ~1.5s of unskippable dead time, and the wheel starts at full speed

**(a) Problem + evidence.** At the draw station, `Deck.tsx` gates the
`DRAW_RECIPE` dispatch on a 560ms timer (flip), then the recipe card lands in
the bottom hand with `quest-land` at `--motion-slow` = **900ms**
(`cards.css @keyframes quest-land`) — roughly 1.5s of sequential ceremony
before the child can act, with taps during the flip silently ignored. At the
event station, `.weather-wheel` spins 720° in 900ms on the built-in `ease-out`
(`hud.css`): maximum velocity at frame one, then a long crawl — the opposite
of a real wheel's spin-up/settle — and `.event-weather` then waits
`--motion-slow + 120ms` = 1020ms before fading in.

**(b) Why it matters here.** Ceremony is allowed for rare moments (the review
frequency table, and LottieFiles' dramatic-reveal band of 600–1200ms) — a
first recipe draw *is* a story beat. But 1.5s of *input-dead* time tests a
6-year-old's attention, and a wheel that starts already-stopping reads as
broken rather than exciting; the suspense the spin exists to create leaks out
in the first 200ms.

**(c) Fix.** Trim the landing: `quest-land` 900ms → 550ms on
`cubic-bezier(0.23, 1, 0.32, 1)`. Let a second tap on the deck fast-forward:
dispatch immediately and snap the flip (the timer is already time-based, so
this is a small change in `Deck.tsx`). Re-time the wheel to 1300ms with a
spin-up/settle curve, e.g. keyframes: 0% rotate(0), 18%
`cubic-bezier(0.55, 0.06, 0.68, 0.19)` accelerating, 100% landing on
`--spin-end` with `cubic-bezier(0.12, 0.8, 0.16, 1)` long-decelerate; keep
`.event-weather`'s delay token-coupled to the wheel duration so the result
card still arrives just after the wheel stops.

**(d) Severity: Medium** — attention and perceived responsiveness at two story beats per lap.

## Finding 7 — Cook/Feast assembly stagger overruns the choreography budget

**(a) Problem + evidence.** `.cook-card` and `.plate-in` (`cards.css`) use
`--motion-med` (300ms) entrances with a 120ms per-card stagger
(`animation-delay: var(--stagger)`). With 5–6 ingredient cards the sequence
runs ≈ 300 + 5×120 = **900ms**; four feast plates run ≈ 660ms. LottieFiles'
stagger budgets: standard pattern 50–100ms delay, *total* under 500ms; the
Emil standard puts group stagger at 30–80ms between items.

**(b) Why it matters here.** The assembly is a teaching moment — each
ingredient visibly joins the dish — so a cascade is right; but at ~0.9s the
tail cards arrive after the child's attention has already moved to the
"done" state, and the last card's landing no longer registers as part of the
same event. It also delays the foil-sweep payoff that follows.

**(c) Fix.** Stagger 60ms and duration 260ms `var(--ease-out)`: six cards
finish in ≈ 560ms, four plates in ≈ 440ms. If card counts grow, compute the
stagger as `min(60ms, 240ms / (n − 1))` so the total budget holds by
construction.

**(d) Severity: Low-Medium** — polish on a once-per-game moment; cheap to fix.

## Finding 8 — TiltCard tilt follows the pointer through a 300ms transition — rubber-band lag plus per-move gradient repaint

**(a) Problem + evidence.** `.tc-tilt` has `transition: transform
var(--motion-med) var(--motion-ease)` (300ms), while `TiltCard.tsx` writes
`--tc-rx/--tc-ry/--tc-gx/--tc-gy` on the parent `.tc` element on every
pointermove. The 300ms transition low-passes the tilt into a trailing wobble
(the standards warn that direct pointer ties feel artificial, and the remedy
is spring/lag *tuned short*, not a modal-duration transition); the CSS-var-on-
parent pattern recalcs styles across the card subtree each move, and the
glare's `radial-gradient` repaints each move as well.

**(b) Why it matters here.** Inspect-by-tilt is how a child "picks up" a card
to look at it — the motion that sells the card metaphor. Laggy tilt breaks
the hand–object illusion, the first thing the Hearthstone-style redesign was
bought for. On desktop classroom machines (mouse) this is the most-seen
decorative motion in the game.

**(c) Fix.** Split the durations: tilt-follow transition 120ms
`var(--ease-out)`; keep a slower 250ms return only on pointer-leave (apply via
a `.tc--leaving` class or by transitioning on the parent state). Throttle the
pointermove handler with rAF so var writes happen at most once per frame.
Touch already ignores tilt in JS — keep that.

**(d) Severity: Low** — desktop-only path, but it is the signature interaction of the redesign.

---

## Before / After (summary of the swaps above)

| Before | After | Why |
| --- | --- | --- |
| `.cc-strip` roll: 700ms `cubic-bezier(0.34,1.56,0.64,1)` | 450ms `cubic-bezier(0.23,1,0.32,1)`, ones column delayed 40ms | Overshoot displays a wrong coin total mid-roll; numerals never overshoot |
| `--motion-ease: ease-out` (built-in keyword) | `--ease-out: cubic-bezier(0.23,1,0.32,1)` as the default UI curve | Built-in easings are too weak; strong ease-out feels responsive |
| `.btn` press: 150ms `--ease-spring` (56% overshoot) | 140ms `var(--ease-out)` | Press feedback is 100–160ms and must not bounce past the pressed state |
| `.hand-item` raise: 300ms `--ease-spring` | 180ms `var(--ease-out)` | Highest-frequency motion in the game; design's own table says 150–200ms |
| `.pglow--on`: infinite box-shadow breathing on every playable card | Static glow + existing one-shot 700ms sweep on becoming playable | Box-shadow animation repaints every frame; §4.4 allows one ambient animation |
| `.tc-foil`: `foil-drift 4s linear infinite` (background-position) | One-shot 900ms transform sweep (Slice B `.card-foil` pattern) | Infinite paint animation under a WebGL scene on school tablets |
| Global RM reset: all durations `0.01ms !important` | Per-component RM values stand (120ms slides/fades); global rule only kills infinite/decorative loops | Reduced motion = gentler, not zero; keep the spatial trace that teaches |
| `.hand-item:hover` raise ungated | Raise/push `:hover` rules inside `@media (hover: hover) and (pointer: fine)` | Touch taps leave `:hover` stuck — false "selected" cards on tablets |
| `quest-land`: 900ms | 550ms strong ease-out; second deck tap fast-forwards the flip | ~1.5s of input-dead ceremony at the draw beat |
| `.weather-wheel`: 900ms built-in ease-out over 720° | 1300ms, spin-up then long-decelerate landing | Real wheels accelerate first; ease-out starts at full speed and crawls |
| Cook/plate stagger: 120ms × n (≈900ms total) | 60ms stagger, 260ms duration (≈560ms worst case) | Stagger budgets: 50–100ms steps, < 500ms total |
| `.tc-tilt` transition: 300ms on pointer-follow | 120ms follow / 250ms leave-return, rAF-throttled var writes | 300ms low-pass makes tilt trail the pointer like rubber |

## Verdict

**Block on Findings 1 and 2** (a teaching signal that displays wrong values,
and a paint load the target hardware can't spare); Findings 3–6 should land
in the same pass — they are all small, localised changes to tokens and a
handful of rules. Nothing here asks for new animation; most of it is
*removing* or *shortening* motion, which is also the cheapest performance win
available to this project.

---

## Already good

- **The drag layer is the best motion code in the project** (`useDragPlay.ts`):
  pointer capture, `isPrimary` multi-touch guard, the 8px tap/drag threshold,
  transforms written directly to the element (no CSS-var-on-parent driving),
  `will-change` applied only while dragging/returning, magnet pull at 1/3
  distance so it assists without grabbing, and a 420ms spring-back inside the
  design's 380–450ms band. The post-drag click swallow prevents the classic
  "dropped and accidentally selected" bug.
- **Invalid drops reassure instead of punishing**: spring-back + a ≤180ms
  shake, no error text, no red — exactly right for low-confidence children,
  and the shake is correctly *not* the LottieFiles error pattern (no colour
  change, no 300–400ms oscillation).
- **PlaySpark's DOM rewrite** (PlaySpark.tsx): the design budgeted a Canvas
  2D burst; the shipped DOM version uses zero rAF and zero canvas,
  transform/opacity only, self-destructs at 480ms, caps concurrency at 3, and
  is fully off under reduced-motion. On this hardware that is strictly better
  than the spec.
- **CoinFly in the 3D board** (`board/three/CoinFly.tsx`): 3 coins arc
  pawn ↔ station prop over 0.75s with a 70ms stagger — the clearest
  cause→effect money teacher in the game ("coins leave me and go to the
  stall"), correctly skipped under reduced-motion and fired once per ledger
  entry via nonce.
- **Legacy ceremony animations are gated** behind
  `prefers-reduced-motion: no-preference` (popup-rise, coin-bump, card-flip,
  weather-spin, think-glow in hud.css/board.css), and **RotatePhone** under
  reduced-motion doesn't just stop — it parks the phone at 90°, so the
  instruction still teaches statically. That is the reduced-motion philosophy
  done right, and Finding 3 is about extending it to the card layer.
- **Spatial continuity on state change**: when a card is bought and the fan
  re-deals, remaining `.hand-item`s *transition* (300ms) to their new fan
  positions instead of snapping — children can track where the other cards
  went. Same for the drop-zone `--hot`/`--pop` states: the zone answers the
  drag before the drop happens.
- **The parent-station selection flight** (420ms, FLIP-measured, clone-based,
  source card hidden during flight) is a model "where did my answer go"
  animation — and its dispatch-after-landing is a deliberate, defensible
  exception because the flight *is* the sending metaphor.
- **No `transition: all`, no `scale(0)` entrances, no `ease-in` on UI**
  anywhere in the card layer — the three most common feel-breaking patterns
  are simply absent.
