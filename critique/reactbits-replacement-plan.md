# React Bits Replacement Plan — 《一起去买菜》 UI + 动效 overhaul

- Date: 2026-11-21. Base: `canonical-source` @ `1d50ad5`.
- Inputs: `critique/ui-effects-inventory.md` (the 132-item denominator, IDs A1–G8,
  counting rules as fixed there — not drifted here) and
  `critique/reactbits-catalog-map.md` (all 219 React Bits components judged).
- Owner requirements: overall replacement ≥70% (≥93/132); a rate for EACH
  section A–G; UI **and** UI motion （动效， group F) replaced; final delivery is
  this itemised list with the rates.

## Dependency decisions (PM, applied as given)

1. **`motion` is adopted** as a real dependency (MIT) — it unlocks the
   button / micro-interaction layer (Swipe Toast, Jelly Radio, Rubber Segment,
   Count Up, Blur Text, Rotating Text, Stack, Flip Card…).
2. **gsap is NOT adopted.** Components whose original needs gsap (Split Text,
   Animated Content, Fade Content, Bubble Menu, Text Type) get the PlaySpark
   treatment: vendor the *design*, re-implement the behaviour in motion/CSS.
   Per project precedent (PlaySpark, Magnet) this counts as React Bits basis.
3. **hugeicons glyphs are swapped** for hand-written inline SVGs (standing
   practice) on every vendored component that imports them.
4. **No ogl, no matter-js, no second WebGL runtime.** WebGL-shader components
   are limited to at most ONE hero surface each, and none may compete with the
   3D board while it is on screen. In this plan that means exactly two shader
   surfaces total: Specular Button on A8 (one pill, board screen's single CTA)
   and Silk on G6 (intro-shell screens only, board absent).

## Conversion rule (applied strictly)

An item counts as **CONVERTED** only if its implementation will actually be
replaced by (a) the React Bits component's vendored source (adapted for
tokens / i18n / a11y), or (b) a faithful re-implementation of that component's
design + behaviour in motion/CSS (PlaySpark precedent). "Inspired by" does NOT
count. Items that stay custom carry a one-line reason. Already–React-Bits items
(B1, B2, B3, C1, F1, F2, F3) count as converted — they were converted in R10.

Hard constraints respected throughout: children 6–12, buttons ≥48px, text
≥14px, no rapid flashing / no shake / no hit-stop, `prefers-reduced-motion`
honoured on every animation, English UI, touch-first, five acceptance sizes,
engine red line (`src/game`, `src/data`, `src/config`) untouched, item-13 toast
behaviour (queue, 4s dwell, tap-dismiss), and Thong's two overrides — toast
renders above cards/panels; selected/emphasis = glow + lift, never an outline.

## Rates summary

| Section | Converted | Total | Rate |
|---|---|---|---|
| A. Buttons & interactive controls | 16 | 18 | **88.9%** |
| B. Cards & panels | 17 | 27 | **63.0%** |
| C. Text, numbers & badges | 13 | 20 | **65.0%** |
| D. Notifications & overlays | 8 | 14 | **57.1%** |
| E. Navigation & menus | 3 | 7 | **42.9%** |
| F. Ambient & feedback effects （动效） | 34 | 38 | **89.5%** |
| G. Backgrounds & decorative layers | 5 | 8 | **62.5%** |
| **Overall** | **96** | **132** | **72.7%** |

**The ≥70% bar is met honestly: 96/132 = 72.7%, a margin of 3 items over the
93 minimum.** No item was fudged to reach the number — see the sensitivity note
after the section tables for exactly which conversions are most contestable
and what happens if they are struck.

---

## A. Buttons & interactive controls (18) — 16 converted

