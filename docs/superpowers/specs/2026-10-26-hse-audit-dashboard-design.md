# HSE Audit Dashboard — Design & Implementation Plan

## Context
Directors need to see **where the Health & Safety audit gaps are** across contractors without reading
long Excel reports. Today the data lives in two workbooks:
- **Checklist** (`Excellence_EHSS_Quarterly_Performance_Review…xlsx`, sheet *Health & Safety*):
  Sections **A Management** (A1–A15), **B Process & Procedures** (B1–B12 sub-areas, ~40 items),
  **C Planning & Commitment** (C1 Leadership Engagement, C2 Planning). Each item has a weight (1–3) and
  compliance Full=1 / Partial=0.5 / No=0 / N/A=excluded. Score = Σ(weight×value)/Σ(weight of applicable).
  Bands: Excellent 90–100, Good 80–89, Partially 70–79, Minimally 60–69, Non-compliant <60.
- **Results** (`HS_AUDIT_FINDINGS_SAMPLES.xlsx`): 4 sheets (Q4 2025 / Q1 2026 × Sub-Region 1 / 2),
  **20 audits, 13 contractors**, many audited in both quarters. Each audit block (side-by-side columns)
  has header (project, date, location, inspection no., auditors), Part 2 section scores
  (possible/scored per A, B1–B12, C1, C2, total) and Part 3 observations
  (`SR#` code + question + comment + photo flag; plus "Positive Observation" and "Other / Site Findings").

Scope: **HSE only** (Environment, Security, Worker Welfare, CRC later — no stubs for them now).
Outcome: a fun, animated, low-text widescreen dashboard with ≥4 drill levels, a scrollable past-audit
reel, a "main issues" section, per-audit report view, a digital audit checklist, and expiring share links.
Deploy: Supabase + Vercel. Start on mock data generated from the real Excel files.

## Decisions (confirmed with user)
- 10 management-gap categories (mapping below).
- Light + dark themes with toggle.
- Full digital checklist for conducting audits.
- Access: **admin login only**; admin issues **expiring, revocable links** — `view` (directors) and
  `audit` (auditor conducts one audit for a chosen contractor). Expiry presets 1 day / 2 days / 7 days.
- "Maturity agent" = a **dev-time agent that grades the maturity of the app being built**, not a
  runtime feature. No AI/API key in the app.

## Gap categories (deterministic code → category map)
| # | Category | Checklist codes |
|---|---|---|
| 1 | Leadership & Commitment | A9, A11, A12, A15, C1.1–C1.3, C1.5, C1.7, C1.8, C2.6 |
| 2 | Plans & Documentation | A1, A2, A6, A13, C2.2–C2.5, C2.7–C2.19 |
| 3 | Risk Assessment (RAMS) | B1.1, B1.2, C1.9–C1.12 |
| 4 | Permits & High-Risk Work | B4.1, B4.2, B5.1–B5.3 |
| 5 | Competence & Training | A3, B2.1–B2.4, B6.7, B7.1, B7.2 |
| 6 | Subcontractor Control | B6.1–B6.6, B6.9 |
| 7 | Monitoring & Corrective Action | A4, A5, A8, A10, A14, C1.4, C1.6 |
| 8 | Incident & Emergency Readiness | A7, B3.1–B3.3, B8.1 |
| 9 | Site Conditions, PPE & Equipment | B6.8, B9.1–B9.3, B10.1, B10.2 + "Other / Site Findings" default |
| 10 | Health & Welfare | B11.1–B11.3, B12.1, B12.2 |

"Other / Site Findings" get a keyword pass (e.g. permit/lifting/excavation/electrical/earthing → 4;
training/competent/certificate → 5; mosquito/toilet/clinic/heat/water → 10; else → 9). Output is
reviewed once by hand during import.

**Gap metric** (works for Excel and app audits alike): *gap rate* = share of a category's applicable
items that drew a negative finding. Contractor/section views also show the official Part 2 scores.

## Screen design (16:9 canvas, designed at 1920×1080, scales cleanly to 1366×768)
**Hero viewport (no scroll, Level 1 — Portfolio)**
- Top bar: title, quarter switch (Q4 2025 · Q1 2026 · All), region chips (SR1 · SR2), theme toggle.
- Left: big animated **score ring** (portfolio avg, band color, count-up), Δ vs previous quarter,
  3 mini counters (audits · negative findings · positives).
