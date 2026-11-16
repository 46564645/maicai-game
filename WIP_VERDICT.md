# WIP VERDICT — 04-unaccepted-graphics-WIP evaluated on a separate copy

Date: 2026-11-16. WIP applied exactly per TECHNICAL_HANDOVER to a second
copy (`~/workspace/maicai-work-wip/`): `git apply working-tree.patch`
(applied cleanly, no rejects) + untracked files copied in
(`src/board/three/Effects.tsx`, `Flora.tsx`, `public/env/spruit_sunrise_512.hdr`,
shot scripts, screenshots). The pristine export and the Phase A baseline
copy were not touched.

## Health of the WIP copy (fresh)
- `npm ci` — OK, 180 packages (adds @react-three/postprocessing 2.19.x,
  postprocessing 6.39.x, n8ao 1.10.x).
- `npm run build` — clean. Board3D chunk 1,034 kB (gzip 282 kB);
  Effects is a separate lazy chunk (desktop/high tier only).
- `npm test` — **85/85 passed** (the patch touches no game logic).
- e2e — not re-run on the WIP copy: the suite's failures on this VM are
  already documented as environment timeouts (see BASELINE.md), and the
  WIP changes no DOM/UI code paths the e2e drives. This is a gap to close
  on a real-Chrome machine before release.
- Fresh screenshots: `shots/wip_board_desktop.png`,
  `shots/wip_board_phone.png` (same driver/viewports/settle time as the
  baseline shots). FPS probes under SwiftShader (~3–6 fps) are software-
  rendering artefacts and say nothing about device performance.