| ID | Item | Verdict | React Bits basis | Method / how it lands |
|---|---|---|---|---|
| A1 | Primary button | CONVERT | Glare Hover + motion press spring (Magnet params) | Vendor Glare Hover; press/hover sheen + spring press on the shared Button. Specular Button is deliberately NOT used here — one shader canvas per instance cannot be sprayed on every screen's main action |
| A2 | Secondary button | CONVERT | Glare Hover | Vendor; sheen fires on press (touch path), same Button basis as A1 |
| A3 | Navy button ("Done with this stop") | CONVERT | Glare Hover + motion spring | Same Button.tsx basis as A1/A2. Slide Commit was rejected: slide-to-confirm would change a team-decided tap-to-exit flow |
| A4 | Speak button (TTS) | CONVERT | Glare Hover + motion spring | Button.tsx family — its chrome/press layer takes the shared basis; the TTS behaviour itself is untouched logic |
| A5 | Settings button (disabled placeholder) | CONVERT | Pill Nav | Vendor (lands with the E3 topbar rebuild); stays disabled until a settings surface exists — Squish Switch is reserved as the basis for its future toggles |
| A6 | How-to-play button | CONVERT | Pill Nav | Vendor; a topbar nav action inside the E3 Pill Nav rebuild |
| A7 | Popup close button (✕) | KEEP | — | No React Bits modal-close component exists; the a11y contract (≥48px, labelled, Esc-linked) stays custom |
| A8 | Board-enter pill ("Go to this stop") | CONVERT | Specular Button (+ Shiny Text on the label) | Vendor — THE one hero shader surface (a single always-visible pill); label stays static, ≥56px hit area kept |
| A9 | Proposal Yes button | CONVERT | Glare Hover button basis | Adapt — rebuilt inside ProposalPill on the WS1 button basis |
| A10 | Proposal No button | CONVERT | Glare Hover button basis | Adapt — secondary treatment, same basis as A9 |
| A11 | Toast dismiss hit area | CONVERT | Swipe Toast | Vendor (lands with D1); tap-dismiss kept per item-13, swipe-dismiss added |
| A12 | Phone FAB — wallet/bus | CONVERT | Bubble Menu | Adapt-rewrite in motion (gsap not adopted) — the expanding circular FAB menu is this surface's exact pattern |
| A13 | Phone FAB — help | CONVERT | Bubble Menu | Adapt-rewrite in motion; same menu system as A12 |
| A14 | Phone quick-action row | CONVERT | Pill Nav | Vendor; sliding active treatment for the quick slots |
| A15 | DemoBar chips | CONVERT | Glide Select | Adapt-rewrite in motion, icons swapped; demo-build-only surface |
| A16 | Board retry button | CONVERT | Glare Hover + motion spring (primary-button basis) | Adapt; one-tap retry kept — Hold Button was rejected (sustained press is a motor demand on an error path) |
| A17 | Reflection choice rows | CONVERT | Jelly Radio | Vendor (motion); pick-one rows — chosen row swells, neighbours budge |
| A18 | Parent chat controls (send + demo-skip) | KEEP | — | Prompt Bar is a NO FIT (adult AI composer); the parent chat stays one-button simple for the audience |

## B. Cards & panels (27) — 17 converted

