# DEVIN TASK BRIEF — 《一起去买菜》 visual quality pass on the canonical source

You are the implementing engineer. Muse (the supervisor) has already
done the acceptance groundwork: a fresh baseline health check and a
review of the interrupted graphics WIP. Your job is the visual quality
pass described below, on the canonical source, verified with fresh
evidence. Work in this repository (the `canonical-source` branch is the
pristine Grok Bot export, baseline commit 05f0cdc "M4.5.9c", plus
Muse's verification docs). Do not deploy anything.

## Read first (precedence matters)
1. `AI_START_HERE` rules from the handoff package, summarised: current
   user decisions > `02-handoff-docs/` (PRODUCT_REQUIREMENTS /
   TECHNICAL_HANDOVER / STATUS_AND_NEXT_STEPS in the original package;
   key points are in §1 below) > the source's own docs. Historical
   passages in `docs/` (Chinese UI, portrait play) are SUPERSEDED:
   the UI is all-English, phone is landscape-only.
2. `docs/REQUIREMENTS.md`, `docs/ADAPTATION.md` (the 14 rules),
   `docs/DEVELOPMENT.md` (incl. §9.7), and the art spec
   `ART_3D.md` §8/§9/§10 (from the handoff's 03-reference-inputs; if it
   is not in this repo, ask the supervisor for it before starting §3).
3. `BASELINE.md` and `WIP_VERDICT.md` in this repo root — your starting
   evidence. The portfolio constraints document
   (PORTFOLIO_DESIGN_CONSTRAINTS) is background for a portfolio site;
   NEVER apply it to the game UI.

## 1. Fixed facts (do not re-decide)
- Stack: React 18 + TS + Vite 5, three 0.187 + @react-three/fiber 8.18
  + @react-three/drei 9.122. Do not change engines or frameworks.
- Game: 1 human + 3 bots, 8 stations, 3 laps, no dice (spinner is
  weather only), no ranking/score/elimination, money never negative,
  children never transfer money to each other. Engine in `src/game/`,
  data in `src/data/cards.json`, tunables in `src/config/gameConfig.ts`.
- `cards.json` contains **exactly 5 recipes** (tomato-egg,
  veggie-stirfry, potato-pork, tofu-soup, braised-fish). There is no
  carrot-egg recipe and there must not be one when you finish.
- UI copy is English (ww naming: Sprout/Steady/Zip/Tag; "Maybe later",
  "Buy (N coins)", "Dinner time", "Everyone has shared", "Play again").
  Phone acceptance viewport 874×402 landscape, safe-area insets
  62px sides / 20px top-bottom via env(). The 9b fixes (button text
  never overflows or splits mid-word, primary buttons inside the safe
  area) and 9c fixes (reflection: 4 cards in a 2×2 grid, then
  "Everyone has shared", then "Play again", nothing clipped) must not
  regress.
- Distribution is a static `dist/` served over HTTP. This codebase is
  NOT a file:// single-file build; do not force one.
- No Nintendo or other copyrighted assets. Models/textures already in
  the repo are CC0 (Kenney/KayKit, see THIRD_PARTY_NOTICES.md). Any new
  library/asset needs a permissive licence recorded in
  THIRD_PARTY_NOTICES.md.

## 2. Fresh baseline health (Muse, 2026-11-16 — your reference)
- `npm ci` OK (176 pkgs) · `npm run build` clean · `npm test` **85/85**.
- e2e on Muse's VM (SwiftShader, bundled Chromium instead of
  channel:'chrome'): 6/8 passed on a timeout-extended re-run. One
  failure is a software-rendering timeout (fullgame click stability).
  One is a **flagged suspected 9b regression**: safearea spec — at the
  Market, after selecting an item, the second in-column button's bottom
  edge is at y=424 vs the allowed ≤383 at 874×402 with insets. It may
  be a font-metrics artefact of that VM. **Your task T0 below.**
- Baseline screenshots: `shots/baseline_board_desktop.png`,
  `shots/baseline_board_phone.png`. Baseline visual defects (details in
  BASELINE.md): no post-processing/env at all; matte roughness-0.85
  materials instead of glossy plastic; pale mint palette; weak sun
  (1.15) and no contact grounding; fov 37; cone trees; flat pale water;
  phone framing crops the island.

