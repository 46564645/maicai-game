# LENS — UI / Interface Design Critique

Reviewer lens: UI/UX Pro Max priority table (accessibility → touch → layout → typography/colour)
+ Anthropic frontend-design guidance (one dominant element per screen, deliberate type scale,
structural devices must encode information). Benchmark: `UI_STYLE_REFERENCE.png` — every screen
there has ONE hero element and ONE filled orange CTA; everything else is quiet.

Audience yardstick for every finding: left-behind children 6–12, rural primary-school classrooms,
shared tablets or a projector, bright ambient light, reading confidence from "barely reads" (age 6)
to fluent (age 12), **no adult sitting next to the child to explain the screen**.

Measured contrast ratios (computed from `src/theme/tokens.css` values):
ink #1E1E2A on cream = **15.4:1** · muted #6b6572 on cream = 5.3:1 · **white on primary
#FF6B2C = 2.84:1** · yellow #FFC93C on white = 1.54:1 · mint #7ED9B5 on white = 1.68:1 ·
disabled #c9c2b8 on white = 1.77:1.

---

## Finding 1 — Cards in the fan cannot be identified without selecting them one by one

**(a) Problem + evidence.** In the market fan the name band of every non-selected card is
covered by the next card or truncated: `shots/r10a_market_fan_zh_desktop.png` shows
「胡萝…」cut off and two barely-distinguishable brown-blob cards （姜）. The event panel is
worse — with only two choice cards they still overlap and truncate each other
(「花 1 币」half-covered, 「收下欢…」cut) in `shots/r10b_event_revealed_zh_desktop.png`, and the
revealed event card itself reads 「多送一…」. The mitigation promised in R10_DESIGN §6.1 —
"name floats **big** above the selected card" — shipped as `.hand-tag` at
`--font-size-xs` (**14px**, `src/components/cards/cards.css:628ff`), and its `display` rules
exist **only for phone-landscape** (cards.css:669–670); on desktop the floating tag never
renders at all. The desktop fallback is a text readout line under the fan
（选中：豆腐 (2币）), which a non-reader cannot use.
**(b) Why it matters here.** Identifying "which card is the tomato" is the core loop of the
whole lesson. A 6–8-year-old who cannot yet read fluently must identify cards by picture
alone; where two illustrations look alike （姜/土豆 brown blobs, both tofu-white), the name is
the disambiguator — and it is exactly what the fan hides. On a projector, the class sees the
same truncated names from 3 metres away.
**(c) Concrete fix.** (i) In fan state, drop the name band entirely (per §3.1's own intent:
art + price gem only) and make the selected/inspected card's name a true hero tag:
**28px bold ink text on a cream pill with 2px ink outline**, floating above the card,
rendered on **all** viewports, width auto, never truncated. (ii) Raise `--fan-expose`
so each fanned card exposes ≥ its gem + a 24px art slice (desktop 72px is fine once names
are gone). (iii) Fans of ≤3 cards (event choices, friends) must not overlap at all —
space them with a 16px gap; overlap is a ≥5-card device.
**(d) Severity: HIGH** — blocks the core buy/decide loop for the youngest half of the audience.

## Finding 2 — No single dominant next action; the primary button changes costume per panel

**(a) Problem + evidence.** Market desktop (`r10a_market_fan_zh_desktop.png`) presents FOUR
actions at once — 买下（2币）, 先等等， 跳过， 走完这一站 — and **two of them wear the same
orange dashed "primary" costume** while none is the filled orange gradient the token system
defines for the one main action (`--button-primary-bg`). Store
(`r10b_store_fan_zh_desktop.png`) repeats the pattern: 买下 is a dashed outline, not filled.
Parent (`r10b_parent_fan_zh_desktop.png`) does it right — 现在在用 is a filled orange pill —
proving the inconsistency is per-panel, not systemic. The style reference never shows two
equal-weight CTAs on one screen.
**(b) Why it matters here.** These children have high communication cost and no adult
co-pilot; the screen itself must answer "what do I tap now?" in under a second. Two
orange buttons = a coin flip for a 7-year-old, and 买下 vs 先等等 is precisely the
spend-vs-wait decision the lesson teaches — it must be a *deliberate* contrast
(commit vs hold), not a visual tie.
**(c) Concrete fix.** One filled `--gradient-primary` pill per panel for the commit action
（买下/收下/现在在用）, full stop. 先等等 becomes the quiet secondary (paper bg, ink text,
no dashed orange), 跳过/走完这一站 become tertiary text-weight buttons in a separated
bottom row. Apply identically in MarketPanel, StorePanel, EventPanel, PartnerPanel.
Keep the dashed-orange treatment for **drop zones only** (its current second job), so
dashed = "drop here", filled = "tap to commit" — one meaning per costume.
**(d) Severity: HIGH.**

## Finding 3 — Phone-landscape rail clips the fan and breaks the project's own 48px tap rule

