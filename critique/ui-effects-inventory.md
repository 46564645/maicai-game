# UI / Effects Inventory — DOM-layer surface (the React Bits percentage denominator)

- Project: 《一起去买菜》, `canonical-source` @ `1d50ad5` (2026-11-21).
- Purpose: Thong ordered ≥70% of the game's UI/effects surface replaced with
  [React Bits](https://github.com/DavidHDev/react-bits) components. This file is the
  **definitive, countable inventory** of that surface. The percentage = items whose
  implementation basis is REACT BITS ÷ total items below.
- Scope: DOM layer only (React components + CSS). Three.js scene internals and the
  game engine are excluded (listed at the end) — outside React Bits' domain.
- Counting rules (fixed, do not drift between rounds):
  1. One item = one distinct component, control style, readout, overlay, or named
     effect — not one per usage instance.
  2. A named keyframe family serving one component behaviour = 1 item
     (e.g. deck-lift + deck-bob = 1; think-pop + think-pop-phone(+end) = 1).
  3. Basis values: `REACT BITS` (vendored/adapted, registered in
     `THIRD_PARTY_NOTICES.md`), `CUSTOM` (own CSS/JS), `LIBRARY-OTHER`
     (non-React-Bits library; none currently on the DOM layer).
- Current result: **7 / 132 items are React Bits = 5.3%**.

---

## A. Buttons & interactive controls (18)

| ID | Item | File | What it does | Basis |
|---|---|---|---|---|
| A1 | Primary button (`.btn--primary`, orange, ≥56px) | `src/components/Button.tsx` | Main action on nearly every screen/panel | CUSTOM |
| A2 | Secondary button (`.btn--secondary`, white outline) | `src/components/Button.tsx` | Secondary action beside primaries | CUSTOM |
| A3 | Navy button variant (`.btn--navy`, "Done with this stop" bar) | `src/components/Button.tsx` + panel CSS | Full-width stop-exit action in station panels | CUSTOM |
| A4 | Speak button (`.btn-speak`, 🔊 TTS) | `src/components/Button.tsx` | Reads a button's text aloud for pre-readers | CUSTOM |
| A5 | Settings button (⚙, currently disabled placeholder) | `src/screens/Game.tsx` (topbar) | Settings entry in the game topbar | CUSTOM |
| A6 | How-to-play button (`.help-card-btn`) | `src/screens/Game.tsx` | Opens the HelpCard overlay | CUSTOM |
| A7 | Popup close button (`.popup-close`, ✕) | `src/components/StationPopup.tsx` | Closes station popups / drawers | CUSTOM |
| A8 | Board-enter pill ("Go to this stop", floating orange pill) | `src/screens/Game.tsx` (`.board-enter`) | The one always-visible enter-station action (ww item-12 ruling) | CUSTOM |
| A9 | Proposal Yes button | `src/components/ProposalPill.tsx` | Accepts a bot's swap proposal | CUSTOM |
| A10 | Proposal No button (`.board-await-no`) | `src/components/ProposalPill.tsx` | Declines a bot's swap proposal | CUSTOM |
| A11 | Toast dismiss hit area (`.toast-x`, ≥48px) | `src/components/Toast.tsx` | Tap-to-dismiss the current toast | CUSTOM |
| A12 | Phone FAB — wallet/bus (`.phone-fab`, coin count + debt badge) | `src/screens/Game.tsx` | Phone-rail shortcut to wallet / bus debt | CUSTOM |
| A13 | Phone FAB — help (`.phone-fab--help`) | `src/screens/Game.tsx` | Phone-rail shortcut to How to play | CUSTOM |
| A14 | Phone quick-action row (`.phone-quick`) | `src/screens/Game.tsx` | Compact quick actions in the phone rail | CUSTOM |
| A15 | DemoBar chips (`.demo-chip`, incl. `--go` / `--warn`) | `src/demo/DemoBar.tsx` | Demo-build jump/personality/reset chips (demo builds only) | CUSTOM |
| A16 | Board retry button (`.board-retry`, 56px) | `src/board/BoardMount.tsx` | Retries 3D board mount after a start failure | CUSTOM |
| A17 | Reflection choice rows (`.reflection-options`) | `src/screens/Reflection.tsx` | Pick-one reflection answers at game end | CUSTOM |
| A18 | Parent chat controls (send + demo-skip, `.chat-demo-skip`) | `src/components/ParentPanel.tsx` | Sends a chat message / skips the scripted demo reply | CUSTOM |

## B. Cards & panels (27)

| ID | Item | File | What it does | Basis |
|---|---|---|---|---|
| B1 | TiltCard (tilt + glare + flip engine) | `src/components/cards/TiltCard.tsx` | Every playable/display card's 3D tilt, glare and flip | REACT BITS (TiltedCard) |
| B2 | Hand fan (`.hand-fan`) | `src/components/cards/Hand.tsx` | Fanned hand of cards: bounce-in, spread, hover raise, drag/tap to play | REACT BITS (BounceCards) |
| B3 | ProfileCard (player spotlight card) | `src/components/cards/ProfileCard.tsx` | ID-card-style player highlight (avatar, name, traits, basket) | REACT BITS (ProfileCard + ReflectiveCard layout) |
| B4 | CardView (card face: art / name / price / icons) | `src/components/CardView.tsx` | The unified #fff6e9 card face, text in bottom third | CUSTOM |
| B5 | Deck (draw pile + flip) | `src/components/cards/Deck.tsx` | Face-down pile cards flip over when drawn | CUSTOM |
| B6 | RecipeCard | `src/components/RecipeCard.tsx` | Recipe/quest card shown at Recipe Stop and in popups | CUSTOM |
| B7 | MiniCardRow (bought-card thumbnails) | `src/components/MiniCardRow.tsx` | Small row of cards a bot bought this turn | CUSTOM |
| B8 | BotCard (bot player card) | `src/components/BotCard.tsx` | Bot avatar, name, coin dots/number, lap gain, thinking state | CUSTOM |
| B9 | StationPopup shell (`.popup`: head / body / foot frame) | `src/components/StationPopup.tsx` | Shared modal frame for all station interactions | CUSTOM |
| B10 | MarketPanel | `src/components/MarketPanel.tsx` | Buy / maybe-later / skip flow at The Market | CUSTOM |
| B11 | StorePanel | `src/components/StorePanel.tsx` | Temptation-goods grid at The Shop | CUSTOM |
| B12 | BusPanel | `src/components/BusPanel.tsx` | Bus fare / IOU resolution at Bus Stop | CUSTOM |
| B13 | CookPanel | `src/components/CookPanel.tsx` | Cooking flow with flying ingredients and dish reveal | CUSTOM |
| B14 | DrawTaskPanel | `src/components/DrawTaskPanel.tsx` | Draw-a-task (recipe) panel at Recipe Stop | CUSTOM |
| B15 | EventPanel | `src/components/EventPanel.tsx` | Surprise-stop event story + choices | CUSTOM |
| B16 | ParentPanel (AI parent chat) | `src/components/ParentPanel.tsx` | Chat with the parent character at Parent Stop | CUSTOM |
| B17 | PartnerPanel (Friends Stop) | `src/components/PartnerPanel.tsx` | Swap proposal / invite flow with a friend bot | CUSTOM |
| B18 | AutoPanel | `src/components/AutoPanel.tsx` | Auto-resolved station panel (informational stops) | CUSTOM |
| B19 | WalletDrawer | `src/components/WalletDrawer.tsx` | Slide-over wallet: coins, clips/IOUs, bought cards | CUSTOM |
| B20 | HelpCard (How to play) | `src/components/HelpCard.tsx` | Rules, icon legend and tips overlay | CUSTOM |
| B21 | Character select cards (`.char-grid`) | `src/screens/CharacterSelect.tsx` | Pick-your-character tiles | CUSTOM |
| B22 | Intro stat cards (`.stat-card`) | `src/screens/Intro.tsx` | Three fact cards on the intro screen | CUSTOM |
| B23 | BasketReview screen lists | `src/screens/BasketReview.tsx` | Own basket vs. others' baskets before the feast | CUSTOM |
| B24 | Feast plates / table (`.plate-dish`, `.feast-table`) | `src/screens/Feast.tsx` | End-of-game dishes presented plate by plate | CUSTOM |
| B25 | Reflection cards (`.reflection-card` / list) | `src/screens/Reflection.tsx` | Per-player end-of-game reflection summary | CUSTOM |
| B26 | Human HUD card (`.me-coins` coin pile + avatar/name/hand) | `src/screens/Game.tsx` | The human player's always-visible bottom card | CUSTOM |
| B27 | WeatherSpinner (DOM wheel) | `src/components/WeatherSpinner.tsx` | DOM fallback/host wheel for the weather ceremony (spin + result) | CUSTOM |

## C. Text, numbers & badges (20)

| ID | Item | File | What it does | Basis |
|---|---|---|---|---|
| C1 | CoinCounter (rolling digit counter) | `src/components/cards/CoinCounter.tsx` | Coin totals roll digit-by-digit on change (0–99) | REACT BITS (Counter) |
| C2 | CoinBar (panel coin bar + `.cb-math` maths line) | `src/components/cards/CoinBar.tsx` | "12 − 3 → 9" coin maths pinned in station panels | CUSTOM |
| C3 | CoinDots (physical coin dots) | `src/components/CoinDots.tsx` (+ `src/ui/coinDots.ts`) | One dot per coin beside every numeral | CUSTOM |
| C4 | Coins display (`.coins-count`, bump on change) | `src/components/Coins.tsx` | Legacy coin count readout with bump animation | CUSTOM |
| C5 | Coin delta chip (`.coin-delta-chip`, +N / −N) | `src/screens/Game.tsx` + `src/ui/useCoinDelta.ts` | Floating gain/loss chip when coins change outside buying | CUSTOM |
| C6 | Card price label (price pill on card face) | `src/components/CardView.tsx` | 18px price at all five acceptance sizes | CUSTOM |
| C7 | Lap-gain badges (`.bot-lap-gain`, `.order-chip-gain`) | `src/components/BotCard.tsx`, `src/screens/Game.tsx` | "+N this lap" gain readout per player | CUSTOM |
| C8 | Turn order strip (`.order-chip`: avatar/name/num/coins/gain) | `src/screens/Game.tsx` | Who acts in what order this lap | CUSTOM |
| C9 | Progress pips (`.stop-pips`, `.lap-dots`, `.prog`) | `src/screens/Game.tsx` | Stops/laps progress dots | CUSTOM |
| C10 | KeyHint badge (`.key-hint`) | `src/components/KeyHint.tsx` | Number/letter key hint inside buttons | CUSTOM |
| C11 | MetaIcon badges (✓ On my list / carrot Food / star Fun stuff) | `src/components/cards/MetaIcon.tsx` | Shape-distinct category icons on cards (≥20px, aria-labelled) | CUSTOM |
| C12 | PendingChip (to-pay-later chip) | `src/components/cards/PendingChip.tsx` | Shows a card parked in "pay later" with drain timer | CUSTOM |
| C13 | Clip / IOU chips (`.clip-chip--debt/--help/--hold`, `.iou-token`) | `src/screens/Game.tsx` | Held-money clips and IOU tokens in the HUD | CUSTOM |
| C14 | Popup coin badge (`.popup-coin-badge`) | `src/screens/Game.tsx` (popup head) | Coin count badge in popup headers | CUSTOM |
| C15 | Heading / title styles (`.game-title`, `.popup-title`, `.intro-title`) | `src/hud.css`, `src/screens.css` | The game's display-type hierarchy | CUSTOM |
| C16 | Build stamp ("build {commit}") | `src/screens/Intro.tsx` (`.build-stamp`) | Version stamp shown on the intro screen | CUSTOM |
| C17 | Weather result label (`.weather-result`) | `src/components/WeatherSpinner.tsx` | Names the weather the wheel landed on | CUSTOM |
| C18 | Phone FAB badge (`.phone-fab-badge`, bus-debt count) | `src/screens/Game.tsx` | Debt-count badge on the phone wallet FAB | CUSTOM |
| C19 | Selected-card readout (`.panel-selected` line) | station panels (`MarketPanel.tsx` et al.) | "Picked: Fish (3 coins) · After you buy: 9 coins" | CUSTOM |
| C20 | Reflection ledger (`.ledger` lines/groups/totals) | `src/screens/Reflection.tsx` | End-of-game money story, grouped with totals | CUSTOM |

## D. Notifications & overlays (14)

| ID | Item | File | What it does | Basis |
|---|---|---|---|---|
| D1 | Toast stack (`.toast-stack` / `.toast`) | `src/components/Toast.tsx` (+ `src/ui/toastQueue.ts`) | Queued one-at-a-time event narration, 4s + tap-dismiss (owner ruling 2026-11-21: renders above cards) | CUSTOM |
| D2 | Proposal pill (`.board-await`) | `src/components/ProposalPill.tsx` | Floating swap-proposal prompt with avatar + sweep | CUSTOM |
| D3 | Spotlight overlay (`.spotlight-veil` host) | `src/screens/Game.tsx` (+ `src/ui/spotlight.ts`) | Dimmed stage + ProfileCard when a player is tapped | CUSTOM |
| D4 | Hint / key-help bar (`.panel-keyhelp`, `.btn-kbd-hint`) | station panels, `src/screens/Game.tsx` | "←/→ pick a card · 1/2/3 pick an action" guidance line | CUSTOM |
| D5 | Rotate prompt (portrait gate) | `src/components/RotatePhone.tsx` | Full-screen "turn your phone" loop on portrait phones | CUSTOM |
| D6 | Loading splash (card, bouncing coin, real progress bar + %) | `index.html` (`#app-splash`) + `src/splash.ts` + `src/boot.ts` | Boot screen tracking real asset/scene loading (T-2) | CUSTOM |
| D7 | Splash error card (fail / stall / offline + Try again) | `index.html` + `src/splash.ts` | Friendly boot-failure message with retry | CUSTOM |
| D8 | Board error card ("Oops! The board didn't start." + Try again) | `src/board/BoardMount.tsx` (`.board-error`) | 3D-start failure state (replaced the 2D fallback, 2026-11-21) | CUSTOM |
| D9 | Board log line (`.board-log`) | `src/screens/Game.tsx` | One-line narration of the last board event | CUSTOM |
| D10 | Bot thinking indicator (`.bot-card-thinking` + board think bubble) | `src/components/BotCard.tsx`, `src/board.css` | Shows which bot is "thinking" and its trait bubble | CUSTOM |
| D11 | SpeechBubble | `src/components/SpeechBubble.tsx` | Character speech bubble with optional actions | CUSTOM |
| D12 | DemoBar overlay | `src/demo/DemoBar.tsx` | Demo-build control strip (demo builds only) | CUSTOM |
| D13 | Phone turn banner (`.phone-turn`) | `src/screens/Game.tsx` | Whose-turn banner in phone landscape | CUSTOM |
| D14 | Weather moment card (`.moment-card`) | `src/components/EventPanel.tsx` / panels (+ `src/ui/weatherMoment.ts`) | Full-stage weather reveal card after the spin | CUSTOM |

## E. Navigation & menus (7)

| ID | Item | File | What it does | Basis |
|---|---|---|---|---|
| E1 | Intro screen (title, tagline, start flow) | `src/screens/Intro.tsx` | Game entry screen | CUSTOM |
| E2 | CharacterSelect screen | `src/screens/CharacterSelect.tsx` | Character-pick flow screen | CUSTOM |
| E3 | Game topbar (`.game-topbar`: title + actions) | `src/screens/Game.tsx` | In-game navigation bar (settings, help, language) | CUSTOM |
| E4 | Overlay layer stack (help > wallet > demo, Esc closes top) | `src/ui/useLayerStack.ts` + `src/App.tsx` | Overlay navigation/menu system | CUSTOM |
| E5 | Phone rail (`.phone-rail` layout + quick slots) | `src/screens/Game.tsx` | Phone-landscape side navigation rail | CUSTOM |
| E6 | Keyboard navigation (hotkeys: Esc/W/H/D, arrows, 1/2/3) | `src/ui/useHotkeys.ts` | Full-game keyboard control scheme | CUSTOM |
| E7 | Language toggle (中/EN segmented) | `src/i18n/LangToggle.tsx` | Switches the whole UI language | CUSTOM |

## F. Ambient & feedback effects (38)

Counting rule 2 applies: one item per named effect/behaviour.

| ID | Item | File | What it does | Basis |
|---|---|---|---|---|
| F1 | PlaySpark (click sparks on play/buy) | `src/components/cards/PlaySpark.tsx` | Short-line spark burst where a card is played/bought | REACT BITS (ClickSpark, DOM/CSS rewrite) |
| F2 | PlayableGlow sweep (`pglow-sweep`) | `src/components/cards/PlayableGlow.tsx` | Light sweep marking cards that can be played now | REACT BITS (BorderGlow) |
| F3 | Drag-to-play: spring-back + near-target magnet snap | `src/components/cards/useDragPlay.ts` | Card drag with spring return and snap-to-target | REACT BITS (Magnet, spring params) |
| F4 | Card played flash (`card-played-flash`) | `src/components/cards/cards.css` | Mint flash on a card/bot thumb when a buy lands | CUSTOM |
| F5 | Hand pop-in (`hand-pop`) | `src/components/cards/cards.css` | Fan cards pop in with spring stagger | CUSTOM |
| F6 | Quest land (`quest-land`) | `src/components/cards/cards.css` | Drawn quest card landing bounce | CUSTOM |
| F7 | Drag shake (`drag-shake`) | `src/components/cards/cards.css` | Small shake when a drag starts off-target | CUSTOM |
| F8 | Drop-zone pop (`dz-pop`) | `src/components/cards/cards.css` | Drop target pops when a dragged card enters | CUSTOM |
| F9 | Deck lift + idle bob (`deck-lift`, `deck-bob`) | `src/components/cards/cards.css` | Deck lifts on draw, gently bobs when idle | CUSTOM |
| F10 | Coin-bar warn pulse (`cb-warn-pulse`) | `src/components/cards/cards.css` | Coin bar pulses when a pick costs more than planned | CUSTOM |
| F11 | Pending-chip drain (`pending-chip-drain`) | `src/components/cards/cards.css` | Pay-later chip's countdown drain bar | CUSTOM |
| F12 | Event weather intro (`event-weather-in`) | `src/components/cards/cards.css` | Weather strip slides into an event reveal | CUSTOM |
| F13 | Event reveal pop (`event-reveal-pop`) | `src/components/cards/cards.css` | Event card pops in on reveal | CUSTOM |
| F14 | Card fly (`card-fly`) | `src/components/cards/cards.css` | Bought/played card flies to its destination | CUSTOM |
| F15 | Cook fly (`cook-fly`) | `src/components/cards/cards.css` | Ingredient cards fly into the pan | CUSTOM |
| F16 | Cook dish-in (`cook-dish-in`) | `src/components/cards/cards.css` | Finished dish springs into view | CUSTOM |
| F17 | Cook steam (`cook-steam`) | `src/components/cards/cards.css` | Steam puffs over the cooking pan | CUSTOM |
| F18 | Feast plate-in (`plate-in`) | `src/components/cards/cards.css` | Feast plates arrive one by one | CUSTOM |
| F19 | Feast spark burst (`spark-fly`) | `src/components/cards/cards.css` | Per-plate spark celebration at the feast | CUSTOM |
| F20 | Card deny shake (`card-deny-shake`) | `src/components/cards/cards.css` | Shake when a card action is refused | CUSTOM |
| F21 | Gem deny flash (`gem-deny-flash`) | `src/components/cards/cards.css` | Red flash on a refused payment gem/chip | CUSTOM |
| F22 | Popup transitions (`popup-rise`, `popup-out`, `popup-backdrop-out`) | `src/hud.css` | Modal rise-in / fade-out / backdrop fade | CUSTOM |
| F23 | Card flip (`card-flip`) | `src/hud.css` | 560ms flip used by popup card reveals | CUSTOM |
| F24 | Coin bump (`coin-bump`) | `src/hud.css` | Coin count bumps when the total changes | CUSTOM |
| F25 | Coin dot pop (`coin-dot-pop`) | `src/hud.css` | New coin dots pop in with a spring | CUSTOM |
| F26 | Coin delta rise (`coin-delta-rise`) | `src/hud.css` | +N/−N chip rises and fades | CUSTOM |
| F27 | Toast slide-in (`toast-in`) | `src/hud.css` | Toast entrance motion | CUSTOM |
| F28 | Weather wheel spin (`weather-spin`) | `src/hud.css` | DOM weather wheel rotation | CUSTOM |
| F29 | Moment pop (`moment-pop`) | `src/hud.css` | Weather moment card pop-in | CUSTOM |
| F30 | Moment pocket (`moment-pocket`) | `src/hud.css` | Moment card pockets away into the HUD | CUSTOM |
| F31 | Story sink (`story-sink`) | `src/hud.css` | Event story panel sinks away on continue | CUSTOM |
| F32 | Think pop family (`think-pop`, `think-pop-phone`, `think-pop-phone-end`) | `src/board.css`, `src/phone.css` | Bot thinking bubble pop (reduced-motion gated) | CUSTOM |
| F33 | Think halo (`think-halo`) | `src/board.css` | Pulsing halo around the thinking bot | CUSTOM |
| F34 | Lap dot pulse (`lap-dot-pulse`) | `src/board.css` | Current lap dot pulses in the HUD | CUSTOM |
| F35 | Rotate-phone turn (`phone-turn`) | `src/phone.css` | Looping phone-rotation animation on the rotate prompt | CUSTOM |
| F36 | Splash coin bounce (`splash-bounce`) | `index.html` (inline CSS) | Bouncing coin on the loading splash | CUSTOM |
| F37 | Card hover / press / selected lift transitions | `src/components/cards/cards.css` (shared `--shadow-card`) | 2–4px lift + deeper shadow on interactive cards; selected = lift + ring (owner ruling 2026-11-21: ring → glow) | CUSTOM |
| F38 | Weather-moment backdrop crossfade (background 700ms transitions) | `src/hud.css` / `src/board.css` | Stage backdrop colour crossfades with the weather moment | CUSTOM |

## G. Backgrounds & decorative DOM layers (8)

| ID | Item | File | What it does | Basis |
|---|---|---|---|---|
| G1 | App backdrop (body gradient) | `src/App.css` / `src/theme/base.css` | Cream gradient behind every screen | CUSTOM |
| G2 | Board area frame (`.game-board-area`) | `src/screens/Game.tsx` + `src/board.css` | DOM frame/stage that hosts the 3D canvas | CUSTOM |
| G3 | Popup backdrop (`.popup-backdrop`) | `src/components/StationPopup.tsx` + `src/hud.css` | Dim layer behind station popups | CUSTOM |
| G4 | Spotlight veil (`.spotlight-veil`) | `src/screens/Game.tsx` | Dim layer behind the ProfileCard spotlight | CUSTOM |
| G5 | Phone rail panel (`.phone-rail` surface) | `src/phone.css` | Side panel surface in phone landscape | CUSTOM |
| G6 | Intro shell backdrop (`.intro-shell`) | `src/screens.css` | Shared backdrop for intro/character/feast/reflection screens | CUSTOM |
| G7 | Board loading placeholder (`.board-loading`) | `src/board/BoardMount.tsx` + `src/board.css` | Empty stage shown while the 3D board mounts | CUSTOM |
| G8 | App shell frame (`.app-shell`, desktop / phone-land variants) | `src/App.css` / `src/theme/layout.css` | Root layout frame for all screens | CUSTOM |

---

## Counts

| Group | Items | of which React Bits |
|---|---|---|
| A. Buttons & interactive controls | 18 | 0 |
| B. Cards & panels | 27 | 3 (B1 TiltCard, B2 Hand, B3 ProfileCard) |
| C. Text, numbers & badges | 20 | 1 (C1 CoinCounter) |
| D. Notifications & overlays | 14 | 0 |
| E. Navigation & menus | 7 | 0 |
| F. Ambient & feedback effects | 38 | 3 (F1 PlaySpark, F2 PlayableGlow, F3 drag-play magnet) |
| G. Backgrounds & decorative layers | 8 | 0 |
| **Total** | **132** | **7** |

**Current React Bits percentage: 7 / 132 = 5.3%.**
Reaching Thong's ≥70% requires ≥93 of these 132 items on a React Bits basis
(93/132 = 70.5%) — i.e. at least 86 more items converted.

## Excluded from the count (listed for completeness)

- **Three.js 3D scene internals** (`src/board/three/`): Island, Flora, Piece,
  StationTile/StationProps, StreetLoop, WeatherSpinner3D, CoinFly (3D), Effects /
  post-processing chain (pmndrs, LIBRARY-OTHER), CameraRig, QualityProvider,
  SceneWarmup canvas, fitSolver, materials/textures — WebGL, outside React Bits' domain.
- **Game engine & logic** (`src/game/`, `src/data/`, `src/config/`, bot drivers,
  selectors, i18n string tables, parent-station AI client) — no visual surface of its own.
- **Board2D** (`src/board/Board2D.tsx`) — still on disk but unreachable since
  `1d50ad5` removed the 2D fallback; not part of the shipped game surface.
- **BoardView / boardModel** (`src/board/BoardView.ts`, `src/board/boardModel.ts`) —
  view-model plumbing, no DOM of its own.
- The splash's inline no-JS fallback script in `index.html` — part of D6/D7's
  behaviour, not a separate item.
