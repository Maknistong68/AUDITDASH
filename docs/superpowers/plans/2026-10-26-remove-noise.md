# Audits Only — "Remove the noise" plan (owner comments, 2026-10-26)

## Context
The dashboard (`main`, live on Vercel) is on track, but the owner wants it cleaned for directors who look for only a few seconds:
- **One page:** no vertical or horizontal scrolling on the dashboard. What's in the hero today is enough; the below-the-fold sections ("Recurring issues", "Past audits") move inside the cards' detail views.
- **No noise:** no checklist codes (A2, B3.2…), no question text, no paragraphs on cards. Only numbers plus a tiny meaning label, and infographics and animation instead of text.
- **Honest numbers:** "268 repeated findings" is misleading. Auditors note almost every question (79 of 81 "repeat"), so the definition changes.
- **Every card opens like the Main problem card does:** the same shared-element animation into a one-page detail view that compares against the past and between contractors, with drill-down.
- **Slower animation:** about 1 s instead of about 0.5 s, so it's felt.

Owner decisions:
- Repeats = questions repeated at ≥ 5 of the contractors audited in both quarters (today **28**).
- Past audits live inside Portfolio score.
- Cards show numbers + 2–4-word labels (e.g. "73% score lost"; Main problem keeps 3 short plain drivers).
- Animation about 1 s.

Work happens on `main`. Each step is pushed when its tests pass, with a screenshot/video to the owner.

## Step 1 — Clean the dashboard into one page
- `app/page.tsx`: delete the below-the-fold sections (`MainIssues` "Recurring issues", `AuditReel` "Past audits"); their content moves in Steps 3–4. The page is exactly the bento hero and must fit 1366×768 and 1920×1080 with `document.scrollHeight <= innerHeight` and no horizontal scroll.
- Card cleanup (keep each card's existing design; only remove noise and add meaning labels):
  - **Repeat findings (`components/bento/RepeatsCard.tsx`):** big number = repeated questions (28), label "questions repeating". Remove the code/question list. Add a tiny infographic (a contractor dot-row: how many of 7 contractors each top issue hit, as dots, no text).
  - **High-risk work (`HighRiskCard.tsx`):** number + label "high-risk findings" + a tiny Q4→Q1 two-bar infographic. Remove the caption sentence.
  - **Main problem (`MainProblemCard.tsx`):** keep as is (3 plain driver labels, already code-free). Make sure the % reads "73% score lost".
  - **Portfolio score, Bands, Region, Contractors:** every % gets a 2–4-word meaning label where it's ambiguous; no other change.
- Use the plain labels in `lib/itemLabels.ts` wherever an item is named. No codes appear anywhere on the dashboard (e2e regex `/\b[ABC]\d+(\.\d+)?\b/` absent in `hero`).

## Step 2 — Correct "repeated findings"
- `lib/analytics.ts`: new `systemicRepeats(repo, filter, minContractors = 5)`. It returns the questions (with plain label and category) noted in both quarters for ≥ `minContractors` of the contractors audited in both quarters, plus for each question: the contractors hit, Q4 and Q1 note counts, and section score per contractor.
  - Keep the existing `repeatFindings` (per-pair) as the source.
  - Empty for single-quarter filters, with a "—" on the card, as today.
- Vitest: filter all → 28 questions. Every question has ≥ 5 contractors. Q4-only → []. Region filter respected.

## Step 3 — One shared "card opens" animation + one-page detail views
- Generalise the existing hand-off (from commit 6d225d0, View Transitions + `view-transition-name`, reduced-motion fallback) into one helper used by every clickable card. Duration about 1 s with an ease-out curve; the category carousel glide is slowed to match.
- Detail views. Every one fits a single screen (no vertical or horizontal page scroll at 1366/1920). Each uses infographics first, minimal words, and compares *past vs now* and *contractor vs contractor*, with drill-down by click:
  - **Main problem → `/category/[cat]` (existing carousel page):**
    - Fit it to one screen: compact the contractor list (top N + "all" drill), and replace the code + question "Driven by" list with plain labels and bars.
    - Keep the carousel.
  - **Repeat findings → new `/repeats`:**
    - Left: the 28 repeating issues as plain-label bars (length = contractors hit), worst first.
    - Right: a contractors × issues dot matrix (filled = repeated) to compare contractors at a glance.
    - Top: a Q4 → Q1 count.
    - Clicking an issue opens the existing item history drill (`/category/[cat]/[contractor]/[item]`, using the contractor most affected), or highlights its row.
  - **High-risk work → new `/high-risk`:** Q4 vs Q1 bars, high-risk findings by contractor (bars), and by hazard type (lifting, height, electrical, excavation… from the keywords in `lib/highRisk.ts`) as a donut or segmented bar. Clicks drill to the contractor page.
  - **Portfolio score (and Bands, Region) → new `/audits`:**
    - Past-audits timeline (the old reel moves here) with score dots per contractor across Q4 → Q1 (compare past vs now), the band distribution, and the SR1 vs SR2 comparison.
    - Clicking an audit opens its report.
  - **Contractor rows → `/contractor/[id]` (existing):** fit the slide to one screen. Show score, sections and category gaps as visuals, and replace the findings lists with counts plus drill links.
- The audit report (`/audit/[id]`) stays a scrollable document. It's the deepest drill and is printable.

## Step 4 — Verification gate, per step and at the end
- Full chain: `python3 -I -m pytest tests/py -q && npx vitest run && npm run lint && npm run build && npx playwright test`.
- New e2e:
  - The dashboard has no page scroll at 1366/1920.
  - No codes appear in the hero.
  - Every card is clickable and lands on its view.
  - Each detail view has no page scroll at 1366/1920.
  - The hand-off duration is ≥ 0.9 s (read the computed `animation-duration` of `::view-transition-group`).
  - Reduced motion still navigates.
  - The repeats card shows 28 for filter all.
- Screenshots and 1-s-paced videos for each view are sent to the owner before moving to the next step. The dashboard stays visually unchanged apart from the listed card cleanups (pixel diff outside those cards).
- Run the `maturity-assessor` agent at the end. Then do a final whole-branch review and one fix wave.

## Execution
Subagent-driven, as before:
- One UI implementer per step on `main` (opus for Steps 1 and 3, sonnet for Step 2).
- A reviewer after each step.
- Push after each green step.
- The owner may add more comments before or during execution; they become extra steps.

## Not in this plan (still pending, owner to schedule)
- New Audit wizard and "My audits".
- Supabase / login / share links.
