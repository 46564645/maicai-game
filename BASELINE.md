# BASELINE — canonical source (05f0cdc "M4.5.9c") fresh health check

Date: 2026-11-16. Working copy: `~/workspace/maicai-work/` (pristine copy of
`01-source-committed/` from the Grok Bot export; export itself untouched).
Environment: Node v24.22.1, npm 10.9.4, this VM (1.5 shared CPUs, no GPU —
all browser rendering via Playwright Chromium + SwiftShader software WebGL).

## Copy-only environment adjustments (documented, not source changes)
- `playwright.config.ts`: `channel: 'chrome'` commented out — the VM has no
  Google Chrome. Playwright's bundled Chromium was installed with
  `npx playwright install chromium` (chromium-1254) and is used instead.
  This is exactly the adjustment TECHNICAL_HANDOVER.md sanctions for new
  environments ("或在自己的副本明确调整浏览器 channel").
- `shots/shoot.mjs` (new, mine): screenshot driver adapted from the
  project's own `scripts/shot-m45_7.mjs` flow (same entry clicks, same
  viewports, same 4.5 s camera settle), minus the chrome channel, plus a
  longer screenshot timeout (SwiftShader capture is slow) and an rAF FPS
  probe. Nothing in `src/` was touched for the baseline.

## Fresh results
- `npm ci` — OK, 176 packages.
- `npm run build` — OK (tsc -b clean + vite build). dist: index 0.58 kB,
  CSS 47.3 kB, main JS 255.8 kB (gzip 78.4 kB), Board3D chunk 1,022.3 kB
  (gzip 277.8 kB).
- `npm test` (vitest) — **85/85 passed** (10 files; includes the
  200-seed × 4-script × 3-personality full-game simulation, ~98 s).
- `npm run e2e` (Playwright) — FIRST RUN: **3 passed / 5 failed (8.2 min)**.
  All 5 failures are **timeouts under software rendering**, not game-logic
  assertions: board3d died on `page.screenshot` (60 s test timeout),
  fullgame on a `locator.click` actionability timeout (180 s), safearea on
  a 4 s in-safe-area predicate, keyboard/mobile likewise on time. Evidence
  in `test-results/*/error-context.md` of that run. A re-run with a
  CLI-extended test timeout (`--timeout=240000`, config untouched) was
  started to separate "slow environment" from "broken game":
  RESULT: _pending at first writing — see addendum below_.

## Baseline screenshots (fresh, this run)
- `shots/baseline_board_desktop.png` (1280×800)
- `shots/baseline_board_phone.png` (874×402; rAF probe ~2 fps under
  SwiftShader — a software-rendering artefact of this VM, NOT a device
  performance measurement)

## Honest baseline visual defects (from the fresh screenshots + source)
1. **No post-processing at all, no environment map.** No tilt-shift, no
   bloom, no AO — ART_3D §9 items 1 and 6 are simply absent in the
   committed baseline. The scene reads flat.
2. **Matte, not glossy plastic.** `materials.ts` TOY_MAT is
   roughness 0.85 / no clearcoat everywhere; ART_3D §9.3 asks for
   MeshPhysicalMaterial roughness 0.35–0.45 + clearcoat 0.3 on props and
   buildings. Nothing in the frame has a specular highlight.
3. **Washed-out pastel palette.** Grass is pale mint `#B8E3C5`, leaf
   `#8FD6A8`, water `#A9D8EE` — ART_3D §9.4 wants saturated bright green
   (#5CC94A–#7ED957). Desktop shot: the whole island looks faded, low
   contrast, "minty grey" water band around it.
4. **Weak light.** Sun intensity 1.15, shadow map 1024 on all tiers,
   no contact shadows / blob shadows under stations (blob texture exists
   in materials.ts but grounding reads soft/absent in shots); ART_3D §9.5
   wants sun 2.5–3, long soft shadows, obvious contact shadow.
5. **Camera lens too wide / framing off.** Canvas fov 37 (ART_3D §9.2:
   25–30°, long lens). On desktop the island overfills the frame and is
   cropped top/bottom behind DOM panels; on phone (874×402) the board
   area shows only part of the island — the whole island is NOT in frame
   (ART_3D §8.1), only the active-station neighbourhood.
6. **Trees are cones, not ball clusters.** Scene.tsx Tree = two stacked
   cones; ART_3D §9.8 wants round ball-canopy toy trees. Only ~4 trees +
   2 stones + 3 single flowers decorate the island rim — large empty
   grass areas (ART_3D §9.7 wants 3–6 decorations between stations,
   instanced flora).
7. **Water is a flat pale disc** — no gradient, no foam ring, no moving
   normal/wave sparkle (ART_3D §9.9).
8. **Road/stops are the strongest part**: the tan road bed + cream
   segmented tiles + coloured station dots DO read as a board loop
   (this codebase already prints its board from station data). Station
   props (market canopy, bus, phone) are small but recognisable.
9. Centre spinner reads well on phone shot (weather segments visible),
   but on desktop it sits mostly hidden behind the turn panel at start.

## Addendum — e2e re-run with extended timeout (same day)
Re-run: `npm run e2e -- --timeout=240000` (CLI override only; config and
specs untouched). Result: **6 passed / 2 failed (7.1 min)** — board3d,
keyboard and mobile now pass, confirming the first run's failures there
were environment timeouts. The 2 remaining failures are different in kind:

1. `fullgame` — still a timeout: `locator.click` waits for the primary
   button ("Next lap") to be "visible, enabled and stable"; under
   SwiftShader at ~2 fps the element never settles within the spec's
   180 s budget. Environment-caused, not a logic assertion.
2. `safearea` — **a real layout assertion failure in this environment**:
   after selecting an item at the Market, the second in-column button's
   bottom edge sits at y=424, beyond the allowed ≤383 (874×402 viewport,
   safe-area insets applied); the 4 s retry predicate never saw it pass,
   so it is persistent, not transient. Caveat: this VM's Chromium lacks
   the original dev machine's fonts, and taller font metrics can push a
   panel's buttons down — so treat this as a **flagged suspected 9b
   regression to re-verify on real Chrome with proper fonts**, not as
   settled proof. It is recorded here because STATUS_AND_NEXT_STEPS §3
   explicitly asks for the market/store safe-area re-check, and in this
   environment that check does NOT pass.

Bottom line for the baseline: build clean, unit 85/85, e2e 6/8 with one
environment timeout and one flagged safe-area overflow (market panel).
Neither historical screenshots nor this paragraph substitute for a
real-device / real-Chrome acceptance run.