## What the WIP visibly fixes (vs baseline shots)
- **Colour**: grass is now the saturated bright green ART_3D §9.4 asks
  for (#63C74D); baseline's pale mint is gone on both viewports.
- **Trees**: cone stacks replaced by glossy ball-cluster trees (§9.8).
- **Water**: radial gradient shallow→deep + foam ring + ripples (§9.9),
  replacing the flat pale disc; phone shot's water reads properly blue.
- **Lens**: fov 37 → 27 with the camera pulled back ([0,21,18]) — the
  §9.2 long-lens direction; desktop frame edges show the tilt-shift melt.
- **Light**: sun 1.15 → 2.6 warm, per-tier shadow map sizes (§9.5 range).

## What it breaks or leaves broken
1. **Desktop overexposure (the big one).** On the desktop shot the road
   bed, cream tiles and centre plaza are blown out to near-white/yellow;
   tile colours bleach, contact shadow is washed away, the scene reads
   "hot" rather than glossy-toy. Causes stack up: exposure 1.05 + Bloom
   (threshold 0.85) + HueSaturation +0.2 / Contrast +0.1 + HDRI env on
   light matte materials. This is a cousin of the TEARDOWN §10 HDR-glint
   problem — no single travelling white blob (the rebuild's failure
   mode), but broad HDR highlight spread through Bloom/TiltShift before
   tone mapping. The phone shot (no post chain) is visibly *better
   balanced* than the desktop shot, which indicts the post/exposure
   stack, not the materials.
2. **Water glint risk (TEARDOWN §10 checklist)**: WIP water is
   MeshStandardMaterial roughness 0.4, envMapIntensity 0.6 with an HDRI
   env — exactly the profile §10 warns about. In these shots it feeds
   the general blowout rather than a discrete blob. Prescribed fix from
   §10: roughness ≈0.62, envMapIntensity ≈0.3, keep the gradient map and
   foam (they are albedo-side and safe).
3. **Tilt-shift never reaches the phone.** Effects mounts only on the
   high tier (lazy chunk — good for bundle), so the 874×402 acceptance
   viewport gets no diorama lens at all. ART_3D §9.1 itself allows
   phone-low to skip it, and the phone shot still improves a lot from
   materials/colour alone — but per TEARDOWN lesson 5, the tier people
   actually judge should get at least a cheap tilt-shift/vignette.
4. **Framing not fixed.** Long lens or not, the phone board area still
   shows only part of the island (follow-cam crop); the whole island is
   not in frame (ART_3D §8.1). Desktop still overfills behind DOM
   panels. The WIP's CameraRig work does not include fit-solved framing.
5. **Flora is subtle in-shot.** Flora.tsx is well built (instanced,
   seeded, keep-outs, density by tier), but in the board shots the
   added flowers/bushes are sparse — the island centre and rim still
   read emptier than §9.7's "no large blank areas". Density/placement
   tuning needed, not a rewrite.

## Per-component verdict
| Component | Verdict | Why / required fix |
|---|---|---|
| Materials: PLASTIC (roughness 0.4, clearcoat 0.3) / MATTE split + bright-green palette | **ADOPT** | The single biggest visual win on both viewports; matches ART_3D §9.3/§9.4. |
| Ball-cluster trees + stronger warm sun (2.6) + tiered shadow sizes | **ADOPT** | §9.5/§9.8 satisfied in the shots. |
| Flora (instanced flowers/bushes/stones/fences) | **ADOPT** | Sound implementation; tune density up between stations (§9.7) during the quality pass. |
| Water gradient + foam ring + ripples | **ADOPT WITH FIXES** | Keep albedo-side work; change material to roughness ≈0.62, envMapIntensity ≈0.3 (TEARDOWN §10 fix) before judging bloom. |
| HDRI environment (spruit_sunrise 512, EnvironmentLite PMREM) | **ADOPT WITH FIXES** | Gives the plastic its gloss; but per-material env intensities must come down on matte/water surfaces, and it is a prime suspect in the desktop blowout. Licence: Poly Haven CC0 — verify the file's provenance note lands in THIRD_PARTY_NOTICES. |
| Bloom | **ADOPT WITH FIXES** | Keep the §9.6 idea (0.25–0.35, threshold 0.85) but re-tune AFTER the exposure/env fixes; if tiles still bleach, raise threshold toward 1.0 and drop intensity to ~0.25. Judge on the fixed frame, not this one. |
| N8AO | **ADOPT WITH FIXES** | Correct §10 route and ordering (before blur), desktop-only cost is acceptable; in the current shot its grounding is invisible because the frame is blown out — re-judge after exposure fix with the WIP's own ?fx=0 / AO-off comparison shots. |
| TiltShift (desktop chain, focus band follows the human pawn) | **ADOPT (desktop)** | Visible, correct, follows the pawn per §9.1. |
| TiltShift on phone tier | **ADOPT WITH FIXES (add cheap version)** | Add a low-cost tilt-shift or vignette-only pass for the medium/phone tier, gated by the existing FPS degrade path; do not ship the full HalfFloat chain to phones. |
| ToneMapping effect + HueSaturation/Contrast push | **ADOPT WITH FIXES** | Neutral mode is the ART decision; the +0.2 sat / +0.1 contrast push on top of already-saturated materials overshoots — reduce or drop after exposure fix. |
| Camera (fov 27, pulled back) | **ADOPT, framing still open** | Lens direction right; whole-island fit on phone + desktop overfill remain open work (fit-solved distance per TEARDOWN §6.5). |

## Overall
**Adopt the WIP as the base of the quality pass — do not ship it as-is.**
Its materials/colour/trees/water/flora are a genuine step up from the
committed baseline on both viewports, and it breaks no tests. Its
desktop post chain is overcooked (exposure/env/bloom stacking) and
must be re-tuned in that order: (1) water/env intensities per TEARDOWN
§10, (2) exposure, (3) bloom threshold/intensity, (4) saturation push —
re-shooting after each step. Phone tier needs a cheap lens effect and
both tiers need fit-solved framing. All of this is written up as the
Devin task brief in `DEVIN_TASK_BRIEF.md`.
