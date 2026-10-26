# Maturity assessment: v2-remove-noise (HEAD 8eb873f, main)

Scope: spec + Revisions, owner requirements v2 (sections 1-20), plan remove-noise. Deferred by owner and not scored: New Audit wizard / My audits, Supabase / login / share links, superseded swipeable problem-deck variants. Playwright not re-run (owner: 134 green at HEAD).

## Scores
| Dimension | Score | Justification |
|---|---|---|
| 1 Requirements coverage | 4 | Plan steps 1-3 all present: one-page dashboard, systemicRepeats (28), shared 1000 ms hand-off (`lib/handoff.ts` HANDOFF_MS, globals.css 1000ms), /repeats, /high-risk, /audits, /contractor, carousel category page. Gap: /repeats has no "issues as bars (length = contractors hit)" panel, only the dot matrix. |
| 2 Data fidelity | 4 | pytest 38 pass, vitest 183 pass. `tests/unit/scoring.test.ts` asserts ABYATONA-1112 = 62.76% (two tests); `analytics-systemic-repeats.test.ts` asserts 28, each >= 5 contractors, Q4-only = []. Seed totals not independently re-derived by me beyond the passing importer tests. |
| 3 Visual and motion quality | 4 | Screenshots reviewed (portfolio/dashboard, category, repeats, high-risk, audits, contractor; light and dark). Consistent, dense, no overflow visible, dark parity good. Deductions: dashboard screenshots (16:56) are older than later card commits (high-risk 17:42, score card 18:04); matrix pale dots; truncated names on category page ("Abyatona (Box Culv..."); about 125 px empty band under contractor page at 1366. |
| 4 Director usability | 4 | Every dashboard card drills in 1 click; any gap reachable in <= 3 (dashboard -> category/repeats -> contractor/item). No codes in screens; plain labels. Encodings honest (red = lost, green = improvement, observations neutral grey). Weak point: /repeats colour scale ("score lost" 4 dots, "noted at Q4 -> Q1") is cryptic. |
| 5 Accessibility and performance | 3 | Reduced motion handled (globals.css, e2e tests), focus-visible present, Esc (EscToParent, CompareTray), arrows (carousels). Contrast computed: text passes AA (muted 5.0, good 4.78, partial 4.94, minimal chip 4.51, hero 6.5). Fails: /repeats pale matrix dots about 1.37:1 on white (colour is the only encoding), orange bars #ff8a1f on white 2.36:1 (below 3:1 for graphics). First Load JS: / 204 kB, /category 199, /repeats 192, /audits 187, /high-risk 185, /audit/[id] 183 (shared 131 kB); acceptable. |
| 6 Deploy readiness and security | 4 | `npm run build` succeeds in mock mode. No .env / secrets / tokens / phone numbers found in tracked files (matches only in .claude skill docs prose). .gitignore covers .env*, .next, node_modules, data/source/, test-results. README deploy notes consistent (no env vars, DATA_SOURCE=mock, deployment-protection warning). Supabase/RLS: n/a - Plan 2. |

## Verdict: FAIL
(Accessibility and performance = 3; all other dimensions are 4, none are 5.)

## Prioritised fix list
1. Accessibility - `/repeats` matrix (app/repeats/page.tsx and its dot component): pale dots reach 1.37:1 and encode severity by colour alone. Raise the lightest step to >= 3:1 on both themes, add a second channel (dot size or a numeric title/aria-label per cell) and give the legend a plain label ("more score lost").
2. Accessibility - orange bars (#ff8a1f, 2.36:1 on white) in Contractors / Repeats spread / Region: darken the light-theme `--minimal-dot` fill for bars or add a >= 3:1 outline; values are shown beside them, so keep that.
3. Requirements - `/repeats`: add the plan's left panel (plain-label bars, length = contractors hit, worst first) or document the dot matrix as the intentional replacement; add a contractors-hit count column so the 5/6/7 groups read.
4. Visual - refresh docs/screens dashboard captures (portfolio-*.png, 16:56) at HEAD for 1366/1920 light and dark; capture the dashboard in dark at 1366.
5. Visual - category page contractor list: names truncate ("Abyatona (Box Culv..."); show site on a second line or widen the name column.
6. Visual - contractor page at 1366x768 leaves about 125 px empty below the cards; rebalance card height.
7. Usability - `/repeats` header legends ("score lost", "noted at Q4 -> Q1") need 2-4-word plain meaning labels.

## Raw results
- `python3 -I -m pytest tests/py -q`: 38 passed
- `npx vitest run`: 21 files, 183 tests passed
- `npm run lint`: clean (no output)
- `npm run build`: success, 9 static pages generated; routes First Load JS: / 204 kB, /_not-found 119, /audit/[audit] 183, /audits 187, /audits/new 176, /category/[cat] 199, .../[contractor] 190, .../[item] 182, .../[obs] 182, /contractor/[contractor] 191, /high-risk 185, /repeats 192; shared 131 kB
- `npx playwright test`: not run by instruction (owner reports 134 green at HEAD)
- 62.76% assertion: present in tests/unit/scoring.test.ts lines 15 and 54
- Secret scan of tracked files: none found; `git ls-files` shows no .env, data/source, test-results or .next
