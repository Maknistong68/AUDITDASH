# Maturity assessment: plan1 (mock-data phase)

Scope: main bento, swipeable details, drill levels L2-L5, audit report. Branch `claude/audit-dashboard-design-4dt7ud`, HEAD `9c89239`. Supabase/RLS: n/a - Plan 2 (not scored).

## Scores

| Dimension | Score | Justification |
|---|---|---|
| 1. Requirements coverage | 4 | All Rev 1/2 bento tiles, compare tray, swipe details (contractor by audit, category by quarter), L2-L5, report, reduced-motion and Esc exist, and 50/50 e2e pass covering every screen. Gaps: the Repeat and High-risk tiles are not clickable, and the spec's "13 contractors" is 12 in the seed. |
| 2. Data fidelity | 3 | pytest 28/28 and vitest 117/117. Seed totals equal the Excel `TOTAL FINAL SCORE` for all 20 audits (checked independently), but the pytest suite asserts only 3 of the 20. The 62.76% test (`tests/unit/scoring.test.ts:13`) scores a hand-made fixture, not seed data. The seed and UI show 1112-Q4 as 62.09%. The official total contradicts its own section scores on screen (see fix 3). |
| 3. Visual and motion quality | 4 | Screenshots in `docs/screens/` are current (last UI commit equals last screenshot commit). Hierarchy, density and dark-mode parity are good, with no horizontal overflow (e2e at 1366 and 1920). Deductions: a lot of 12-13px text, truncated questions ending in "...", and the contradictory Main issues cards (fix 5). I did not re-capture the motion webm files. |
| 4. Director usability | 3 | The worst contractor is 1 click away, and a failing item is 3 clicks via Main problem or "Where it fails" (e2e drill test). But the Repeat findings (268) and High-risk (134) tiles are dead ends, and "Negative observations" lists praise as failures. Main issues shows "most score lost" cards at 100%. |
| 5. Accessibility and performance | 3 | Esc, arrows, `inert` on off-screen slides, `:focus-visible`, global reduced-motion CSS and `MotionConfig` are present. The light-theme `--faint` text colour is 3.3-3.6:1 (AA fail). The selected compare button is white on the dark-theme accent (3.02:1). Build is clean and the largest First Load JS is 197 kB (`/`). No Lighthouse run. |
| 6. Deploy readiness and security | 4 | Build succeeds with `env -i`, offline, and defaults to mock. No secrets, `.env` or phone numbers found. `.gitignore` covers env, `.next`, `node_modules`, `data/source/` and test output. README matches reality. Deductions: real contractor and auditor names are committed (the README warns about it), and `.superpowers/sdd/` working files plus about 80 third-party skill files are tracked. |

**Verdict: FAIL.** Dimensions 2, 4 and 5 are below 4.

## Prioritised fix list

1. **Director usability (4): praise is labelled as failure.**
   - Where: `components/details/ContractorSlide.tsx:105` ("Negative observations 54"), `app/audit/[audit]/page.tsx:76,214` (tab "Negative observations 55"), and `app/category/[cat]/[contractor]/[item]/[obs]/page.tsx:17` (KIND map).
   - Evidence: JV-ECH shows B9.3 "The site was maintained acceptable with good housekeeping" under negatives.
   - Fix: rename to neutral "Observations / Notes", or classify and filter seed `kind:'negative'` entries by item score or sentiment in `scripts/import_excel.py`.

2. **Director usability (4): the Repeat findings and High-risk tiles do not drill down.**
   - Where: `components/bento/RepeatsCard.tsx`, `components/bento/HighRiskCard.tsx`.
   - Fix: make each tile a link. High-risk should go to the Permits category or a filtered observation list. Repeat should go to a list of repeat items, with each of the three item rows linking to its item page.