- Center: **Gap Radar** — 10 petal/heat tiles sized/colored by gap rate, pulsing on the worst 3.
- Right: **Contractor league** — animated bars sorted by score, Q4→Q1 arrow per contractor.
**Below the fold (scroll)**
- **Main issues**: top recurring checklist items (e.g. "Subcontractor performance not tracked —
  14/20 audits") as cards with mini sparkline + category chip.
- **Audit reel**: horizontally scrollable cards (score ring, contractor, date, region) for every past
  audit → opens the Audit Report view.

**Drill-down (shared-element morph via Framer Motion `layoutId`, breadcrumb + Esc to go back)**
1. Portfolio → 2. **Category** (contractors ranked by gap rate in it, driving items, Q4 vs Q1)
→ 3. **Contractor in category** (its items, section scores, history) → 4. **Checklist item**
(compliance across that contractor's audits) → 5. **Observation** (full text, photo, link to audit).
Alternate entry: League bar → Contractor profile (A/B/C sunburst, all categories) → item → observation.

**Audit Report view**: header, score ring, section bars, observations filterable by category,
positives tab. Printable.

**Conduct Audit** (auditor via `audit` link, or admin): pick contractor → wizard by section,
big Full/Partial/No/N/A buttons, note + photo per item, live score ring + band, autosave draft,
submit → appears on dashboard. Weights/codes come from the seeded checklist.

## Architecture
- **Next.js 15 (App Router) + TypeScript + Tailwind v4 + Framer Motion**, custom SVG charts
  (full control of animation). Deployed on **Vercel**.
- **Supabase**: Postgres, Auth (admin email login), Storage (`audit-photos`). RLS denies anon;
  link access is validated server-side (route handlers / server actions using the service role).
- **Data source switch**: `DATA_SOURCE=mock|supabase`. Mock reads `data/seed/*.json` so the UI runs
  before Supabase exists; one repository interface (`lib/data/`) serves both.

### Tables
`contractors(id, name, contract_no, subregion)` · `categories(id, name, color, icon)` ·
`checklist_items(code, section, subsection, question, weight, category_id, version)` ·
`audits(id, contractor_id, quarter, date, location, inspection_no, auditors, total_score, status, source)` ·
`section_scores(audit_id, section_code, possible, scored)` ·
`responses(audit_id, item_code, compliance, note)` (app audits) ·
`observations(id, audit_id, item_code?, kind[negative|positive|site], text, category_id, photo_path)` ·
`share_links(id, token_hash, kind[view|audit], contractor_id?, audit_id?, expires_at, revoked_at, created_by)`

### Share links
Admin page `/admin/links`: create (kind, contractor, expiry preset), copy, revoke, see status.
URL `/s/<token>`; token random 32 bytes, only SHA-256 stored; middleware checks expiry/revocation,
sets a short-lived signed cookie scoped to that link's permissions. `view` → read-only dashboard;
`audit` → only the Conduct Audit flow for that contractor, single submission.

## Repo layout (new)
```
app/(dash)/page.tsx                 portfolio (L1) + main issues + reel
app/(dash)/category/[id]/…          L2–L5 drill routes (intercepting/parallel routes for morph)
app/(dash)/contractor/[id]/…        alternate entry
app/audit/[id]/page.tsx             audit report
app/conduct/[draftId]/page.tsx      audit wizard
app/admin/(login|links)/…           admin
app/s/[token]/route.ts              link redemption
components/charts/                  ScoreRing, GapRadar, LeagueBars, Sparkline, Sunburst
components/motion/                  shared transitions, count-up
lib/scoring.ts                      weighted score + band (unit-tested against Excel)
lib/categories.ts                   code→category map + site-finding keywords
lib/data/                           repo interface: mock + supabase impls
scripts/import_excel.py             Excel → data/seed/*.json + supabase/seed.sql
supabase/migrations/*.sql           schema + RLS
.claude/agents/maturity-assessor.md dev-time app-maturity agent
docs/superpowers/specs/2026-10-26-hse-audit-dashboard-design.md  (this design, committed)
```

## App maturity agent (dev-time)
`.claude/agents/maturity-assessor.md`, run at the end of every milestone. Scores 1–5 on:
1 Requirements coverage (each item in this plan) · 2 Data fidelity (seed totals == Excel totals) ·
3 Visual & motion quality (design-taste-frontend inspector, screenshots at 1366×768 + 1920×1080,
both themes) · 4 Director usability (any gap ≤3 clicks, minimal text) · 5 Accessibility &
performance (contrast, keyboard, reduced-motion, Lighthouse) · 6 Security & deploy readiness
(RLS, link expiry, env handling). Writes `docs/maturity/<milestone>.md` with score + fix list;
a milestone closes only at ≥4 on every dimension.

## Milestones
1. **Data foundation** — import script (handle per-block column offsets by locating `Project:`
   labels), seed JSON, `lib/scoring.ts` + `lib/categories.ts` with tests (TDD). Verify all 20 totals
   match Excel `TOTAL FINAL SCORE`, checklist A/B/C sums match (45/65/34 for ABYATONA-1112 → 62.76%).
2. **Dashboard L1** — layout, themes, ScoreRing, GapRadar, League, filters, main issues, audit reel
   (mock data). Skills: design-taste-frontend (app-screen run), dataviz.
3. **Drill-down L2–L5 + Audit Report** with morph transitions, breadcrumb, reduced-motion fallback.
4. **Supabase** — migrations, RLS, seed, admin auth, repo switch.
5. **Conduct Audit** wizard + photo upload + live scoring.
6. **Share links** — admin UI, redemption, expiry/revoke.
7. **Deploy** — Vercel project, env vars, README with setup steps.
Each milestone: superpowers TDD where logic exists → verification-before-completion →
requesting-code-review → maturity-assessor → commit & push to `claude/audit-dashboard-design-4dt7ud`.

## Verification
- `pytest`/`vitest`: scoring equals Excel for every audit; category map covers every checklist code.
- `npm run build && npm run lint && npm test` clean.
- Playwright: load at 1366×768 and 1920×1080, both themes; click path Portfolio → Category →
  Contractor → Item → Observation and back; open an audit from the reel; screenshots reviewed.
- Conduct a test audit with ABYATONA-1112's answers → expect 62.76% / "Minimally Compliant".
- Share links: create 1-day link, open as anon (works), revoke (403), expired token (403);
  `audit` link cannot reach admin or other contractors.

## Assumptions to flag
- A negative observation on an item = that item not fully compliant (Excel lacks item-level answers).
- Photos in Excel are placeholders ("Picture"/#VALUE!) — mock data shows a placeholder thumbnail.
- Auditor phone numbers in the Excel are not shown on the dashboard.

## Revision 1 (2026-10-26) — Level-1 redesign after user review
The user rejected two hero designs (boxed tiles; editorial bars + race) as too plain, unengaging, wrong
content and wrong typography. Approved replacement:
- **Style: Apple** — premium depth, soft glass/gradients, rounded cards, SF-like type, spring motion.
  Light + dark kept.
- **Top strip:** portfolio score · contractors per band · **repeat findings** · **high-risk work findings**.
  - Repeat finding = same contractor + same checklist item with a negative finding in its latest audit
    AND in an audit from an earlier quarter (N/A items excluded).
  - High-risk work finding = negative/site observation in category `permits`, or a site finding whose text
    matches high-risk keywords (lifting, crane, excavation, height, scaffold, harness, electrical, earthing,
    confined, hot work, LPG, gas cylinder).
- **Centrepiece: contractor scoreboard** — one card per contractor with three concentric animated rings
  (outer A Management, middle B Site Processes, inner C Planning & Commitment = latest audit section
  scored/possible), official total score, band badge, Δ vs previous quarter, rank. Card → contractor profile.
- **Compare mode:** select 2–3 cards → tray slides up: rings side by side, 10-category gaps, trend, top repeat issues.
- **Below the fold:** Where it fails (10 categories) · Region comparison SR1 vs SR2 by quarter · Main issues ·
  Past-audit reel.
- Drill levels L2–L5, contractor profile and audit report are unchanged in scope but follow the Apple style.

## Revision 2 (2026-10-26) — bento layout, no rings, swipeable audit history
User feedback on Revision 1: the activity rings are annoying. Approved replacement (Apple look kept):
- **Main screen = asymmetric bento cards** of different sizes:
  - **XL — Contractors:** ranked highest → lowest score: rank, name, region, score bar, %, band badge, Δ vs previous; row → contractor details; small compare toggle per row (compare tray kept, rings replaced by A/B/C bars).
  - **L — Main problem this quarter:** the worst gap category for the latest quarter in the filter (e.g. "Leadership"), big gap %, Δ vs previous quarter, its top 3 driving items; card → category details.
  - **M — Portfolio score**, **M — Repeat findings**; **S — High-risk work**, **S — Contractors by band**, **S — Region SR1 vs SR2**.
- **Details pages are swipeable histories:** contractor details = carousel of that contractor's audits, first slide = latest audit, swipe/arrow/drag left-right for earlier audits; category details = carousel by quarter (latest first) showing contractors ranked by that category's gap and its driving items. Deeper levels (contractor-in-category → item history → observation) and the audit report remain.
- **Below the fold:** all 10 categories ("Where it fails"), Main issues, Past-audit reel.

## Revision 3 (2026-10-26) — "Audits Only" v2
Source requirements: `docs/requirements/2026-10-26-audits-only-v2.md`. Owner decisions: browser-only saving until Supabase;
non-H&S tabs empty until audits are entered; Driven By = top weak categories; no roles until login.

- **Name:** "Audits Only" (title, header, metadata).
- **Header:** `Audits Only · [H&S | Security | Environmental | Welfare | CRC] … [Q4 2025 | Q1 2026 | All] [SR1][SR2] [+ New Audit] [theme]`.
  Type tabs use the quarter-tab style; URL param `t=hs|security|environmental|welfare|crc` (default `hs`).
- **Main dashboard grid** (no wasted space, consistent gutters, aligned rows): Contractors (ranked) · **Main Problem – <latest quarter>**
  (most prominent card) · Audit Overview (score, bands, audit count) · Audit Trends (quarter-over-quarter, regions) ·
  Findings / Open Actions (repeats, high-risk, open actions from entered audits). Below: Where it fails · Recurring issues · Past audits.
- **Driven By:** top 4 categories by contribution to the quarter's lost score: contribution = category gap × category weight share,
  shown as ranked rows with % of lost score + severity bar; computed from data (`gapContribution`).
- **Main problem click → controller view** (`/category/<id>`) with an animated hand-off (shared layout morph / view transition).
- **Controller view = progressive cards:** card 1 active and prominent; 2–4 faded; activating a card slides it open (spring, reduced-motion = instant):
  1 Main issue · status (band of the category) · severity (gap %) · findings count · quarter switch;
  2 Category breakdown — driving checklist items grouped by subsection with impact bars;
  3 Contractors — ranked by gap, Q4→Q1 comparison, repeat findings per contractor;
  4 Actions — recommended actions extracted from auditor notes ("Contractor to…", "recommended…", "shall…") plus corrective actions
    from audits entered in the app (target date, status Open/Closed). Closure tracking for imported audits starts with Supabase (stated on the card).
  Deeper drill (contractor-in-category → item → observation) unchanged.
- **+ New Audit** → `/audits/new` wizard: 1 Audit information (type, title/reference, date, location/project, contractor, subcontractor, auditor) →
  2 Checklist for the type (sections from the owner's workbook; answers Compliant / Non-Compliant / Observation / N/A; comment, reference,
  severity, photos) → 3 Findings (finding, category, severity, responsible party, corrective action, target date, evidence) →
  4 Review (totals, live score + band) → Save Draft / Submit. Drafts autosave. Storage: browser (localStorage for data, IndexedDB for photos).
- **Scoring for app audits:** Compliant = 1, Observation = 0.5, Non-Compliant = 0, N/A excluded; H&S uses the organisation formula
  (mean of A, B, C with C = mean(C1, C2)); other types use the mean of their section scores. CRC: 13 risk areas, weight 1 each.
- **Categories for non-H&S types** = their checklist sections (from the workbook), so Driven By/Where it fails are data-driven per type.
- **Where browser audits appear:** "My audits" (drafts + submitted) on every tab; non-H&S tabs compute their dashboard client-side from
  submitted browser audits; the H&S tab shows imported data plus "My audits" (merged into H&S aggregates after Supabase).

### Revision 3a — categories (2026-10-26)
Owner request (requirements §15). H&S now has **8 categories**, in this order: Leadership · **Documents** · Competence ·
Subcontractors · Monitoring · Emergency · **Site Compliance** · Health.
- `documents` replaces `plans`, `rams` and `permits` (codes: A1, A2, A6, A13, C2.2–C2.5, C2.7–C2.19, B1.1, B1.2, C1.9–C1.12, B4.1, B4.2, B5.1–B5.3). Colour amber `#eda100` (dark `#c98500`), icon FileText, re-validated for adjacency in the new order.
- `site` keeps its id; renamed "Site Compliance" (short "Site"); PPE items stay in it. Site findings no longer map to a permits category: the keyword pass now only routes training/competent/certificate to Competence and mosquito/toilet/clinic/heat/water to Health; everything else is Site.
- High-risk work = item code B4.* / B5.* (permit and utility-clearance items) or a site finding matching the high-risk keywords; the tile links to `/category/documents`.
- `/category/plans|rams|permits[/...]` redirect (308) to `/category/documents`, query kept.
- Code is count-agnostic (`CATEGORIES.length`); the gap grid is 4×2 on wide screens.
