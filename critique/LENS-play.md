# LENS: Toy / Play Design — MDA critique of 《一起去买菜》

> Lens: play-design theory + MDA (Hunicke/LeBlanc/Zubek), run **in reverse**.
> Method: name the feelings this toy *must* produce for its audience, then check whether the
> mechanics (fixed) and the presentation (in scope) actually generate them.
> Evidence: `R10_DESIGN.md`, `docs/ADAPTATION.md`, `src/data/cards.json`, `src/game/` skim,
> `shots/r10a_*` / `shots/r10b_*`, `src/config/gameConfig.ts`, `src/game/bots.ts`.

## The target aesthetics (what this toy is *for*)

For left-behind children aged 6–12, the toy is a rehearsal space for three feelings that
real life rarely gives them:

1. **Expression** — "I can say what I want" (pain point 3: expressing needs is costly for them)
2. **Agency / Fantasy** — "I decide about money; I am the one who shops and cooks for the family"
   (pain points 1–2: parents are far away; money decisions are made by grandparents/caregivers)
3. **Fellowship** — "I play *with* others at one table" (the classroom form is 4 children together)

Supporting aesthetics: **Discovery** (facedown cards, weather wheel), **Sensation** (tactile
cards, flips, coins), **Narrative** (a shopping trip that becomes dinner). **Challenge** is
deliberately muted — no ranking, no bankruptcy (ADAPTATION #4/#6) — so tension must come
from *choice weight*, not from threat of failure.

Verdict up front: the **mechanics** encode the intended feelings remarkably well (see
"Already good"). The losses are almost all in the **presentation layer**: the moments where
a feeling should land — the reveal, the performance of playmates, the finished dish — are
rendered as small widgets inside large empty dialogs, so the toy reads as a *form* at
exactly the moments it should feel like a *toy*.

---

## Finding 1 — The surprise reveal is spoiled before the flip, and the revealed story is illegible

**(a) Gap + evidence.** Discovery is the event station's whole job, but the reveal is
undercut twice. (i) In `shots/r10b_event_facedown_zh_desktop.png`, while the event card is
still face-down, the top toast already announces the result in text:
"Sprout转到Sunny：「An extra egg」" — the child who can read learns the surprise before
touching the deck; the flip becomes a formality. (ii) After the flip
(`shots/r10b_event_revealed_zh_desktop.png`), the event's story text ("The sun is going
down. The seller gives you one extra egg.") is nowhere legible in the panel — only a
truncated card name （多送一…) shows — and the two option cards overlap each other with
labels cut off ("收下双…" is truncated mid-phrase; only "花1币" reads fully). The narrative
payload of the event — the tiny story that makes it a *moment* rather than a transaction —
never lands.

**(b) Why it matters for this audience.** Surprise is one of the few pleasures in the toy
that is entirely the child's own — nobody decides it for them. And for children with high
communication cost, the card's picture + story *is* the communication: if the story is
truncated, the meaning of what just happened to them (and why they're being asked to
choose) is lost, and the spend/free choice that follows becomes a coin flip instead of a
decision.

**(c) Presentation-layer fix.** (1) Toast/log lines for the event station must not name the
event before the flip completes — toast the weather only ("转到了晴天！"), and let the log
entry appear with the reveal. (2) Revealed state: one large event card (illustration +
full story in large type) centered, with the two option cards below it, fully readable,
non-overlapping, each carrying a consequence icon (what you get / what it costs). No engine
or data change — Toast timing/filtering + EventPanel layout only.

**(d) Severity: High.**

## Finding 2 — The finished dish — the emotional climax of the whole loop — is an empty dialog with an OK button

**(a) Gap + evidence.** Everything the child does for three laps converges on one
transformation: *my purchases became dinner*. What shipped for the cook station
(`shots/r10b_cook_zh_desktop.png`) is a mostly-empty white modal: the basket chips on top,
one tiny ingredient card floating in the middle, a text counter "进度 1/4", and a giant
orange "好的" button. There is no pan, no plate, no transformation — the ingredient never
visibly *becomes* the dish (the recipe illustrations already exist as card art). The design
doc (§2.8) promised ingredients flying into a pan and a foil-stamped finished dish; the
Feast screen partially delivers (plate cards, foil on full plates), but the cook moment
itself — the first time the child sees their dish exist — reads as a checklist confirmation.

**(b) Why it matters for this audience.** This is the payoff of pain point 2: the child who
in real life only *receives* food and decisions gets to be the provider — "I cooked dinner
for everyone." Competence fantasies live or die at the transformation moment. If the dish
materialises as a progress counter and an OK button, the toy's central emotional
transaction ("my choices matter — look what they made") is spent on the weakest screen in
the game.