3. **Data fidelity (2): totals, section scores and the 62.76% figure do not agree.**
   - Examples: 4800001440-Q1 total 60% but sections give 48.9%. 4800001131-Q1 total 85% but sections give 77%. 4800001112-Q4 shows 62.09% while the spec expects 62.76%.
   - Fix: in the report (`app/audit/[audit]/page.tsx`, around the "Official score" block), add a one-line note that the official total is the workbook figure, or reconcile the totals.
   - Fix: add a test that scores the seed, not only a fixture.
   - Fix: extend `tests/py/test_import.py::test_totals_match_excel` to assert all 20 totals read from the workbook, not 3 literals.
   - Fix: confirm the 12 vs 13 contractor count against the spec (`scripts/contractors.py:7`).

4. **Accessibility (5): contrast.**
   - `app/globals.css:25` `--faint: #86868b` is 3.62:1 on white and 3.33:1 on the ground. It is used for 13px chip counts and "N/A" (`app/audit/[audit]/page.tsx:150,174,193`; `components/report/ObservationList.tsx:61`). Use #6e6e73 or darker for text, and keep faint for decoration only.
   - `components/bento/ContractorsCard.tsx:119`: in dark mode `--on-accent` white on `#2997ff` is 3.02:1. Set dark `--on-accent` to #000 or darken the accent fill (`app/globals.css:87`).
   - `--gap` #e2533a is 3.49:1 on the light ground. It is acceptable only for large text, so confirm it is never used at small sizes (`components/sections/CompareTray.tsx:277`).
   - Run Lighthouse and record the scores.

5. **Director usability and visual (4, 3): Main issues is contradictory.**
   - Where: `components/sections/MainIssues.tsx:59`.
   - Evidence: the section is titled "Most score lost" but shows items at 20/20 with Q1 100% and an up-trending sparkline.
   - Fix: rank and display the score lost (gap %) rather than the "noted" count, or retitle and relabel the card.

6. **Visual (3): small and truncated text at 1366x768.** The bento question text is truncated (`components/bento/MainProblemCard.tsx:96`, `RepeatsCard.tsx:30`) and uses 12-13px type. Raise the minimum to 14px, or show the full text on hover or focus. `title` is not keyboard accessible.

7. **Deploy hygiene (6).**
   - Remove `.superpowers/sdd/` (task reports and diffs) from git and add it to `.gitignore`.
   - Consider anonymising auditor names in `data/seed/audits.json`. The repo must stay private, as the README states.

8. **Process.** Playwright's `webServer` runs `npm run build` as part of the test run. My first `npx playwright test` immediately after a separate build failed with "Could not find a production build" and passed on re-run, so the build-then-start sequence is fragile when run concurrently. Consider a separate build step or `reuseExistingServer`.

## Raw command results

- `python3 -I -m pytest tests/py -q`: 28 passed.
- `npx vitest run`: 13 files, 117 tests passed.
- `npx playwright test`: 50 passed in 58s on the re-run. The first run failed on webServer startup ("no production build"), most likely a race with a concurrent build. Screens exercised: bento (portfolio spec), compare tray, drill L2-L5 with swipe, below-the-fold, and audit report.
- `npm run lint`: clean.
- `env -i ... npm run build`: success, no env vars. First Load JS per route:
  - `/` 197 kB
  - `/audit/[audit]` 175 kB
  - `/category/[cat]` 184 kB
  - `/category/[cat]/[contractor]` 185 kB
  - `.../[item]` and `.../[obs]` 174 kB
  - `/contractor/[contractor]` 185 kB
  - Shared 131 kB.
- Seed totals vs Excel `TOTAL FINAL SCORE`: 20 of 20 equal (the audit total is read from the workbook row).
- Secret, key and phone grep: no hits (the only phone-pattern matches were contract numbers).
- Contrast, computed (light, on #fff): text 16.8, muted 5.07, faint 3.62, accent 4.70, good 5.39, non 6.25. Dark on #1c1c1e: all at or above 5.2.