**(a) Problem + evidence.** `shots/r10a_market_fan_zh_phone.png`: in the right rail
(`--rail-w: clamp(250px, 30%, 300px)`, `src/phone.css:15`) the fan is **clipped at the top —
only the bottom halves of the cards are visible**, names unreadable, inside a scrollable
rail (`.phone-rail { overflow-y: auto }`) a child must scroll precisely to reveal the cards
they are choosing among. `--fan-expose-sm: 35px` (tokens.css) is below the project's own
`--tap-min-size: 48px` and below the 44px floor in the UI/UX priority table — each card's
tappable strip is 35px wide. The drop-zone buttons collapse into circles whose labels stack
vertically （先/等/等 as a one-character column), which reads as three separate words.
**(b) Why it matters here.** Landscape tablets are the most likely classroom hardware, and
874×402-class screens are the design's own phone reference size. A first-grader faced with
half-hidden cards in a scrollable slit will tap whatever is visible, not what they meant
to choose — the money decision becomes random.
**(c) Concrete fix.** (i) Give the rail a fixed internal layout: fan zone height =
`--card-h-sm` + tag space (≥128px) with `overflow: visible`; the rail scrolls only below
the action zone, never across the fan. (ii) `--fan-expose-sm: 35px → 48px`; if 6 cards
then exceed the rail width, shrink card width (`--card-w-sm` 64→56px) rather than the
exposure strip. (iii) Drop zones on phone: full-width stacked rows (min-height 48px,
label on one line at 20px), never circles with wrapping text.
**(d) Severity: HIGH** for the tablet-in-landscape form factor.

## Finding 4 — Your money disappears exactly when you are deciding how to spend it

**(a) Problem + evidence.** During the market/store modals, the player's balance lives in
the bottom HUD **behind the dimmed backdrop** (`r10a_market_fan_zh_desktop.png`: coin dots
barely visible at the bottom edge). The panel itself shows only the *result* of the
arithmetic — 「买完还剩 7 币」 — never the starting point. On phone the balance pill
(bottom-left, "9") and the decision panel (right rail) are on opposite sides of the screen.
The HUD's coin-dots + number treatment (seen clearly in `r10b_parent_fan_zh_desktop.png`:
9 dots + "9") is excellent — it just isn't present at the moment of choice.
**(b) Why it matters here.** Holding "I have 9, this costs 2, I'll have 7" in working
memory while also reading a fan of cards is a triple load for a 6-year-old, and *planning
with money you can see* is the lesson's core skill (pain point 2: these children rarely
get to make any money decision at all — the scaffold should make the decision *easier*,
not test memory).
**(c) Concrete fix.** Put a compact balance strip inside every money panel, directly above
the action row: coin dots (up to 10, then "×N") + 「你有 9 币」 at 20px bold ink, and when a
card is selected, show the equation pictorially: `9 ●●●●●●●●● − 2 → 7`, with the 2 spent
dots shown hollow. Reuse the existing Coins/CoinCounter components; no new data needed —
the engine already computes the remainder it prints.
**(d) Severity: MEDIUM-HIGH.**

## Finding 5 — Key state cues are carried by colours that wash out in a bright classroom