## 3. The WIP is your starting point (verdict: adopt as base, fix, don't ship as-is)
The handoff package's `04-unaccepted-graphics-WIP/` (working-tree.patch
+ untracked Effects.tsx / Flora.tsx / public/env/spruit_sunrise_512.hdr)
was applied by Muse to a separate copy: build clean, tests 85/85,
screenshots in `shots/wip_board_*.png`. Per-component verdicts are in
WIP_VERDICT.md. Summary:
- ADOPT as-is: PLASTIC/MATTE material split + saturated palette
  (grass #63C74D), ball-cluster trees, warm sun 2.6 + tiered shadows,
  Flora (instanced decoration), desktop TiltShift whose focus band
  follows the human pawn, fov 27 long lens.
- ADOPT WITH FIXES: water gradient/foam/ripples, HDRI environment,
  Bloom, N8AO, tone-mapping saturation push — see T2 (the desktop
  frame is overexposed; fix in the prescribed order).
- OPEN WORK the WIP does not do: cheap lens effect for the phone tier;
  fit-solved whole-island framing; Flora density tuning.

## 4. Tasks (in this order; commit after each verified step)
- **T0 — Re-verify the flagged safe-area overflow.** Run the e2e
  safearea spec on real Chrome (channel:'chrome' as committed). If the
  Market panel button overflow (bottom 424 > 383) reproduces, fix it
  as a 9b regression (panel layout only; no copy/rule changes) and add
  the passing spec output to your evidence. If it does not reproduce,
  say so with the passing output.
- **T1 — Apply the WIP** to your working branch exactly as
  TECHNICAL_HANDOVER prescribes (patch + untracked files), `npm ci`,
  build, test. Reproduce Muse's WIP screenshots
  (`scripts/shot-m45_7.mjs` ships with the WIP) so your environment is
  calibrated against `shots/wip_board_*.png`.
- **T2 — Fix the desktop overexposure, in this order, re-shooting the
  desktop board after each step** (do not batch the changes — the
  supervisor needs to see which step fixes it):
  1. Water material per the TEARDOWN §10 glint fix: MeshStandardMaterial
     roughness ≈0.62, envMapIntensity ≈0.3 (keep gradient map, foam,
     ripples). Also lower envMapIntensity on matte ground/road
     materials if they still flare.
  2. Tone-mapping exposure: 1.05 → 1.0.
  3. Bloom: keep threshold 0.85 initially; if cream tiles still bleach,
     raise threshold toward 1.0 and/or drop intensity to ≈0.25.
  4. HueSaturation/BrightnessContrast push (+0.2/+0.1): reduce or drop
     if saturation still overshoots (materials are already saturated).
  Acceptance: cream tiles read cream (not white), tile colour dots and
  road bed keep their colour, contact shadows are visible under
  stations/pawns, trees stay glossy. No discrete white glint blob
  anywhere (check the water at the sun side specifically).
- **T3 — Grounding check for N8AO.** With T2 done, produce the AO
  on/off comparison (the WIP's `?fx=0` and AO-off shot variants) and
  confirm objects sit ON the ground on desktop. If AO is still
  invisible, tune aoRadius/intensity within the values ART_3D §10
  allows, or add the blob-shadow discs the baseline materials.ts
  already provides — one method, not both everywhere.
- **T4 — Phone-tier lens.** Add a low-cost tilt-shift (half-res, small
  kernel) or, if that misses the frame budget, a vignette + slight
  top/bottom blur approximation for the medium (phone) tier, behind
  the existing quality/degrade system (PerformanceMonitor decline and
  `?fx=0` must still disable it). The full HalfFloat desktop chain
  must NOT run on the phone tier.
- **T5 — Fit-solved framing.** Make the whole island fit the board
  area on BOTH viewports at the home view (ART_3D §8.1), solving
  camera distance from fov + aspect (the chess-reference technique:
  iterate/solve distance until island corners project inside the
  frame), while keeping: fov ≈27, the spinner push-in framing, and
  the follow behaviour. Phone home view must show the entire island
  inside the board area; desktop must not crop the island behind the
  DOM panels at start.
- **T6 — Flora density.** Raise Flora density/placement so there are
  no large blank grass areas (ART_3D §9.7: 3–6 decorations between
  neighbouring stations), keeping its instancing, seed and keep-outs.
- **T7 — Licence + chunk budget.** Confirm the spruit_sunrise HDRI
  provenance (Poly Haven CC0) and the postprocessing/n8ao licences
  are recorded in THIRD_PARTY_NOTICES.md. Keep the 3D chunk within
  the DEVELOPMENT §9.7 budget (Board3D gzip ≤ ~300 kB; Effects must
  stay a lazy chunk the phone tiers never download).

## 5. Hard constraints (a change that breaks one is a failed task)
- No changes to game rules, engine semantics, card data, prices, or
  the 5-recipe deck. `src/game/` and `src/data/` should be untouched
  except if T0 forces a panel-layout fix (UI layer only).
- English UI copy unchanged; 9b/9c behaviours (§1) intact.
- No outlines/ink edges (ART_3D §9.10). No ACES as the default tone
  mapping (Neutral is the decision; keep the `?tonemap=aces`
  comparison).
- frameloop="demand" performance model and the quality degrade path
  must keep working; 2D fallback untouched.
- Do not commit node_modules, dist, test-results, or any credential.
  No API keys exist in this project; keep it that way (the AI-parent
  station stays offline-scripted).

## 6. Verification you must run and report (fresh, not historical)
1. `npm ci && npm run build` — clean; report chunk sizes.
2. `npm test` — must be 85/85 (or more if you add tests; never fewer
   passing than baseline).
3. `npm run e2e` — on real Chrome; report per-spec results. The
   safearea result is T0's evidence; fullgame must pass on real
   hardware-class rendering.
4. Screenshots (use the WIP's `scripts/shot-m45_7.mjs` + Muse's
   `shots/shoot.mjs` conventions): board desktop 1280×800, board
   phone 874×402, market desktop+phone, spinner desktop+phone —
   saved as `shots/final_<name>.png`, plus the T3 AO comparison pair.
5. Phone performance: report a frame-rate measurement at 874×402 with
   your method stated (PerformanceMonitor tier reached is acceptable
   evidence; a bare "feels smooth" is not). Target ≥30 fps sustained
   on the medium tier.
6. A `CHANGELOG_VISUAL.md`: every change, why, which ART_3D §9 item /
   verdict item it answers, and its evidence screenshot.

## 7. Deliverable
The working branch with per-task commits, `dist/` built from the
final tree, `CHANGELOG_VISUAL.md`, and the §6 evidence. The
supervisor (Muse) will re-run build/test/e2e and compare
screenshots against BASELINE.md and WIP_VERDICT.md before anything
is shown to the user or published. Publishing (GitHub Pages) happens
only after design acceptance (ww) and playtest (马教授) — not your
call, not part of this brief.