**(c) Presentation-layer fix.** Build the assembly scene inside the existing panel: a big
pan/plate target in the centre; each tapped ingredient card flies in, lands, and *morphs*
(scale + swap to the recipe's dish illustration, steam puff / PlaySpark) so the dish
visibly comes into being ingredient by ingredient; the completed dish card then gets the
foil stamp and a beat of stillness before the confirm button appears. All driven by the
existing cook state/ACK flow — CookPanel presentation only.

**(d) Severity: High.**

## Finding 3 — The parent station opens like an exam form, and the parent is nobody

**(a) Gap + evidence.** This station is the toy's one rehearsal of "saying what I need" —
and ADAPTATION #8 states explicitly it is *not* an exam. But the entry screen
(`shots/r10b_parent_fan_zh_desktop.png`) leads with two bare buttons （现在用 / 这次先不用）
and a line of small grey text that spells out the marking scheme in advance:
"说清多少、做什么 → 得 1 币；再说清花到哪、下次怎么做 → 得 2 币". The parent themselves is a
single anonymous speech bubble ("需要更多币的时候，我可以帮忙。") — no face, no name, no
presence, despite a dedicated parent colour token (AI 家长紫） existing in the palette.
Framing the conversation as a pre-announced rubric converts an act of expression into a
test with visible marks.

**(b) Why it matters for this audience.** Pain point 3 is the brief: these children find
it hard to state their needs, and pain point 1 is that the person they'd state them to is
far away. The station should feel like *talking to mum/dad who is listening*, where being
understood is the reward and coins arrive as the parent's warm response. A rubric-first
frame raises the cost of "saying it wrong" for exactly the children who already fear that
cost — the opposite dynamic of the one the toy exists to create.

**(c) Presentation-layer fix.** Conversation first, accounting after: give the parent a
persistent warm presence in the panel (portrait/avatar in the parent purple, a name, the
question asked in their speech bubble); the child answers with the picture-card fan
(already built); move the 1-coin/2-coin explanation out of the entry view entirely — let
the settle moment carry it as praise after the fact ("你说清楚了！" + the existing
approveLine), i.e. feedback, not a pre-announced test. ParentPanel layout/copy placement
only; `parent.ts` flow untouched.

**(d) Severity: High.**

## Finding 4 — The playmates don't perform: three real personalities are reduced to toast text

**(a) Gap + evidence.** The bot *mechanics* are genuinely characterful — `bots.ts` strategy
tables make Zip （冲动型） buy temptations at 0.8 tendency, Steady almost never, and Tag
（跟风型） copy peers (when another player owns a temptation, Tag's temptation tendency
jumps to 0.9 — a real "me too!" dynamic). But in play, a bot's turn surfaces only as a
one-line toast ("Tag买了Egg", "Tag把菜放进了盘子") plus silently changing numbers in a
corner nameplate. A 6-year-old who doesn't read the toast sees *nothing happen*. Worst
loss: when Tag copies **the human child's** purchase, that social feedback — "my choice
influenced my friend" — is completely invisible.

**(b) Why it matters for this audience.** Fellowship is a named target aesthetic: in class,
four children play together, and this demo's bots stand in for those companions (and, for
children whose parents are absent, for the feeling of being at a table with others who
notice what you do). Playmates who act invisibly teach the child that their choices have
no social echo — the exact opposite of "my choices matter."

**(c) Presentation-layer fix.** Give each bot turn a performed beat on the existing
bot-action timing: the acting bot's portrait/pawn pops with a speech bubble, and their
bought card visibly flies to their corner basket (the state already changes — just stage
it). Tag copying the human gets a distinct bubble ("我也买！") + a small heart/spark.
Keep the toast as the written log; add the show. UI staging only — `bots.ts` untouched.

**(d) Severity: Medium-High.**

## Finding 5 — The hand fan is too compressed to fondle: cards hide each other's names

**(a) Gap + evidence.** The fan is the toy's core tactile verb — *browse what you could
choose* — but in `shots/r10a_market_fan_zh_desktop.png` six cards are squeezed into roughly
40% of the modal's width: only the selected card's name is fully readable （胡萝卜 is cut
mid-name; the two ginger cards are indistinguishable at a glance), while the rest of the
large modal sits empty. R10_DESIGN §6 predicted this risk, and the Slice A acceptance note
already concedes "面板内扇形展开幅度偏紧". Cards you cannot spread out don't feel like cards;
they feel like a carousel.

**(b) Why it matters for this audience.** Comparing all six options at a glance *is* the
money-decision rehearsal (pain point 2). If only one card is readable at a time, choosing
degenerates into tapping the one card you can read — the decision (and the lesson) evapor
...[truncated 5836 chars]