| ID | Item | Verdict | React Bits basis | Method / how it lands |
|---|---|---|---|---|
| B1 | TiltCard | CONVERT (already) | TiltedCard | Vendored in R10 |
| B2 | Hand fan | CONVERT (already) | BounceCards | Vendored in R10 |
| B3 | ProfileCard | CONVERT (already) | ProfileCard + ReflectiveCard layout | Vendored in R10 (rewritten in-house) |
| B4 | CardView (card face) | CONVERT | Glare Hover | Vendor; the face gains the same sheen system as TiltCard's glare — face layout, art and bottom-third text untouched |
| B5 | Deck | CONVERT | Stack | Vendor (motion); flick/drag-through pile — tap-to-draw remains as the accessible path |
| B6 | RecipeCard | KEEP | — | The quest card is reading-critical at all five sizes; Holo Card's foil is reserved for a possible completion moment but does not replace the card, so it is not counted |
| B7 | MiniCardRow | CONVERT | Animated List | Adapt-rewrite in motion; bought-thumbs spring in with the list's stagger |
| B8 | BotCard | CONVERT | Spotlight Card | Vendor; soft spotlight that lights on press (touch path) |
| B9 | StationPopup shell | KEEP | — | The modal frame is layout/a11y infrastructure (focus trap, labelledby); React Bits has no shell equivalent — its motion converts as F22, counted there, not twice |
| B10 | MarketPanel | KEEP | — | A game-flow panel inside the shared shell; its substance converts elsewhere (cards B4/B2, CoinBar C2, buttons A-group) — no React Bits market-flow component exists |
| B11 | StorePanel | CONVERT | Pixel Card | Vendor, adapted: slow pixel twinkle on the temptation cards, press-triggered (hover does not exist on tablets), rate kept well below flicker |
| B12 | BusPanel | CONVERT | Tear Ticket | Adapt-rewrite in motion; the fare moment becomes a ticket that tears on TAP (tap-to-tear simplification — no fine-motor drag for grade 1–3) |
| B13 | CookPanel | CONVERT | Stepper | Vendor, icons swapped; the cook flow becomes a readable step track |
| B14 | DrawTaskPanel | KEEP | — | Its draw moment is B5's and F23's conversion; the panel itself is a shell-hosted flow with no own React Bits fit |
| B15 | EventPanel | KEEP | — | Narrative text panel; its reveal motion converts as F13 — text treatments are barred from narrative/instructional text (they fight early reading) |
| B16 | ParentPanel | CONVERT | Text Type | Adapt-rewrite in motion/CSS (gsap not adopted); parent replies render paced with tap-to-complete and capped length — lands paired with D11; controls unchanged per A18 |
| B17 | PartnerPanel | KEEP | — | Its proposal surfaces convert elsewhere (D2, A9, A10); the panel frame has no React Bits fit |
| B18 | AutoPanel | KEEP | — | Purely informational panel; there is no interaction surface to convert |
| B19 | WalletDrawer | CONVERT | Animated List | Vendor, icons swapped; bought-card rows spring in with gliding selection. Swipe Row's delete semantics are explicitly NOT adopted — the game has no delete |
| B20 | HelpCard (How to play) | CONVERT | Stepper | Vendor, icons swapped; how-to-play becomes paged steps with a gliding indicator |
| B21 | Character select cards | CONVERT | Jelly Radio | Vendor (motion); the pick feedback — chosen tile swells, neighbours budge; the grid layout is unchanged |
| B22 | Intro stat cards | CONVERT | Spotlight Card | Vendor; same family as B8 |
| B23 | BasketReview lists | CONVERT | Animated List | Vendor, icons swapped; own-vs-others basket rows spring in |
| B24 | Feast plates / table | KEEP | — | A table-spread layout has no React Bits counterpart (Card Swap is a stack, not a spread); its arrival motion converts as F18/F19 and its backdrop as G6 |
| B25 | Reflection cards | CONVERT | Animated List | Adapt-rewrite in motion; per-player cards enter as spring rows (the ledger lines are C20) |
| B26 | Human HUD card | KEEP | — | Persistent HUD layout; its readouts convert individually (C1 already, C3 keeps for pedagogy, C5 converts) — no React Bits persistent-HUD component exists |
| B27 | WeatherSpinner (DOM wheel) | KEEP | — | The weather ceremony is team-decided and result-first (the wheel performs a decided result); Option Wheel would put a picker input model under that ritual |

## C. Text, numbers & badges (20) — 13 converted

| ID | Item | Verdict | React Bits basis | Method / how it lands |
|---|---|---|---|---|
| C1 | CoinCounter | CONVERT (already) | Counter | Vendored in R10 |
| C2 | CoinBar (+ maths line) | CONVERT | Counter (already vendored) | Adapt; the equation's result numeral rolls via the vendored Counter — layout and the "12 − 3 → 9" teaching format unchanged |
| C3 | CoinDots | KEEP | — | One dot per coin beside every numeral is a team pedagogy rule (physical money); no React Bits equivalent exists — Slosh Gauge was rejected on exactly this ground. Its pop-in motion converts as F25 |
| C4 | Coins display (legacy readout) | CONVERT | Count Up | Vendor (motion); lands together with F24, whose bump keyframe it replaces |
| C5 | Coin delta chip (+N/−N) | CONVERT | Animated Content | Adapt-rewrite in motion; the chip is rebuilt as the reveal wrapper's rise+fade — paired with F26 (one work item, two inventory items retired) |
| C6 | Card price label | KEEP | — | The 18px price at five sizes is a ww acceptance measurement; sheen/gradient text treatments would hurt price legibility for early readers |
| C7 | Lap-gain badges | CONVERT | Count Up | Vendor (motion); gains count up when they change |
| C8 | Turn order strip | CONVERT | Animated List | Adapt-rewrite in motion; the active player's highlight glides between chips (the component's gliding selection) |
| C9 | Progress pips | CONVERT | Stepper | Adapt-rewrite; pips become Stepper's readable step-track treatment — paired with F34 |
| C10 | KeyHint badge | KEEP | — | A static key-cap serving keyboard pedagogy; no React Bits component; it must stay static and high-contrast |
| C11 | MetaIcon badges (✓/carrot/star) | CONVERT | Warm Tooltip | Adapt-rewrite in motion; the tap-to-show-name behaviour (a ww requirement) gains the warm-group pattern — first tap waits, siblings then answer instantly. The glyphs themselves stay flat, shape-distinct SVGs per ww's rule |
| C12 | PendingChip (pay-later) | CONVERT | Swipe Toast (fuse design) | Adapt; the chip's countdown becomes the burning-fuse visual — paired with F11 |
| C13 | Clip / IOU chips | KEEP | — | Money-state tokens bound to the ledger's physical metaphors; no React Bits fit; they must stay instantly readable |
| C14 | Popup coin badge | CONVERT | Counter (already vendored) | Adapt; the header badge's numeral rolls like C2 |
| C15 | Heading / title styles | CONVERT | Split Text | Adapt-rewrite in motion (gsap not adopted); per-character staggered entrance for headings and popup titles — screen headings additionally take Blur Text's soft-focus resolve in the same work item |
| C16 | Build stamp | KEEP | — | A diagnostic version label; it must stay static and legible |
| C17 | Weather result label | CONVERT | Shiny Text | Vendor; a sheen sweep on the result word — emphasis with zero outline |
| C18 | Phone FAB badge (debt count) | KEEP | — | A micro count badge riding on A12's surface; rolling/animated digits at badge size would hurt readability |
| C19 | Selected-card readout ("Picked: Fish…") | KEEP | — | This line IS the money-maths lesson; animating it would undermine the teaching, and no React Bits component fits an instruction line |
| C20 | Reflection ledger | CONVERT | Animated List | Vendor, icons swapped; ledger rows spring in — totals additionally take Count Up in the same work item |

