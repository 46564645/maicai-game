# DEVIN BRIEF — R10 Slice B: full card-ification of remaining stations + all card art wired

You are the implementer; Muse is PM and will acceptance-check your local commit.
Repo: `~/workspace/maicai-work`, branch `canonical-source`, baseline commit `e6634bb`
(R10 Slice A: card primitives in `src/components/cards/`, 152 tests green).
Read first: `R10_DESIGN.md` (§2 station mapping, §3 faces, §5 acceptance, §7 red lines,
and the Slice A completion note at the end), `AGENTS.md`, `THIRD_PARTY_NOTICES.md`.

## Scope

1. **Wire all remaining card art.** `art-r10/final/MAPPING.md` lists 33 generated
   illustrations by card id. Copy each into `src/assets/cards/` under a clean name
   (Slice A convention: `ingredient-<name>.webp`, `dish-<name>.webp`; extend with
   `temptation-*.webp`, `weather-*.webp`, `event-*.webp`) and register every one in
   `src/components/cards/cardArt.ts`. `rec-tomato-egg-2` reuses the tomato-egg art.
   The two invite cards reuse popsicle / sticker art. Emoji fallback stays for any
   unregistered id. Add/extend cardArt tests.
2. **EventPanel (Surprise station):** the drawn event first appears as a face-down
   card (card-back art) and flips to reveal the event card (TiltCard flip engine,
   event illustration as the face art). Weather, when shown, is a card too
   (weather art). Keep every existing command, option and timing behaviour.
3. **PartnerPanel (Friends station):** the choice options become a small fan of
   TiltCards (illustration where one exists, else existing icon). Tap = choose,
   exactly as today; keyboard path preserved.
4. **BusPanel:** the bus choice becomes a ticket-style card the child can drag
   onto the board area OR tap-tap (tap ticket, tap confirm) — both paths fire the
   same existing command. If drag adds risk, tap-tap alone with the ticket card
   visual is acceptable; note which you shipped in the design doc record.
5. **ParentPanel:** picture answer cards become TiltCards in a small fan; the
   chosen card animates (transform/opacity only) toward the chat area before the
   answer is sent. **Do not touch the R9 live/offline status indicator** — it must
   stay visible and correct in live mode, offline mode and ZH/EN. Free-text live
   flow (parentLive.ts) unchanged.
6. **StorePanel (temptation shop):** shelf becomes a Hand fan reusing the Slice A
   primitives, temptations now carry their new illustrations via cardArt.
7. **Ending flow (Cook / Feast / Reflection panels):** collected dish cards
   assemble with a fly-in stagger; the coin total uses CoinCounter; a CSS foil
   sheen appears ONLY at recipe-complete and feast moments (no WebGL). Add the
   PlaySpark burst (adapted from React Bits ClickSpark, credit it in
   THIRD_PARTY_NOTICES.md) at buy / board / settle / recipe-complete, global cap
   ≤3 concurrent, transform/opacity/canvas-light only — if canvas conflicts with
   the frame budget, use a DOM spark. BasketReview and WalletDrawer get the light
   card treatment only (CardView faces), no flow changes.
8. **Re-shoot the draw ritual screenshots cleanly** (Slice A leftover): demo strip
   CLOSED, correct scene in frame — draw flip + landed, desktop 1280×800 and
   phone 874×402 (phone context needs hasTouch/isMobile), names
   `shots/r10b_draw_flip_*`, `shots/r10b_draw_landed_*`.

## Red lines (unchanged, will be diffed at acceptance)

- `git diff src/game src/data` must be EMPTY. Engine, rules, cards.json content
  and the 14 rules are untouchable.
- No new dependencies. Tokens only in tokens.css (additions only, existing values
  untouched). No new network calls. Never read/modify `.env.local`. No live API
  calls anywhere (tests mocked, as in R9).
- Every drag has a tap-tap AND keyboard equivalent. reduced-motion keeps the
  whole game playable. Animation = transform/opacity only; no second WebGL
  context; rAF must idle-stop.
- Commit LOCALLY only. No push, no zip, no deploy — PM packages.

## Acceptance (leave evidence in the repo)

- `npm run build` clean; full test suite green (152 baseline + your new tests).
- Screenshot set `shots/r10b_*`: event flip (before/after), friends fan, parent
  card fan (offline mode is fine), store fan, feast assembly — desktop 1280×800
  + phone 874×402 for at least event + feast.
- R8 fit re-run: fill stays 0.658–0.660, panel cover 0.0%, no new 1024×768 wrap.
- Append an “R10 Slice B” record to R10_DESIGN.md: what shipped per station,
  bus drag decision, test count, screenshot list, any deviation from this brief.
- One local commit, message starting `R10 Slice B:`.
