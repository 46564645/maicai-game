# DEVIN BRIEF — R10 Slice A: card primitives + recipe draw + market play

You are the implementing engineer; the PM (Muse) accepts your work afterwards. Repo: ~/workspace/maicai-work, branch canonical-source (HEAD e5a574b, 133 tests green). READ FIRST: AGENTS.md, R10_DESIGN.md (§2 interaction model, §3 visual system, §4 motion spec, §5 Slice A), PARENT_API_R7.md skim. R10_DESIGN.md is the spec — where this brief and the design disagree, the design wins and you flag it in your report.

## Goal
The game's interaction becomes card-based, Hearthstone-style in FORM only. Slice A delivers the reusable card primitives and wires the first two stations: recipe draw ritual + market hand-of-cards with drag-to-play.

## Build (per R10_DESIGN §5 Slice A)
New, under src/components/cards/:
- Hand.tsx — BounceCards adapted: fan layout, bounce-in, hovered/focused card straightens + raises + neighbours yield; renders ReactNode card faces; full keyboard reachability.
- TiltCard.tsx — TiltedCard trimmed: pointer tilt + glare; doubles as the flip engine (rotateY reveal); optional foil layer flag (CSS foil, §3.3 of design).
- useDragPlay.ts — in-house drag layer (Pointer Events + setPointerCapture, drop-zone registry + rect hit-testing, Magnet-style snap within threshold, spring-back on invalid drop). Touch-first; tap-tap selection must work as a complete alternative path.
- PlayableGlow.tsx + cards.css — BorderGlow adapted, colours from tokens only; all card state classes from design §3.2 (playable / unaffordable / selected / just-played), card back, cost gem.
- CoinCounter.tsx — Counter trimmed: integer 0–99 rolling digits + aria-live text.
- Deck.tsx — in-house light deck: 3 stacked card backs, top card flips out (compose TiltCard).

Modify:
- src/components/CardView.tsx — rebuild face per design §3.1 anatomy (frame, art window, name banner, cost gem); PROPS UNCHANGED. Art window: if a cardArt entry exists for the card id, render the illustration; otherwise keep the existing emoji art.
- NEW src/components/cards/cardArt.ts — art map keyed by card id → imported image URL, emoji fallback handled by CardView. Copy these PM-generated files into src/assets/cards/ and register them: art-r10/media-generation-ingredient-tomato-v3-0-125b5917-2705-4296-b02f-91f86aef0380.webp (ingredient: tomato), art-r10/media-generation-dish-tomato-egg-v3-0-6230a1ef-cad9-414c-bac3-c66b051b70ea.webp (recipe: tomato & egg dish), art-r10/media-generation-card-back-v3-0-7fa42fe4-cd6f-4829-8ae7-1a952dbe1ccb.webp (deck card back — Deck.tsx uses it). More art arrives from PM later; leave the map easy to extend, one line per card. Find the exact card ids in src/data/cards.json / cardText.ts (read-only — do not modify data files).
- src/components/DrawTaskPanel.tsx — Deck draw ritual: tap deck → top card flips → recipe lands as the pinned quest card.
- src/components/MarketPanel.tsx — ingredients become the fan Hand; two drop zones (basket / set-aside); drag OR tap-tap completes any purchase; existing commands only.
- src/screens/Game.tsx — bottom bar hosts the Hand where the design specifies; coin total uses CoinCounter.
- src/theme/tokens.css — ADDITIONS ONLY (card sizes, glow colours, fan angles).
- THIRD_PARTY_NOTICES.md — register BounceCards / TiltedCard / BorderGlow / Magnet / Counter: "React Bits by David Haz — MIT + Commons Clause", with the component names and what was adapted.

## Red lines
- git diff on src/game and src/data must be EMPTY at the end. Engine, rules, cards.json, the 14 ADAPTATION rules: untouched. Only existing engine commands.
- No Blizzard/Hearthstone art, fonts, sounds or textures — form only. Palette stays the project tokens.
- Transform/opacity animations only; no WebGL, no new animation runtime (no motion/gsap). No new dependencies at all.
- Never read, print, move or commit .env.local. No live API calls anywhere (tests mock fetch, as before).
- Touch targets ≥48px; every drag action has a tap-tap equivalent; prefers-reduced-motion fallback per design §4.

## Acceptance (self-check before you finish, report each)
1. npm run build clean; npm test all green (133 baseline + your new tests for useDragPlay hit-testing/spring-back and cardArt fallback).
2. Feel four: hover straighten+raise, drag follow, snap on target, spring-back on invalid — desktop + touch emulation.
3. Tap-tap buys any market card end-to-end; keyboard-only completes one purchase.
4. Screenshots in shots/ with r10a prefix: recipe draw (mid-flip + landed), market (fan + glow + selected state) × 1280×800 and 874×402 (phone contexts need hasTouch/isMobile, as in shots/r9-shots.mjs).
5. R8 fit metrics re-run: fill 0.658–0.660, cover 0.0%, 1024×768 bottom bar no new wrapping.
6. Append an "R10 Slice A" section to R10_DESIGN.md recording what was built, deviations, and the component-credit lines.

## Finish
Commit LOCALLY on canonical-source with a clear R10A message. Do NOT push, do NOT rebuild any play zip (PM packages). Report: commit sha, test counts, screenshot paths, deviations.