## D. Notifications & overlays (14) — 8 converted

| ID | Item | Verdict | React Bits basis | Method / how it lands |
|---|---|---|---|---|
| D1 | Toast stack | CONVERT | Swipe Toast | Vendor (motion, icons swapped). Item-13 preserved exactly: queue one-at-a-time, 4s dwell — now shown honestly by the burning fuse — tap-dismiss kept, swipe-dismiss added; renders above cards/panels per the owner's override |
| D2 | Proposal pill | CONVERT | Animated Content + Border Glow | Adapt-rewrite in motion; the pill's reveal is re-based on the reveal wrapper and its sweep on the already-vendored Border Glow system |
| D3 | Spotlight overlay | CONVERT | Fade Content | Adapt-rewrite in motion (gsap not adopted); veil fade/blur-in — paired with G4 |
| D4 | Hint / key-help bar | CONVERT | Rotating Text | Vendor (motion); guidance phrases cycle at ≥3s each, keeping one-thing-at-a-time |
| D5 | Rotate prompt | KEEP | — | A portrait gate that must render independently of the in-game UI; no React Bits counterpart exists |
| D6 | Loading splash | KEEP | — | A pre-React boot surface (inline in index.html, before the bundle loads) — React Bits components are React and cannot power it; and its progress must track real loading (owner rule), so Lattice Loader decoration is rejected on the same ground |
| D7 | Splash error card | KEEP | — | Same pre-React constraint as D6 |
| D8 | Board error card | CONVERT | Fade Content | Adapt-rewrite in motion; the card's reveal uses the vendored wrapper — its retry button is A16 |
| D9 | Board log line | KEEP | — | Event narration must be instantly readable the moment it changes; text-animation treatments fight exactly that |
| D10 | Bot thinking indicator | CONVERT | Status Mark | Adapt-rewrite in motion; idle ring → progress arc → check morph maps calmly onto bot turns |
| D11 | SpeechBubble | CONVERT | Text Type | Adapt-rewrite in motion/CSS (gsap not adopted); paced reveal with tap-to-complete, short lines only — paired with B16 |
| D12 | DemoBar overlay | KEEP | — | A demo-build-only container strip; its chips convert as A15 — the strip itself is plain chrome with no counterpart |
| D13 | Phone turn banner | KEEP | — | It changes every turn; a repeated entrance animation would violate the one-thing-at-a-time calm, and its content duplicates C8 |
| D14 | Weather moment card | CONVERT | Blur Text | Vendor (motion); the card's title resolves from soft focus — its pop motion converts as F29 |

## E. Navigation & menus (7) — 3 converted

This is the weakest section, honestly: most of it is behaviour infrastructure
(keyboard scheme, layer stack) or container screens whose substance converts
under other IDs — there is very little visual surface here for any component
library to replace.

