# CHANGELOG_VISUAL — 3D visual quality pass on the canonical source

Date: 2026-11-16. Executor: Muse (local, per user instruction — no Devin
session, no push). Base: canonical M4.5.9c (05f0cdc) on branch
`canonical-source`. Starting evidence: `BASELINE.md`, `WIP_VERDICT.md`,
task list `DEVIN_TASK_BRIEF.md` (T0–T7). Reference technique notes:
`~/workspace/maicai-rebuild/research/TEARDOWN.md` §10 (water glint fix).

Environment honesty note: this VM has **no GPU** — all browser evidence is
Playwright bundled Chromium + SwiftShader software WebGL on 1.5 shared
CPUs. Screenshot composition/colour/framing evidence is valid; frame-rate
and e2e timing evidence is **not** representative of real devices and is
labelled as such wherever it appears.

---

## T0 — Safe-area overflow (874×402): root cause found (entrance-animation transform), fixed; spec now passes

- Baseline evidence (BASELINE.md addendum): after selecting a card at
  the Market, "Done with this stop" sat at **y=424 vs ≤383 allowed**,
  persistently for the spec's 4 s retry window.
- Diagnosis this pass (three spec runs + an instrumented probe that
  replicates the spec's own drive path — seed 1, natural play, real
  Playwright clicks — and dumps rail geometry):
  - The probe reproduced the failure deterministically (Done bottom
    391.6) and showed the rail **was** pinned (scrollTop = maxScroll).
    The popup and its backdrop were equal height (686 px) but the popup
    was displaced **+23.6 px** downward by a live CSS transform:
    `matrix(1,0,0,1,0,23.62)` — the `popup-rise` entrance animation
    (hud.css, `from { transform: translateY(26px) }`, 0.3 s) still in
    flight. Sampling showed the transform does finish (~0.5 s later in
    probe conditions; Done then sits at its layout position), but under
    this VM's SwiftShader frame starvation the 0.3 s animation can
    stretch across the spec's whole 4 s assertion window; on a slow
    real device the same transient applies. In the spec's inset model
    (--safe-b 20) the resting position is y=364, so the +26 px rise
    alone explains the y=390 failures; the baseline y=424 additionally
    involved a scroll shortfall of the same family as below.
  - Root cause: an entrance animation designed for a *floating* dialog
    was also applied to the in-flow rail panel, where a 26 px downward
    displacement directly consumes the 20 px safe-area margin.
- Fixes (UI layer / CSS only, no copy/rule changes):
  1. **phone.css: `.phone-rail .popup { animation: none; }`** — no
     entrance transform inside the rail; the desktop floating dialog
     keeps its rise animation.
  2. Secondary hardening (Game.tsx): the rail's Resize/MutationObserver
     recovery now re-pins when the rail was within 160 px of the bottom
     before a content growth (tracked via `lastScrollHeight`), covering
     the stick-to-bottom latch race (onScroll can latch `stickBottom`
     off when content grows between setting scrollTop and the scroll
     event, and pre-click scroll-into-view can leave the rail tens of
     px short). Deliberate scroll-up to the cards (≥150–200 px away)
     is not yanked back.
- **Result: `tests/e2e/safearea.spec.ts` PASSES on the final tree**
  (2.7 min, full game, every primary button inside the safe area) —
  the first full pass of this spec on this VM. Supporting visual:
  `shots/final_market_phone.png` (Buy / Maybe later / Skip / Done all
  inside the rail).

## T1 — WIP adopted as the base (exactly per TECHNICAL_HANDOVER)

- Copied the WIP file set from the evaluated copy into the working tree:
  `package.json`/`package-lock.json` (+@react-three/postprocessing
  2.19.1, postprocessing 6.39.6, n8ao 1.10.3), `docs/DEVELOPMENT.md`
  (§9.7), `AGENTS.md` (M4.5.7 pointer line), the 12 changed
  `src/board/three/*` files, new `Effects.tsx` + `Flora.tsx`,
  `public/env/spruit_sunrise_512.hdr`, `scripts/shot-m45_7.mjs`.
