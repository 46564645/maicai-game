# DEVIN R5 BRIEF — Art refinement + UI beautification (direction)

You are the implementing engineer ("staff") on 《一起去买菜》 (Let's Go Grocery Shopping), a 3D board game that teaches money values to children in grades 1–3. Your PM (Muse) wrote this brief, will check your progress periodically, and will acceptance-test your work against `ACCEPTANCE_R5.md` in this repo — item by item. Expect correction rounds; that is the process, not a failure.

## Setup

- Repo: https://github.com/46564645/maicai-game — work from branch `canonical-source`.
- Create your own branch `devin/r5-art` from `canonical-source`. Open a PR against `canonical-source` when done. Do NOT merge it. Do NOT touch `gh-pages`. Do NOT deploy.
- Model: SWE-2 at High or Max reasoning effort.
- Read first: `AI_START_HERE.md`, `02-handoff-docs/` (precedence rules), `CHANGELOG_VISUAL.md` (the accepted visual state), `UI_ITERATION.md` (UI rounds R1–R4 and the measurement harness `shots/measure-ui.mjs`), and `ACCEPTANCE_R5.md` (your acceptance contract).

## Part 1 — Scene / art targets (hard metrics)

1. **Sea fills the whole screen.** Today the water is a circular/oval disc around the island with background past its edge. The water must extend to the viewport edges at the default framing on desktop (1280×800) and phone landscape (874×402). Keep the foam shoreline ring around the island.
2. **Island occupies 60–70% of the default view.** Metric (pinned by PM): fill = the island's projected bounding-box area ÷ the free visible band between UI panels, at the default framing. Target 0.60–0.70 on both viewports. Hard limits: the WHOLE island stays in frame, and UI panels cover 0% of the island on desktop (the R4 result — panels may overlap water, never the island).
3. **Sea decorations.** A few low-poly toy-style boats on the outer water (a buoy or two is welcome if cheap). Procedural geometry in the existing style; no new asset files. Static is fine; bobbing only if free. Never occluding the island or its stops at the default framing.
4. **Art polish** (highest-impact subset, one idea at a time, screenshot-judged, revert non-improvements): modelling detail (bevels/rounded geometry; dressing — awnings, crates, signs, fences, flowers; tree variation), procedural surface variation on grass/road (toy look, no photorealism), soft water-to-sky transition at the horizon, warm consistent grading, softer shadows.

## Part 2 — UI beautification (DIRECTION ONLY — you design)

The PM deliberately gives direction, not a concrete design. The UI **flow, layout structure and English copy stay exactly as they are** (R1–R4 outcomes in `UI_ITERATION.md` are locked). Your job is visual quality within that structure.

Direction:
- The product is a **toy**: a physical, tactile plaything for 6–8-year-olds, matching the 3D diorama's toy look — the 2D UI should feel made of the same material as the 3D world (soft, chunky, warm), not like a web dashboard pasted over it.
- **One hero per screen.** Every screen state has exactly one obvious primary action; everything else recedes. Hierarchy is carried by size, weight and colour discipline, not by adding boxes.
- **Design tokens first.** Before styling, define a compact token system (a small named palette of 4–6 colours with roles, a type scale with roles, corner radii, shadow/depth rules) in a short `UI_TOKENS.md`, then implement it in `src/theme/tokens.css` — the project's single source of visual tokens (CSS variables only; components reference variables, per the project's standing convention) — and apply it consistently. If a choice reads as a generic SaaS/default look, revise it.
- **Depth with restraint.** Soft layered shadows and gentle gradients for tactility; spend boldness in ONE place per screen and keep the rest quiet. No scattered effects, no glassmorphism, no neon.
- **Type carries personality.** A rounded, chunky, highly legible type treatment for young readers; numbers (money!) must be instantly readable at a glance.
- **Self-critique.** Screenshot every screen you touch (board, market, and the main panels) before/after, look at them critically against this direction, and iterate at least once on what you see.

## Guardrails — do not regress

- Visual changes only. Do NOT modify: game engine logic; `src/data/cards.json` (exactly 5 recipes — an older doc says ≥6; the owner's decision is 5 and wins); the 14 game rules; any English UI copy; the R1–R4 layout outcomes (desktop prompt bar + HUD docked at the bottom as one stack; phone rail width; safe-area behaviour).
- Exposure: the accepted T2 state (near-white pixels ≈4%, blown highlights ≈1.9%) is the target. ART_3D §9.4's saturation/contrast push and §9.6's Bloom threshold 0.85 were **superseded by the accepted T2 fix** — do NOT re-apply them (see ACCEPTANCE_R5.md conflicts C-1/C-2).
- The T0 fix stays: `.phone-rail.popup { animation: none }`.
- Phone tier: no heavy WebGL post chain (no new EffectComposer passes on the compact tier).
- Board3D JS gzip ≤ ~300 kB (currently ~283 kB).
- UI is English, landscape-first (handoff overrides beat the older in-tree Chinese/portrait text — see ACCEPTANCE_R5.md section H).

## Verification and deliverables (your PR must include)

- `npm run build` clean; unit tests 85/85 (`npm test`).
- Playwright e2e: run it; report honestly what passed/failed (headless software-rendering timeouts are a known artefact — report, don't hide).
- Before/after screenshots (board + market, desktop 1280×800 and phone 874×402) under `shots/`, named `art_<screen>_<viewport>_before/after.png` and `ui_<screen>_<viewport>_before/after.png`.
- `UI_TOKENS.md` (Part 2 token system) and `ART_R5.md`: per-target changes, island fill % before/after per viewport with the pinned metric, panel-cover measurement, exposure metrics, bundle size, test results.
- Go through `ACCEPTANCE_R5.md` and mark every item you believe passes; flag any item you could not meet and why.