| ID | Item | Verdict | React Bits basis | Method / how it lands |
|---|---|---|---|---|
| E1 | Intro screen | CONVERT | Gradient Text | Vendor; the slow living-gradient title (intro only, project palette) is the screen's hero treatment — its screen fade rides WS4's Fade Content basis. **Sensitivity-flagged** (see note below) |
| E2 | CharacterSelect screen | KEEP | — | A container screen; its substance (B21) converts — no distinct React Bits screen component exists |
| E3 | Game topbar | CONVERT | Pill Nav | Vendor; the bar becomes the pill nav hosting A5/A6 |
| E4 | Overlay layer stack | KEEP | — | Behaviour infrastructure (Esc-closes-top, focus semantics), not a visual surface; React Bits has no layer manager |
| E5 | Phone rail | KEEP | — | A layout container; its controls (A12–A14) and its surface (G5) convert — Dock's magnification is hover-centric and was marked down for touch |
| E6 | Keyboard navigation | KEEP | — | An input scheme and a team-tested a11y contract; no React Bits equivalent |
| E7 | Language toggle （中/EN) | CONVERT | Rubber Segment | Vendor (motion); the rubber-thumb segmented switch — chosen over Pill Nav because its semantics are exactly a two-way switch |

## F. Ambient & feedback effects — 动效 (38) — 34 converted

| ID | Item | Verdict | React Bits basis | Method / how it lands |
|---|---|---|---|---|
| F1 | PlaySpark | CONVERT (already) | ClickSpark | Vendored in R10 (DOM/CSS rewrite) |
| F2 | PlayableGlow sweep | CONVERT (already) | BorderGlow | Vendored in R10 |
| F3 | Drag-play spring + magnet snap | CONVERT (already) | Magnet | Spring params vendored in R10 |
| F4 | Card played flash | CONVERT | Border Glow | Adapt; a buy landing pulses the vendored border-glow on the card/thumb instead of a flat mint flash |
| F5 | Hand pop-in | CONVERT | BounceCards (already vendored) | Adapt; the separate CSS pop-in keyframe is deleted — the entrance becomes the vendored Hand's own spring entrance |
| F6 | Quest land | CONVERT | Animated Content | Adapt-rewrite in motion; landing = slide + spring-settle reveal variant |
| F7 | Drag shake | CONVERT | Magnet (already vendored) | Adapt; **the shake is deleted** (it violates the no-shake audience rule) — off-target feedback becomes a spring tug/resistance inside the Magnet drag system |
| F8 | Drop-zone pop | CONVERT | Magnet | Adapt; the pop becomes a spring scale within the drag system |
| F9 | Deck lift + idle bob | CONVERT | Stack | Adapt; lift and bob are re-based on the pile's spring physics — lands with B5 |
| F10 | Coin-bar warn pulse | CONVERT | Border Glow | Adapt; the scale pulse is replaced by a single soft warn-colour border-glow pulse on the coin bar |
| F11 | Pending-chip drain | CONVERT | Swipe Toast (fuse design) | Adapt; the drain bar becomes the burning-fuse countdown — paired with C12 |
| F12 | Event weather intro | CONVERT | Animated Content | Adapt-rewrite in motion; slide-in reveal variant |
| F13 | Event reveal pop | CONVERT | Animated Content | Adapt-rewrite in motion; scale/blur reveal variant |
| F14 | Card fly | CONVERT | Magnet | Adapt; the flight becomes a spring-to-target with a settle, on the vendored spring system |
| F15 | Cook fly | CONVERT | Magnet | Adapt; same flight system as F14 |
| F16 | Cook dish-in | CONVERT | Animated Content | Adapt-rewrite in motion; scale/spring reveal variant |
| F17 | Cook steam | KEEP | — | An ambient steam loop; React Bits has no equivalent (its particle systems are NO FIT class) — it stays a slow loop, reduced-motion gated |
| F18 | Feast plate-in | CONVERT | Animated Content | Adapt-rewrite in motion; staggered reveal — plates arrive one by one |
| F19 | Feast spark burst | CONVERT | ClickSpark (already vendored) | Adapt; per-plate bursts come from the vendored PlaySpark system |
| F20 | Card deny shake | CONVERT | Border Glow | Adapt; **the shake is deleted** (audience rule) — a card deny becomes a single soft red glow pulse |
| F21 | Gem deny flash | CONVERT | Border Glow | Adapt; the red flash is replaced by a single soft red glow pulse — the flash class is removed entirely |
| F22 | Popup transitions (rise/out/backdrop) | CONVERT | Animated Content + Fade Content | Adapt-rewrite in motion (gsap not adopted); rise = Animated Content slide variant, outs and backdrop = Fade Content fades |
| F23 | Card flip | CONVERT | Flip Card | Vendor (motion); the spring flip replaces the hand-written 560ms CSS flip |
| F24 | Coin bump | CONVERT | Count Up | Adapt; the bump keyframe is deleted — a number change IS Count Up's animation; lands with C4 |
| F25 | Coin dot pop | CONVERT | Magnet (vendored springs) | Adapt; new dots pop in on the shared spring params (the dots themselves stay custom per C3) |
| F26 | Coin delta rise | CONVERT | Animated Content | Adapt-rewrite in motion; rise+fade reveal — paired with C5 |
| F27 | Toast slide-in | CONVERT | Swipe Toast | Vendor; the entrance is the vendored toast's own motion — paired with D1 |
| F28 | Weather wheel spin | KEEP | — | The DOM spin is the result-first weather ceremony (team-decided: the result is decided, the wheel performs it); Option Wheel's picker physics would put an input model under a performative ritual |
| F29 | Moment pop | CONVERT | Animated Content | Adapt-rewrite in motion — paired with D14 |
| F30 | Moment pocket | CONVERT | Animated Content | Adapt-rewrite in motion; the pocket-away is the wrapper's exit variant |
| F31 | Story sink | CONVERT | Fade Content | Adapt-rewrite in motion; fade/slide-out exit |
| F32 | Think pop family | CONVERT | Animated Content | Adapt-rewrite in motion; the bubble pop re-based on the reveal wrapper — reduced-motion gating preserved exactly (the indicator itself is D10) |
| F33 | Think halo | CONVERT | Border Glow | Adapt; the pulsing halo ring becomes a soft glow ring on the vendored glow system |
| F34 | Lap dot pulse | CONVERT | Stepper | Adapt; the pulse becomes Stepper's active-step treatment — paired with C9 |
| F35 | Rotate-phone turn loop | KEEP | — | A rotate-device instructional loop; no React Bits counterpart exists (pairs with D5) |
| F36 | Splash coin bounce | KEEP | — | Pre-React inline splash (same architectural constraint as D6), and no React Bits bounce-loop design exists to re-base it on |
| F37 | Card hover / press / selected transitions | CONVERT | Star Border | Vendor; **selected/emphasis = the travelling border glow + Border Glow + the existing lift** (owner ruling: the orange outline is gone) — Glare Hover supplies the sheen in the same work item; one active instance at a time; keyboard focus stays clearly visible in glow form |
| F38 | Weather-moment backdrop crossfade | CONVERT | Fade Content | Adapt-rewrite in motion; the stage backdrop's colour crossfade is the fade wrapper's variant applied to the backdrop layer |