- Deliberately NOT copied: `playwright.config.ts` (keeps this VM's
  documented bundled-Chromium adjustment; the WIP copy's `channel:
  'chrome'` cannot run here), the WIP's historical `docs/screenshots/
  m45_7_*` images, and its `scripts/dbg-m457*.mjs` debug leftovers.
- Verification at adoption: `npm ci` OK, build clean, unit **85/85**,
  Board3D chunk 1,034 kB (gzip 282 kB), Effects a separate lazy chunk.
- Calibration: fresh `shots/step0_wip_board_*.png` match the supervisor's
  WIP screenshots almost exactly (whole-frame near-white 32.00% vs
  31.96%; phone blown-white identical 11.67%) — environment calibrated.

## T2 — Desktop overexposure fixed (prescribed order, re-shot each step)

Metric: island bottom band of the 1280×800 board shot (below the DOM
bottom bar): % near-white (≥245,242,232) / % blown (≥250,248,240).

| Step | Change | near-white | blown |
|---|---|---|---|
| 0 | WIP as adopted | 14.0% | 7.0% |
| 1 | Water → roughness 0.62, envMapIntensity 0.3 (TEARDOWN §10) | 14.1% | 7.0% |
| 2 | Tone-mapping exposure 1.05 → 1.0 | 13.7% | 6.3% |
| 3 | Bloom threshold 0.85 → 1.0, intensity 0.3 → 0.25 | 13.7% | 6.2% |
| 4 | Drop HueSaturation +0.2 / BrightnessContrast +0.1 push | **4.0%** | **1.9%** |

- Step 1 note: no measurable change and no discrete water glint blob
  before or after — in this frame the blowout was not water-driven; the
  §10 material profile is kept as prescribed (it removes the glint risk
  class). Evidence: `shots/step1_water_board_desktop.png`.
- Steps 2–3 were minor. **Step 4 was the main driver**: the +0.1 contrast
  push was crushing the near-white cream tiles (#FFF1D6/#FFFDF6 under a
  2.6 sun + HDRI) into clipped white. The push is removed
  (`HueSaturation` kept at 0 as a comparison placeholder; materials are
  already at the ART_3D §9.4 saturation targets).
- Acceptance read of `shots/step4_sat_board_desktop.png` /
  `shots/final_board_desktop.png`: cream tiles read cream, road bed
  keeps its warm tan, station colour dots keep their colour, trees stay
  glossy, contact shadowing visible, no white glint blob on the water.

## T3 — N8AO grounding: judged with an AO on/off pair — PASS, keep as-is

- Added a `?ao=0` URL override in QualityProvider (same pattern as the
  existing `?fx=0` / `?env=0`) so the pair differs *only* in N8AO.
- Pair: `shots/t3_ao_on_board_desktop.png` vs
  `shots/t3_ao_off_board_desktop.png` (everything else identical).
- Measured: 21.3% of island-band pixels change (>6 luminance), 24.0% of
  samples are darker with AO on; visually the contact darkening under
  tiles, props and tree/stone bases is present and objects sit ON the
  ground. AO is subtle but real — the earlier invisibility was the
  overexposure, as the verdict suspected.
- Decision: N8AO stays the single grounding method (aoRadius 0.5,
  distanceFalloff 1, intensity 2.5, quality "low"), together with the
  tiered directional shadows. No blob-shadow discs added on desktop
  (brief: one method, not both).

## T4 — Phone-tier lens: cheap CSS approximation behind the quality system

- The full HalfFloat desktop chain still never runs on phone. Instead,
  medium tier gets a zero-WebGL-cost approximation in the DOM layer:
  `PhoneLens` (Board3D.tsx) renders two gradient-masked
  `backdrop-filter: blur(3px)` bands (top/bottom 24%) + an inset
  vignette over the canvas (board.css `.board3d-lens*`).
- Gating: new `flags.lens` — medium=true, high=false (real TiltShift),
  low=false; `?fx=0` disables it; PerformanceMonitor decline
  (medium→low) removes it. No new JS chunk is downloaded for it.
- Evidence: `shots/final_board_phone.png` — frame edges are softly
  blurred/darkened, centre band (island) stays crisp.

## T5 — Fit-solved framing on both viewports

- Replaced CameraRig's empirical fit multiplier (and the compact 0.8
  close-up factor, which *guaranteed* phone cropping) with a solver:
  project the island bounding box (rim extent ±8.55×±6.65, height 1.7)
  into NDC for the default target **and every follow goal**, binary-search
  the smallest camera distance along the default view direction that
  keeps all corners inside a DOM-aware inner rectangle
  (desktop {l/r 10%, t 6%, b 10%}; phone {l/r 4%, t 16%, b 14%}).
  fov stays 27; spinner push-in distance scales by the same ratio;
  OrbitControls `maxDistance` follows the solved distance.
- Calibration data (offline solve): desktop strict insets → 47.5 (too
  far, and inside the fog start — first final shot came back h
...[truncated 4477 chars]azy
  and small), relaxed desktop insets → ≈39.9; phone strict → ≈52
  (verified good by screenshot).
- Companion fix: scene fog moved 40–90 → **60–120** so the solved
  distances no longer sit inside the fog ramp (the first final desktop
  frame was fog-washed).
- Evidence: `shots/final_board_phone.png` — the **whole island is in
  frame** in the board area, all 8 stops readable, spinner centred.
  `shots/final_board_desktop.png` — whole island between the bot
  columns, bottom station row fully visible. Standing caveat (all
  versions incl. baseline): the centred DOM turn panel overlays the
  island's top-centre on desktop; the island outline is not cropped by
  the frame or the side columns.

## T6 — Flora density pass

- `Flora.tsx` scatter: candidate pool per station gap roughly doubled
  (attempts 3–6 → 7–14), scatter band widened (distance 1.05–1.60 →
  0.95–1.75 from the road centreline), kept items capped at the ART_3D
  §9.7 maximum of **6 per gap** after keep-out filtering (was: density
  applied to the raw ≤6 candidates, so filtering losses thinned most
  gaps to 1–3 items). Seed, mulberry32 RNG, instancing and all keep-outs
  (spinner r<2.9, station tiles, prop anchors, rim trees) unchanged.
- Evidence: final board shots — grass between stations now carries
  flowers/bushes/stones throughout, no large blank stretches.

## T7 — Licences + bundle budget

- `THIRD_PARTY_NOTICES.md` gained a §四之二 registering the four M4.5.7
  additions, checked against the installed packages on 2026-11-16:
  - **postprocessing 6.39.6 — Zlib**, © 2015 Raoul van Rüschen (full
    text quoted).
  - **@react-three/postprocessing 2.19.1 — MIT**, © 2020 react-spring.
  - **n8ao 1.10.3** — shipped `LICENSE` file and README say **CC0 1.0**;
    its `package.json` metadata says ISC. Both facts recorded (ART_3D
    §10's "MIT" note is not what the package ships).
  - **Spruit Sunrise HDRI (Poly Haven) — CC0**, `public/env/
    spruit_sunrise_512.hdr` (ffmpeg-downscaled from the 1k original).
- Final build chunk report: Board3D **1,035 kB (gzip 282.8 kB)** — within
  the ≈300 kB gzip budget; Effects stays a separate lazy chunk
  (242.7 kB, gzip 104.4 kB) loaded only when the post chain mounts
  (high tier); phone tiers never download it. Main chunk 256 kB
  (gzip 78.5 kB), CSS 47.9 kB (gzip 7.6 kB).

## Verification summary

- `npm run build`: clean (tsc + vite).
- `npm test`: **85/85** (10 files), same as baseline and WIP.
- `npm run e2e` full suite on the final tree (this VM, SwiftShader,
  240 s timeouts): **3 passed / 5 failed in 9.2 min**. The 5 failures:
  safearea (geometry — the T0 defect, see above), board3d (hung inside
  `page.screenshot` compositing), fullgame / keyboard / mobile (click /
  tap / timer actionability timeouts at 180–240 s). All but safearea
  are the same environment-timeout class as the baseline run (baseline:
  fullgame + safearea failed; keyboard/mobile/board3d passed — the
  pass/fail split of the timeout-class specs varies run to run under
  software rendering). After the T0 fix, **safearea re-run individually:
  PASS (2.7 min)**. A clean full-suite green run still requires a GPU
  machine (supervisor's Chrome), as already recorded in BASELINE.md.
- FPS: rAF probe inside the screenshot harness at 874×402 medium tier
  measured **≈3–7 fps under SwiftShader** across runs — a software-
  rendering artefact of this VM, **not** a device measurement. The
  ≥30 fps phone target can only be proven on real hardware or the
  supervisor's Chrome machine; the cost profile is unchanged from the
  WIP (same tier flags: dpr ≤2, 1024 shadows, no post chain on phone;
  the T4 lens is DOM compositing, not WebGL).
- Untouched, verified by git diff: `src/game/`, `src/data/cards.json`
  (5 dishes; 6 deck entries incl. the duplicate Tomato & Egg card
  `rec-tomato-egg-2`; no carrot-egg), ADAPTATION rules, English UI copy,
  9b/9c UI fixes.

## Left open (not this pass)

- Real-hardware FPS + full e2e on a GPU machine (supervisor's Chrome).
- ww acceptance of the adopted WIP look (incl. the T2 step-4 removal of
  the saturation/contrast push) and 马教授 playtest — unchanged gates.
- GitHub upload remains deferred by the user (2026-11-16 19:26); all
  stage commits are local on `canonical-source`. Nothing was pushed.
