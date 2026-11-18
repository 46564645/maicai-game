# R9 fix round — parent station: status indicator, fallbackLine i18n, one retry

You are the implementer (Devin, SWE-2). The PM (Muse) will accept your work afterwards: do NOT push to GitHub and do NOT rebuild the play zip — commit locally only.

BEFORE anything: read `AGENTS.md`, `docs/REQUIREMENTS.md`, and `PARENT_API_R7.md` in this repo and follow them. Work on branch `canonical-source` in ~/workspace/maicai-work.

## Why this round exists
R7 wired the AI parent station (stop 6) to a live LLM (Qwen qwen-flash via DashScope compatible mode, config in the gitignored `.env.local` — NEVER read, print, or commit that file's contents). The owner's field test on 2026-11-17 evening showed a session silently running the OFFLINE script after the first live fetch failed in his browser — indistinguishable from live. Three fixes were approved by the owner:

## Fix 1 — live/offline status indicator
In `src/components/ParentPanel.tsx`, every render branch of the parent station (live view AND offline view) gets a small status indicator in the panel header area:
- Live session active → green dot + label (EN "Live chat" / ZH "真对话")
- Offline script (no key configured, or after a fallback) → grey dot + label (EN "Offline script" / ZH "离线脚本")
Rules: colours only via existing tokens.css variables (add variables there if truly needed, nowhere else); add the two labels to BOTH `src/i18n/en.ts` and `src/i18n/zh.ts` (dictionaries must stay strictly isomorphic — there is a test); the indicator is display-only (not a button); do not change the panel's outer layout metrics (the R8 adaptive fit must not regress).

## Fix 2 — fallbackLine must follow the UI language
`src/game/stations/parent.ts` (~line 66) pushes `cards.parentStation.fallbackLine` ("That's OK. Let's pick a picture together.") into the game log as an AI line, in English even when the UI language is Chinese. The Chinese string already exists in `src/i18n/cardText.ts` ('没关系。我们一起选一张图卡。').
- Make the emitted line follow the current UI language (EN → the current cards.json line; ZH → the Chinese line), using the same localization mechanism the rest of the parent station uses. Do NOT change the judging logic, the answers, or anything about coins.
- Audit the same engine file for OTHER parentStation strings it pushes into the log/UI unlocalized (check every `cards.parentStation.*` read: intro, voiceHint, settleLabel, approveLine, fallbackLine) and fix any with the same bypass, the same way.
- Add unit tests: with language zh, an unclassifiable text answer produces the Chinese fallback line in the log; with en, the English one.

## Fix 3 — one automatic retry before falling back
In the live answer flow (`ParentPanel.tsx` liveAnswer / `src/parent/parentLive.ts`): today any fetch failure immediately kills the live session for the whole station visit.
- If a live reply fetch fails for a reason OTHER than timeout/abort, retry it ONCE after ~800 ms. If the retry also fails — or the first failure WAS a timeout — fall back to the offline script exactly as today.
- The "thinking" bubble stays up during the retry; the child never sees an error.
- Unit tests with a mocked fetch: fail-then-succeed → the live session continues with the retried reply; fail-fail → offline fallback engages; timeout → NO retry, immediate fallback.

## Red lines
- Game rules, engine judging and coin logic: untouched (except the Fix-2 string routing).
- cards.json content: unchanged (the English fallbackLine stays as the EN source).
- No new hardcoded UI strings outside the i18n dictionaries; no colours outside tokens.css.
- API frugality: the owner's Bailian balance is ¥15. Do NOT run live API conversations for testing — unit tests with mocked fetch only. (The PM already verified the live path end-to-end.)
- `.env.local`: never read/print/commit it. It exists so builds include the live config; leave it alone.

## Verification & delivery
- `npm run build` clean; `npm test` — all pass (127 baseline + your new tests).
- Screenshots (use the existing CDP screenshot pattern from earlier rounds, SwiftShader-safe): parent station in EN and ZH, live build (green indicator) and offline build (grey indicator — build once without the env file in a temp copy, or stub it), desktop 1280×800 and phone 874×402. Save under `shots/` with r9 names.
- Update `PARENT_API_R7.md` with a short R9 section: what changed, why, test/screenshot evidence.
- Commit everything on `canonical-source` (code + tests + docs + screenshots) with a clear message. Do NOT push, do NOT rebuild the play zip.
- Final report: files changed, test counts, screenshot paths, commit sha, and anything you could not verify.