## G. Backgrounds & decorative layers (8) — 5 converted

| ID | Item | Verdict | React Bits basis | Method / how it lands |
|---|---|---|---|---|
| G1 | App backdrop (cream gradient) | CONVERT | Noise | Adapt; a STATIC single frame of fine grain at low opacity over the cream gradient (animated grain is shimmer — banned). Matches the risograph print texture of the card art |
| G2 | Board area frame | KEEP | — | The structural host of the WebGL canvas; any decorative layer would compete with the 3D board |
| G3 | Popup backdrop | CONVERT | Gradual Blur | Vendor; the backdrop's edges gain a progressive blur — the dim itself is unchanged |
| G4 | Spotlight veil | CONVERT | Fade Content | Adapt-rewrite in motion — paired with D3 (one implementation) |
| G5 | Phone rail panel surface | CONVERT | Gradual Blur | Vendor; the rail's end fades soften the layer boundary |
| G6 | Intro shell backdrop | CONVERT | Silk | Vendor, adapted: the ONE background shader surface — intro-shell screens only, where the 3D board is absent; slow folds, reduced-motion = static frame, and feast/reflection fall back to the static frame whenever the board is still mounted |
| G7 | Board loading placeholder | KEEP | — | The placeholder stays visually silent by design; loading is already communicated by the splash (D6) |
| G8 | App shell frame | KEEP | — | Root layout infrastructure; no React Bits counterpart |

