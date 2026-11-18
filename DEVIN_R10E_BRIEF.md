# DEVIN BRIEF — R10 Slice E: cards ARE the interface (de-panel + cinematic moments + ProfileCard)

You are the implementer; Muse is PM and will acceptance-check your work.
Baseline: Slice D commit `d61918a` on branch `canonical-source`.
Read first: `AGENTS.md`, `R10_DESIGN.md` (through the Slice D record), and the
owner's direction below — it supersedes earlier presentation choices where
they conflict.

## OWNER'S DIRECTION (verbatim intent, 2026-11-18, from his playtest)
1. "减少界面 UI — 大部分用卡片形式代替，或者实体金币。" Reduce information
   UI. Most information should be carried by CARDS or by PHYSICAL COINS,
   not by labelled boxes / text panels.
2. "卡片就不用套进一个 UI 里面，这样太蠢了。" A card must NOT sit inside a
   white panel box. The card itself is the interface; the world is the stage.
3. The weather example (the pattern to generalise): "天气卡片：视角推到转盘，
   先转，转完天气弹出这个卡片，点一下卡片消失，天气可以变一下，然后再继续。"
   Camera pushes in to the spinner → the spinner spins → the weather CARD
   pops up in the world → tap the card → it disappears → the world's weather
   visibly changes → camera returns → play continues.

AUDIENCE (unchanged): left-behind children 6–12, rural primary schools,
low-end tablets, first-time touch users. Every change below is presentation
only, justified for them: less reading, more touching real things.

## RED LINES
- `git diff d61918a..HEAD -- src/game src/data` must be EMPTY. Flow, rules,
  station order, commands: untouched. Board3D scene code (src/board/three)
  is presentation and MAY change for camera/weather work.
- KEEP every `data-testid`, `data-key`, and the DOM hooks the e2e/keyboard
  drivers use (`.popup` may remain as a transparent stage element; panels
  keep their testids). All 213 existing tests must stay green; add tests
  for new pure helpers.
- Visual tokens only in `src/theme/tokens.css`; list token changes.
- Both languages for every new string (`src/i18n/zh.ts` + `en.ts`).
- No new network calls. ONE exception to "no new dependencies": the owner
  ordered the React Bits ProfileCard integration (below) — but implement it
  WITHOUT @hugeicons (see §3); no other new dependencies.
- Reduced motion = gentler, not zero; transform/opacity first; the 30fps
  low-end budget stands (no new infinite paint animations).
- Append a 「Slice E 落地记录」 to R10_DESIGN.md; commit locally; do NOT push.

## §1 — De-panel every station (the "no box around cards" rule)
StationPopup's white rounded container goes away visually for ALL stations
(draw/recipe, market, store, event, bus, friends, parent, cook, feast,
reflection, help, wallet):
- The stage is the dimmed/blurred board itself. Panel content — decks,
  fans, story cards, option cards, chat bubbles — floats directly on the
  backdrop with card shadows, no enclosing white box, no panel border.
- The station title + goal chip + mini recipe strip (Slice D) become ONE
  small floating pill tag at top-center of the stage (translucent dark or
  cream pill, backdrop blur), not a header bar inside a box.
- Action rows (buy / hold / skip / done) become floating pill buttons at
  the stage bottom, same order, same data-key/testid, ≥48px.
- Parent station: bubbles float on the backdrop; the input row is a
  floating rounded bar at the bottom; the parent avatar+name is a floating
  tag. Wallet drawer and help card: same floating treatment (a single
  floating CARD is fine — it is a card, not a box around cards).
- Phone-landscape rail: same de-panel treatment inside the rail (no white
  box; content floats on a dimmed rail backdrop). Keep the Slice D
  safearea fixes intact (bottom padding on real boxes, not display:contents
  shells).

## §2 — The cinematic moment pattern (weather is the template)
Implement the owner's weather sequence exactly, using the EXISTING 3D
board (`WeatherSpinner3D` is already in the scene; `Scene` already takes
`weather`):
1. Weather moment starts → camera (CameraRig) pushes in toward the island
   centre spinner (a presentation-level camera move; respect the R8 fit
   solver — push-in is a temporary framing, on exit restore the solved
   framing exactly).
2. The 3D spinner spins and lands on the result (drive it from the same
   state the current weather UI uses; the engine result does not change).
3. The weather CARD pops in the world centre (the existing weather card
   art, large, with the Slice A/D card treatment), name readable.
4. Tap the card (or its data-key equivalent / Enter) → card dismisses
   (fly-out/fade), AND the scene weather visibly changes: sky/light +
   weather dressing in Scene (sun ↔ cloud ↔ rain as the card says).
5. Camera pulls back to the solved framing; play continues.
- 2D fallback (WebGL unavailable): same beats without camera move — the
  existing wheel graphic spins in the floating stage, then the card pops,
  tap dismisses, a weather tint washes the backdrop. Do not break the
  current no-WebGL path.
- Generalise the SAME rhythm (world beat → result card pops in-world →
  tap to dismiss → world echoes the change) to:
  a. Recipe draw: deck floats centre-stage (§1 already); on draw, the
     recipe card pops large; tap pockets it (flies to the basket strip).
  b. Event reveal: after the flip, the story card stays centre; tap
     dismisses it into the board (the option cards then present — flow
     order of commands unchanged; this is sequencing of presentation
     only, the choice still goes through existing commands).
  c. Cook dish reveal: the finished dish card pops centre-stage with the
     Slice C foil stamp; tap dismisses to the feast.
  If (a)–(c) force a choice between the pattern and an existing tested
  interaction, keep the tested interaction and note the deviation.

