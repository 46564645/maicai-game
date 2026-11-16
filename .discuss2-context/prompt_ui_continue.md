# R5 UI — continue prompt (restart after VM reboot, 2026-11-17 ~01:35 CST)

You are the UI implementation engineer on 《一起去买菜》 (Let's Go Grocery Shopping),
resuming work on branch `devin/r5-ui` in this worktree (~/workspace/maicai-work-ui).
A VM reboot killed your previous process; your uncommitted work SURVIVES — do NOT redo
completed work. First verify state: `git status` / `git diff --stat`, read the brief
`DEVIN_R5_BRIEF.md` and acceptance contract `ACCEPTANCE_R5.md` again (both are in this
worktree; the brief's Part 2 is your task — direction only, you design).

## Where you left off (from the prior session)
- `UI_TOKENS.md` written; token system implemented in `src/theme/tokens.css` plus
  base/hud/board/screens/App/phone CSS; build clean (Board3D gzip 282.8 kB).
- Before/after screenshots captured (`shots/ui_*_after.png`, plus `shots/ui_*_r5m.png`
  measurement shots).
- Still to do: finish the after-screenshots, self-critique + at least one iteration,
  write UI_BEAUTY.md, commit in stages.

## Remaining work
1. `npm run build` clean; `npm test` (85/85). Run the Playwright e2e and report honestly
   what passed/failed (headless SwiftShader timeouts are a known artefact — report, don't hide).
2. Screenshot every screen you touched (board, market, main panels) before/after on
   desktop 1280x800 and phone 874x402 under `shots/`, named
   `ui_<screen>_<viewport>_before/after.png`. Look at them critically against the brief's
   direction (warm cream, orange primary, navy secondary, big rounded cards, soft shadows,
   pastel coding, chunky rounded type, one hero per screen, toy-like tactility) and
   iterate at least once on what you see.
3. Re-run the wrap/overflow checks (G4/H4) after any type-size changes; verify market
   "Buy (N coins)" / "Maybe later" / "Skip" buttons don't overflow or split words.
4. Write `UI_BEAUTY.md`: the token system, per-screen changes, before/after notes,
   interaction-feel notes (pressed/active states ≤300ms, one obvious primary action per
   screen, nothing laggy under tapping).
5. Go through `ACCEPTANCE_R5.md` and mark every UI item you believe passes; flag any item
   you could not meet and why.
6. Commit in stages on `devin/r5-ui` as verifiable chunks land.

## Guardrails (do not regress)
- UI flow, layout structure and English copy stay EXACTLY as they are (R1–R4 outcomes
  locked: desktop prompt bar + HUD docked at the bottom as one 189px stack; phone rail
  262px; safe-area behaviour). Visual quality only, within that structure.
- Do NOT touch `src/board/three/CameraRig.tsx` — the art branch owns it this round.
- Do NOT modify: game engine (`src/game/`), `src/data/cards.json` (exactly 5 recipes),
  the 14 game rules, any English UI copy. Visual tokens only in `src/theme/tokens.css`
  (CSS variables; components reference variables, no bare colour/size values).
- No new font files this round (existing stack + weight/spacing/tabular-nums only).
- Do NOT push to GitHub, do NOT merge, do NOT touch `gh-pages`, do NOT deploy.
- If one single problem defeats 6+ attempts, stop, write down what you tried, and report
  it in UI_BEAUTY.md instead of burning more attempts.