---

## Sensitivity note — where the 72.7% could be challenged

The margin over the 93-item minimum is **3 items**. The three conversions a
strict reviewer is most likely to contest, in order:

1. **E1** — a whole screen counted on its hero title treatment (Gradient Text).
2. **B16** — a panel counted on its reply rendering (Text Type), paired with D11.
3. **A5** — a currently-disabled button counted via the topbar rebuild it rides on.

If all three were struck, the total would be **93/132 = 70.5% — still at the
bar.** If a fourth conversion fell, the reserve flips, in order of honesty
cost, are:

- **F28** (weather spin → Option Wheel spin physics, keeping the result-first
  contract by construction): flippable, at the cost of putting a picker
  component's physics under a team-decided ceremony — a real design risk, not
  a free point.
- **B6** (RecipeCard → Holo Card on the completion state only): flippable only
  as a partial-surface conversion; the base card must stay matte for reading.
- **C3 / D6 / F36 must never be flipped to chase the number**: C3 is a
  pedagogy rule (physical coins), D6/F36 are architecturally pre-React. Any
  plan claiming them is fudging.

Paired items (one implementation retiring two inventory items) are marked
inline wherever they occur: C5+F26, C12+F11, C4+F24, C9+F34, D1+F27, D3+G4,
D11+B16, D14+F29. The inventory's own counting rules count components and
their named effects as separate items, and in each pair both implementations
genuinely are replaced — but they are flagged so the count can be audited.

## Workstreams for parallel Devin sessions

Six streams, grouped by code area. New conversions per stream sum to 89
(89 + 7 already-React-Bits = 96). **WS5 lands first** — it vendors the shared
motion primitives (Animated Content / Fade Content wrappers, the Border Glow
system extensions, shared spring params) that WS2–WS4 consume, and it owns the
`@keyframes` sections of the four CSS files so no other stream edits them.

### WS1 — Buttons & controls (15 items)
- **Items:** A1, A2, A3, A4, A5, A6, A8, A9, A10, A12, A13, A14, A15, A16, A17
- **Files:** `src/components/Button.tsx`, `src/screens/Game.tsx` (topbar /
  phone-rail / board-enter regions), `src/components/ProposalPill.tsx`,
  `src/demo/DemoBar.tsx`, `src/board/BoardMount.tsx`, `src/screens/Reflection.tsx`