## §3 — ProfileCard character cards (owner-ordered React Bits integration)
The owner supplied the React Bits `ProfileCard` component (JS+CSS, holo
foil + glare + tilt) and ordered its integration.
- Port it into `src/components/cards/ProfileCard.tsx` (+ its CSS, adapted
  to the project's token system where colours are concerned; keep the holo
  engine — spring physics, rAF, pointer handlers — intact). The pasted
  source contains curly-quote corruption: normalise all quotes and fix
  any syntax damage. Convert to TypeScript with the documented props.
- Do NOT install @hugeicons: the component's only icon use is the contact
  button's mail glyph — replace it with an inline SVG. Credit React Bits
  (MIT + Commons Clause) in THIRD_PARTY_NOTICES.md for ProfileCard too.
- Use it to REPLACE the bot/player info boxes (owner screenshot: the
  "Zip / Eager / Coins: 12 / Got: —" text panels):
  - Character spotlight: when a bot takes its turn, and when the human
    taps any player's medallion, that player's ProfileCard pops in-world
    (pattern §2 rhythm: pop → tap dismisses). name = player name,
    title = trait label (existing personality data), status = a SHORT
    state line (coins as a number is fine here — the card is the info
    surface now), avatarUrl = portrait (see below), contact button
    repurposed: label 「篮子」/ "Basket", onContactClick opens the
    existing wallet/basket view for that player if one exists, else omit
    the button via contactText="".
  - The corner/turn-strip presence shrinks to medallions (avatar disc +
    trait badge + PHYSICAL coin dots, §4) — no text panels.
- Portraits: search the repo for existing character portrait art first
  (public/, src/assets, models/textures/mini-characters). Preference:
  (1) existing portrait files; (2) a per-character backdropColor + the
  character's existing icon as the tile's visual (iconUrl pattern is
  acceptable); (3) emoji-free coloured tile with the trait glyph as inline
  SVG data-URI. State which you used in the record. Do NOT generate or
  fetch external images.
- Tilt/holo: desktop pointer only, touch keeps Slice D long-press inspect
  behaviour; holo strength modest (≤0.8) and one card at a time (the 30fps
  budget — no holo on every HUD element).

## §3b — Character-card LAYOUT follows the owner's ReflectiveCard (added by owner mid-run)
The owner also supplied a second React Bits component, `ReflectiveCard`,
saying "卡片排版可以这样" — the card LAYOUT can be like this. Adopt its
composition for the character cards (§3), whether you build them on
ProfileCard or a shared shell:
- Vertical ID-card composition: header row (badge chip on the left,
  status with a coloured dot on the right) → identity block (big name,
  role/trait under it) → footer row (a small label + value pair on the
  left — for us: 金币/coins with the physical coin dots, or 还差/recipe
  gap — and a small square tile button on the right, e.g. the basket).
- The card is tall/portrait, rim-lit edge, layered tile surfaces — match
  that visual hierarchy with our cream/orange/navy tokens.
- HARD LIMITS (PM ruling, do not negotiate in code): do NOT port the
  WebGL2 shader pipeline, do NOT use its video capture, and NEVER enable
  its webcam path — this is a children's classroom product (privacy) on
  low-end tablets (the 30fps budget already carries one WebGL scene).
  Approximate the brushed-metal/reflective material with CSS gradients
  + the ProfileCard holo/glare layers. Do NOT install @hugeicons (its
  two icons — verified badge, fingerprint tile — become inline SVGs).
  If the layout and ProfileCard's footer conflict, ReflectiveCard's
  layout wins for the identity/footer structure.

## §4 — HUD information diet (physical coins, fewer words)
- Bot corners (desktop) and the turn strip: medallion + coin dots
  (physical coins, cap the dot row at 10 with a "+n" badge) + bought
  items as tiny card thumbnails; delete the "Coins: n / Got: —" text
  lines.
- Bottom bar: the labelled boxes (My wallet / Maybe later / To pay later /
  Hint) become OBJECTS: wallet = the coin pile (dots + big numeral,
  tappable, same behaviour); hold clip = a mini card stack with a count
  badge; pay-later clip = a mini card stack with coin-IOU tokens; hint =
  the help CARD icon. Labels survive only as accessible names / tiny
  captions under the object, not as box titles.
- Top-right lap/order text panel: keep ONLY Slice D's pictorial cluster
  (lap dots + station pips + avatar order strip); delete the text order
  sentence.
- The turn banner's single primary action pill stays (it is an action,
  not information).

## Verification you must run and report honestly
- `npm run build`, `npm run test` (exact counts; ≥213 + new).
- Before/after screenshot pairs (ZH desktop 1440×900 + phone-land
  844×390), `shots/r10e_*.png`: board HUD, recipe draw stage, weather
  sequence (mid-spin or card-pop frame + after-dismiss weather-changed
  frame), market stage, event story card, parent stage, bot ProfileCard
  spotlight, store stage.
- e2e: run ONCE serially at the end if time permits; report per-test
  results exactly (known environment timeouts family — compare against
  the Slice D record, don't loop-retry).
- Final message: files changed, token changes, which portrait option you
  used, screenshot list, e2e result, deviations and anything not landed.