**(a) Problem + evidence.** Measured from tokens.css: white label text on the primary
orange gradient = **2.84:1** — below even the 3:1 large-text floor, on the single most
tapped element in the game. The "playable" cue is a glow in `--color-accent-yellow`
(#FFC93C family, 1.54:1 on white) at 42–55% opacity — in the desktop screenshots it is
already faint on a calibrated monitor; under classroom glare or a projector it will be
invisible. Bot identity is colour-only coding, and two of the four player colours are
near-invisible on white: mint 1.68:1 （小跟）, yellow 1.54:1 （小冲 — his avatar is a pale
yellow disc with a yellow bolt). Selected state leans on this same glow + a 16px lift.
**(b) Why it matters here.** Bright rooms and cheap projector contrast are the stated
deployment context. If "which cards can I play" and "whose turn/whose card" are encoded
in 1.5:1 yellows and mints, the state of the game is simply not visible to the back row —
or to a colour-weak child at any distance (colour-only coding fails ~1 in 12 boys
regardless of lighting).
**(c) Concrete fix.** (i) Darken the text-bearing part of the primary gradient: shift
`--color-primary-lo` mix from 78% to ~62% primary (toward #a63c00) so white 24px bold
labels clear 3.5:1+, or switch CTA labels to ink #1E1E2A on a lighter orange — pick one
and apply everywhere. (ii) Give "playable" a non-colour cue that survives glare: a 3px
ink outline + the existing 4px lift, with the yellow glow kept as decoration only.
(iii) Player identity: keep the colour chips but always pair them with the existing
icon+name (already present on BotCards — extend the same rule to every place a player
colour appears alone, e.g. turn-order strip and fan inner borders per §3.1).
**(d) Severity: MEDIUM** (MEDIUM-HIGH if deployment is mostly projector-led).

## Finding 6 — Functional text floor is 14px grey; too much of the game is explained, not shown

**(a) Problem + evidence.** `--font-size-xs` (14px) + `--color-muted` is the workhorse
for *functional* copy: card kind tags (cards.css:125), the hand-tag name (cards.css:638),
dozens of HUD captions (`src/hud.css` — bot 钱/已买 lines, hints, status), and panel
explainers like the parent panel's 「说清多少、做什么 → 得 1 币；再说清花在哪…」
(`r10b_parent_fan_zh_desktop.png`, small grey line under the buttons). The persistent
hint 「← → 选卡 · 1/2/3 选择操作」 sits under panels at this size. Muted-on-cream is
5.3:1 — legal for adults, fragile at 14px on a washed-out tablet.
**(b) Why it matters here.** The audience spans pre-readers to fluent readers. Anything a
child must *read in order to act* competes with the pictures; at 14px grey it loses.
The parent-station explainer is the worst case: it encodes the station's entire scoring
rule in one small sentence — a child who can't parse it taps randomly, which defeats the
station's purpose (teaching a child to *express a need clearly* — pain point 3).
**(c) Concrete fix.** Set a hard floor: text a child needs = **≥16px, ink or darker**
(darken `--color-muted` to ~#57505e, ≈6.5:1, if it must stay grey); `--font-size-xs`
reserved for adult-facing metadata (keyboard hints can stay — teachers use them).
Replace the parent explainer sentence with two pictorial steps: a speech-bubble icon +
「说多少 · 做什么 → +1 币」 as two 18px chips with coin icons, matching the two questions
the AI actually asks.
**(d) Severity: MEDIUM.**

## Finding 7 — Store "全部食材" grid crops the art and hides the names

**(a) Problem + evidence.** In `r10b_store_fan_zh_desktop.png` the all-ingredients grid
(`.store-grid`, StorePanel.tsx:195) renders each item as a wide horizontal band: only the
middle slice of each illustration shows （番茄 top, eggs, greens…), the name band is below
the visible tile area, and a stray duplicate row of price gems (2 3 3 4 4) floats between
the grid and the 买下 button. A grid item cannot be identified from its tile alone.
**(b) Why it matters here.** The store is the "I still need X for my recipe" recovery
moment — the child arrives with a specific missing ingredient in mind and must *find* it.
A find-it grid whose items are unlabelled art slices turns recovery into trial-and-error
tapping, mid-lesson, with the class watching.
**(c) Concrete fix.** Grid tiles use the full §3.1 card profile at compact size
(art zone + name band always visible, gem top-left), tile aspect ≈ 4:5, 4 per row at
desktop / 3 in the rail; remove the duplicated gem row (gems belong on tiles only).
If vertical space is tight, drop the section label 全部食材 into the panel header instead
of shrinking tiles.
**(d) Severity: MEDIUM.**

## Finding 8 — Lap/turn progress is small text at the screen edges; nothing pictorial to orient by

**(a) Problem + evidence.** Progress state is carried by text chips: 「第 1 圈 / 共 3 圈」
and a turn-order sentence （顺序：小稳→小冲→小跟→小禾） in 14–16px at the bottom-right
(desktop shots) or a 「第1/3圈」 pill top-left (phone shot). There is no visual progress
device anywhere — no lap dots, no station pips — although the board itself is a loop of
8 stations that begs for one.
**(b) Why it matters here.** A lesson period is ~40 minutes; children (and the teacher
glancing over) need "how far along are we?" answered at a glance, without reading.
Left-behind children in a group-of-4 classroom session also track *whose turn is next*
socially — today that requires reading a name list in reading order.
**(c) Concrete fix.** Add a compact pictorial progress cluster next to the existing lap
chip: 3 large dots (filled = lap done, pulsing outline = current lap) + a "you are here"
marker on an 8-pip station ring in the HUD; highlight the *next* player's avatar in the
turn strip with the same lift/outline language as selected cards. Pure presentation —
no engine/state changes.
**(d) Severity: LOW-MEDIUM.**

---

## Already good — keep and build on these

- **Tangible money in the HUD**: physical coin dots + a big number (9 dots + "9") matches
  the reference app's hero-number treatment and suits pre-numerate children. Finding 4
  asks only that it travel into the panels.
- **Parent panel's primary button** is the model implementation: one filled orange pill,
  inverted white key-hint badge, quiet secondary beside it.
- **Card anatomy is consistent** (§3.1): gem top-left, art centre, name band bottom,
  card-back shared between Deck and event cards. One profile everywhere means Finding 1's
  fix propagates cheaply.
- **Token discipline**: every colour/size lives in `tokens.css` and components reference
  variables — every fix above is a token or single-component change, not a reskin.
- **Base contrast is excellent** where it counts most: ink on cream 15.4:1, body copy at
  the 20px `--font-size-md` token, panel titles at 24px bold.
- **Touch foundations**: `--button-height: 56px` and `--tap-min-size: 48px` tokens exist
  and buttons honour them (the phone fan exposure in Finding 3 is the exception, not
  the rule); key-hint number badges give teachers a verbal shortcut ("press 1").
- **No-punishment feedback language**: unaffordable cards grey out and spring back with a
  shake instead of error text — exactly right for this audience; it just needs the
  non-colour cues of Finding 5 to stay visible in bright rooms.