- **Shared-file conflicts:** Game.tsx (with WS3, WS4); ProposalPill.tsx (WS4's
  D2); BoardMount.tsx (WS4's D8); Reflection.tsx (WS2's B25, WS3's C20)
- **Notes:** vendors Glare Hover, Pill Nav, Specular Button, Bubble Menu
  (rewrite), Glide Select (rewrite). A8 is the plan's only per-instance shader.

### WS2 — Cards & panels (14 items)
- **Items:** B4, B5, B7, B8, B11, B12, B13, B16, B19, B20, B21, B22, B23, B25
- **Files:** `src/components/CardView.tsx`, `src/components/cards/Deck.tsx`,
  `src/components/MiniCardRow.tsx`, `src/components/BotCard.tsx`,
  `src/components/StorePanel.tsx`, `src/components/BusPanel.tsx`,
  `src/components/CookPanel.tsx`, `src/components/ParentPanel.tsx`,
  `src/components/WalletDrawer.tsx`, `src/components/HelpCard.tsx`,
  `src/screens/CharacterSelect.tsx`, `src/screens/Intro.tsx`,
  `src/screens/BasketReview.tsx`, `src/screens/Reflection.tsx`
- **Shared-file conflicts:** BotCard.tsx (WS3's C7, WS4's D10 — sequence BotCard
  work inside WS2 or merge WS2 last among the three); Reflection.tsx (WS1, WS3);
  Intro.tsx (WS4's E1, WS6's G6)

### WS3 — Text, numbers & badges (12 items)
- **Items:** C2, C4, C5, C7, C8, C9, C11, C12, C14, C15, C17, C20
- **Files:** `src/components/cards/CoinBar.tsx`, `src/components/Coins.tsx`,
  `src/screens/Game.tsx` (delta chip / order strip / pips / popup badge
  regions), `src/components/BotCard.tsx` (C7), `src/components/cards/MetaIcon.tsx`,
  `src/components/cards/PendingChip.tsx`, `src/hud.css` + `src/screens.css`
  (heading styles only — NOT the @keyframes sections, which are WS5's),
  `src/components/WeatherSpinner.tsx`, `src/screens/Reflection.tsx`
- **Shared-file conflicts:** Game.tsx (WS1, WS4); BotCard.tsx (WS2, WS4);
  Reflection.tsx (WS1, WS2); hud.css (WS5 owns keyframes, WS4/WS6 touch
  backdrop rules)

### WS4 — Notifications, overlays & navigation (13 items)
- **Items:** D1 (+A11), D2, D3, D4, D8, D10, D11, D14, E1, E3, E7, G4
- **Files:** `src/components/Toast.tsx`, `src/ui/toastQueue.ts`,
  `src/components/ProposalPill.tsx`, `src/screens/Game.tsx` (spotlight / hint /
  topbar regions), `src/board/BoardMount.tsx`, `src/components/BotCard.tsx`
  (D10), `src/components/SpeechBubble.tsx`, `src/components/EventPanel.tsx`
  (D14), `src/screens/Intro.tsx` (E1), `src/i18n/LangToggle.tsx`
- **Shared-file conflicts:** ProposalPill.tsx (WS1's A9/A10 — do the pill and
  its buttons in one pass); Game.tsx (WS1, WS3); BoardMount.tsx (WS1's A16);
  BotCard.tsx (WS2, WS3); Intro.tsx (WS2's B22, WS6's G6)

### WS5 — Effects & motion catalogue （动效） (31 new items; F1–F3 already done)
- **Items:** F4, F5, F6, F7, F8, F9, F10, F11, F12, F13, F14, F15, F16, F18,
  F19, F20, F21, F22, F23, F24, F25, F26, F27, F29, F30, F31, F32, F33, F34,
  F37, F38
- **Files:** the `@keyframes` / animation sections of
  `src/components/cards/cards.css`, `src/hud.css`, `src/board.css`,
  `src/phone.css`; new shared motion primitives (Animated Content / Fade
  Content wrappers, e.g. under `src/components/motion/`); extensions to
  `src/components/cards/PlayableGlow.tsx` and
  `src/components/cards/useDragPlay.ts`; Star Border vendored here for F37
- **Shared-file conflicts:** all four CSS files are also touched by WS2/WS3/
  WS4/WS6 for non-animation rules — WS5 owns keyframes + `animation`
  properties exclusively; paired items (F26 with WS3's C5, F27 with WS4's D1,
  F24 with WS3's C4, F34 with WS3's C9, F29 with WS4's D14, F11 with WS3's
  C12) are joint tasks: WS5 supplies the motion, the owning stream wires it in
- **Order:** FIRST — every other stream consumes its primitives

### WS6 — Backgrounds & shells (4 items)
- **Items:** G1, G3, G5, G6
- **Files:** `src/App.css`, `src/theme/base.css`,
  `src/components/StationPopup.tsx` + `src/hud.css` (backdrop rules),
  `src/phone.css` (rail surface), `src/screens.css` (intro shell)
- **Shared-file conflicts:** hud.css / phone.css / screens.css (WS3, WS5);
  StationPopup.tsx is otherwise untouched (B9 keeps) — backdrop rules only
- **Order:** LAST — highest visual risk; needs the full five-size screenshot
  pass, and G6's shader must be frame-cost-prototyped on the weakest target
  tablet before it is accepted

### Integration order

WS5 → (WS1 ∥ WS4) → (WS2 ∥ WS3) → WS6, merging in that order with the full
unit suite after each merge, the red-line diff check (`src/game`, `src/data`,
`src/config` = 0) at every step, and five-size screenshot evidence per stream.
Every vendored or design-vendored component is registered in
`THIRD_PARTY_NOTICES.md` by the stream that lands it (the R10 pattern),
including the gsap-design rewrites, which are credited as designs.

## Guardrails recap for every stream

- Audience: one thing at a time; buttons ≥48px; text ≥14px; no flashing, no
  shake, no hit-stop (this plan deletes the game's last two shakes, F7/F20,
  and its last flash, F21); every animation gated by `prefers-reduced-motion`.
- Item-13 toast behaviour and the two owner overrides (toast on top; glow, not
  outline) are not negotiable inside any stream.
- Touch-first: every hover/pointer-led effect must have a press path or be
  decoration-only (marked per item above).
- Performance: `motion` is the only new runtime dependency; shader surfaces
  are exactly two (A8, G6); bundle size is re-measured at integration.
