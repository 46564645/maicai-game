# R5 SCENE — continue prompt (restart after VM reboot, 2026-11-17 ~01:35 CST)

You are the scene implementation engineer on 《一起去买菜》 (Let's Go Grocery Shopping),
resuming work on branch `devin/r5-art` in this worktree (~/workspace/maicai-work).
A VM reboot killed your previous process; your uncommitted work SURVIVES — do NOT redo
completed work. First verify state: `git status` / `git diff --stat`, read the brief
`DEVIN_R5_BRIEF.md` and acceptance contract `ACCEPTANCE_R5.md` again.

## Where you left off (from your prior session log)
- Full-screen sea + toy boats implemented; build clean (Board3D gzip 284.2 kB, budget ~300 kB).
- Boats/buoys recolored to blue/purple/cream palette (no longer contaminating the island
  segmentation measurement).
- Final camera params locked in code: desktop `FIT_SHIFT z+1.5 / FOLLOW_MIX 0.12`,
  phone `FIT_SHIFT x+3.2 / z+0.4 / FOLLOW_MIX 0.05` — both at the geometric max inside
  the real panel bounds.
- Still to do: rebuild + re-shoot (board + market, desktop 1280x800 and phone 874x402),
  measure, write ART_R5.md, commit in stages.

## PM ruling — FINAL, do not revisit or rework
Keep `FOLLOW_MIX` 0.12/0.05 + `FIT_SHIFT` as implemented. Do NOT rework the solver to
per-goal distance (that option is deferred to a later round). Freeze-after-first-gesture
behaviour stays as it is. Full ruling: `DISCUSSION_R5.md` on branch `canonical-source`
(staged copy at `.discuss2-context/DISCUSSION_R5.md` in this worktree).

## Remaining work
1. `npm run build` clean; `npm test` (85/85). Run the Playwright e2e and report honestly
   what passed/failed (headless SwiftShader timeouts are a known artefact — report, don't hide).
2. Re-shoot before/after screenshots under `shots/`, named `art_<screen>_<viewport>_before/after.png`.
   NOTE: port 4173 may be held by other worktrees' preview servers — check and use a free
   port, parameterize the harness BASE accordingly. Watch for the known flake where a
   desktop shot catches the 2D fallback (lazy 3D chunk still loading under SwiftShader) —
   re-shoot, don't ship a 2D shot as 3D evidence.
3. Measure and record in `ART_R5.md`: island fill % before/after per viewport with the
   PINNED metric (projected island bbox incl. shallows, rim extent FIT_BOUNDS, ÷ free-band
   area; ALSO report core-bbox ÷ free band and core-bbox ÷ viewport — never only one
   number), panel-cover % (desktop must be 0.0%), exposure metrics (near-white ≈4%,
   blown ≤2.5%, T2口径), bundle size, test results.
4. Go through `ACCEPTANCE_R5.md` and mark every item you believe passes; flag any item
   you could not meet and why.
5. Commit in stages on `devin/r5-art` as verifiable chunks land.

## Guardrails (do not regress)
- Visual changes only. Do NOT modify: game engine (`src/game/`), `src/data/cards.json`
  (exactly 5 recipes), the 14 game rules, any English UI copy, R1–R4 layout outcomes.
- Do NOT re-apply the ART_3D §9.4 saturation/contrast push or Bloom threshold 0.85 —
  both were superseded by the accepted T2 fix. Keep the T0 fix
  (`.phone-rail.popup { animation: none }`).
- No new external 3D assets — everything procedural or already in `public/models/`.
  If you believe one is required, note it in ART_R5.md and stop; the PM sources it.
- Do NOT push to GitHub, do NOT merge, do NOT touch `gh-pages`, do NOT deploy.
- If one single problem defeats 6+ attempts, stop, write down what you tried, and report
  it in ART_R5.md instead of burning more attempts.
