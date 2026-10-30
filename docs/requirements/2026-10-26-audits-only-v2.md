# Audits (formerly "Audits Only") — v2 requirements (from the owner, 2026-10-26)

App name: **Audits** (renamed from "Audits Only", §21).

## 1. Header tabs
- Main audit-category tabs at the top of the dashboard: **H&S** (Health & Safety) · **Security** · **Environmental** · **Welfare** · **CRC**.
- Same visual style as the existing quarter tabs on the other side of the header; active tab clearly highlighted; act as primary navigation/filter; switching updates the dashboard; no wasted space between tabs and content.

## 2. Main dashboard — "Main Problem – Q1 2026"
- The second-largest card becomes one of the most prominent components, clearly titled **Main Problem – Q1 2026**.
- Visually stronger than ordinary cards; clear problem information; prominent **Driven By** section; interactive on click.
- Must answer at a glance: *"What is the main problem identified during Q1 2026, and what categories are driving it?"*

## 3. "Driven By" — categories
- Replace the plain list with a category-based visualisation of the categories driving the main problem.
- Categories generated from audit data, not hard-coded.
- Compact: ranked categories, contribution/percentage indicators, small bars, severity/count indicators. No complicated charts.

## 4. Alignment and empty space
- Rework the grid: fewer gaps, consistent alignment, better use of horizontal space, proper spacing between sections, no large unused areas, balanced, responsive.
- Should read as a deliberate information-management interface, not individually positioned cards.

## 5. Main Problem click
- Clicking **Main Problem – Q1 2026** opens the related controller view (e.g. "Subcontractor Control"), with an intentional, animated transition — not a static page jump.

## 6–8. Controller view — progressive cards
- Card 1 primary and prominent; cards 2, 3, 4 visible but faded/subdued (visual hierarchy 1 → 2 → 3 → 4).
- Clicking/progressing activates the next card, which slides down/open smoothly (professional, not excessive).
- Each card has its own information group:
  1. Main issue · overall status · severity · number of findings
  2. Category breakdown — what type of issues occur
  3. Subcontractor/contractor details · performance comparison · repeated findings
  4. Required actions · corrective actions · closure status · follow-up

## 9–11. Auditor audit input
- A clear **+ New Audit** button on the main dashboard header, top right: `H&S | Security | Environmental | Welfare | CRC          + New Audit`. Visible, not overpowering.
- Workflow:
  1. **Audit information** — audit type (H&S/Security/Environmental/Welfare/CRC), title/reference, date, location/project, contractor, subcontractor, auditor.
  2. **Checklist** — questions for the selected type; record Compliant / Non-Compliant / Observation / Not Applicable; comments, evidence, photos, reference/requirement, severity/risk level.
  3. **Findings** — finding, category, severity, responsible contractor/subcontractor, corrective action, target date, evidence.
  4. **Review & submit** — totals (questions, compliant, non-compliant, observations, N/A, open findings, critical/high) → **Save Draft** / **Submit Audit**.

## 12. Roles
- **Auditor**: create audit, save/edit own draft, submit, add findings, upload evidence, view history.
- **Controller/Manager**: view audits, review findings, monitor subcontractors and trends, review corrective actions.
- **Viewer**: view dashboards, results, reports.
- Audit-input permissions controlled by role (exact roles adjustable later).

## 13. Design principle
Separate **Input** (auditors create/submit) · **Analysis** (trends, categories, main problem, subcontractor performance, recurring issues) · **Control** (findings, corrective actions, subcontractor follow-up). The user must immediately see: where to enter an audit · what the main problem is · what drives it · which subcontractor/category · what action is required.

## 14. Target structure
Header (Audits Only · tabs · + New Audit) → main dashboard (Audit Overview, Main Problem – Q1 2026, Audit Trends, Findings/Open Actions) → Main Problem "Driven By" categories → click → controller view with progressive slide-down cards → audit input (info → checklist → findings → review → save draft / submit).

Flow to convey: **Audit Input → Audit Data → Analysis → Main Problem → Driver Categories → Subcontractor Control → Corrective Action**.

Do not simply add more cards; improve hierarchy and workflow; no unnecessary empty space; consistent alignment.

## 15. Category changes (owner, 2026-10-26)
- Rename "Site & PPE" → **Site Compliance** (PPE items stay in it; "PPE" dropped from the name).
- Combine all document categories into one: **Documents** = Permits + RAMS + Plans & Documentation.
- H&S categories become 8: Leadership · Documents · Competence · Subcontractors · Monitoring · Emergency · Site Compliance · Health.

## 16. Problem deck (owner, 2026-10-26 — supersedes §6–8 card layout)
- The category/controller page (e.g. "Subcontractor Control") becomes the **entirety of the issue view**: a deck of ranked problem cards —
  **1st, 2nd, 3rd, …** — one card per category in "Where it fails" order (worst gap first).
- The active card is full and prominent; the following cards peek behind it with a **fading gradient**; the deck is **swipeable** (drag/swipe, arrows, keys).
- Each card holds that problem's full information (gap & trend, contractors worst-first, driving items, repeat findings, actions).
- **Remove "Where it fails" from the main dashboard** — the ranking now lives in this deck.

## 17. Findings cards (owner, 2026-10-26)
- Split "Findings · open actions" into **three separate cards**: **Repeat findings**, **High-risk work**, **Open actions** (different things).
- **Repeat findings absorbs "Recurring issues"** (they represent the same thing): remove the "Recurring issues" section from the bottom of the dashboard.
- Clicking the Repeat findings card **pops up a panel** listing the recurring/repeat issues (the content formerly in "Recurring issues", plus the repeat list).

## 18. Owner feedback 2026-10-26 (front kept as approved; only these changes)
1. **Main problem dark card — same design.** Make the gap % larger. Replace the "B6.1 / B6.4 / B6.5 + truncated question" rows with plain, informative lines (what the issue is, in words a director reads in 2 seconds, plus how many audits noted it). No codes.
2. **Remove "Where it fails" from the bottom of the dashboard entirely.** Its category cards move to the page opened by clicking Main problem: an animated slider/carousel under the header with gradient and fading effect.

## 19. Correction (owner, 2026-10-26) — replaces the §18.2 slider strip
- Remove the strip of small category cards from the category page.
- Use the **same dark Main-problem card** (same design as on the dashboard) at the top of the category page as card **#1** (worst category).
- That same card is **movable/draggable** left/right to show **#2, #3, …** (next categories, same card design); the page content below follows the card shown.

## 20. Refinement (owner, 2026-10-26)
- Clicking the dashboard Main-problem card **animates**: the card moves left and shrinks smoothly into the category page's first card (shared-element transition).
- On the category page the card is **~50% smaller (or less)**; strip it to the essentials (remove the extra content inside).
- **No "1 / 8" counter, no dots.** Replace with a **gradient moving carousel**: a horizontal row of **same-size** compact cards (one per category, worst first), edges fading with a gradient, draggable/swipeable; the active card is the current category; the page content follows.

## 21. Owner feedback 2026-10-27
1. **Name:** the header reads **Audits** (not "Audits Only").
2. **Dark theme is the default**; a viewer's own light choice is remembered.
3. **High-risk work card removed** (high risk is not recorded in the audits; it was only guessed from keywords). Its place on the H&S dashboard goes to **Positive observations**: the count, and how widely good practice was noted (audits and contractors). It opens `/positives`: contractors ranked by positives per audit and the good-practice notes themselves, newest first. Supersedes the "High-risk work" card of §17.
4. **Portfolio timeline:** month breaks are visible (the middle month of each quarter is a faint band with hairline edges; month names under the quarter).
5. **No logo mark** in the header; nothing in its place.
6. **Repeat findings, one rule:** the same question noted in a contractor's audit and again in that contractor's **next** audit of the same type. The later audit sets the quarter; the earlier may be in any quarter (two audits in one quarter count). No "≥5 of 7 contractors" threshold. Supersedes the repeat logic of §17.
7. **Drill-down animation:** every drill below a category (contractor → question → note) uses the same card-opens morph as the first drill (Main problem → category).

## 21. Owner direction 2026-10-27 — "only what the Excel can tell us"
- **Input & scoring = Excel.** The app's audit input and scoring must match the Excel checklist exactly: per-question
  Full / Partial / No / N/A with the workbook weights and the workbook formula.
- **Remove data that cannot be derived from the Excel** (e.g. keyword-inferred "high-risk work", "open actions").
  **Keep the 8 H&S categories** (owner's explicit exception).
- **Repeats = per question:** the same question that was a finding in the previous audit of the same contractor and is a
  finding again → counts as one repeat; show how many times it repeated, per contractor.
  Accuracy requires Part 1 (per-question Full/Partial/No/N/A) for every audit — the owner will supply the completed
  checklist workbooks; until then repeats are not shown as exact.
- **Repeat view = heat map like Excel cells:** rows = questions, columns = contractors, cell = times repeated (colour
  intensity). Replace the dot matrix.
- **Portfolio redundancy:** one Portfolio score card on the dashboard (with a small up/down chart); Bands and Region move
  into the Portfolio page (timeline + bands + regions). Nothing shown twice.
- **Dashboard contractor list:** replace "+1 / −2" text with a small up/down line chart per contractor.
- **Contractor page:** fill the open space at the top with a bigger up/down score chart across audits; move the A/B/C bars
  lower; replace the third card (observations by category) with the **top 3 repeated observations** for that contractor.
- Owner kept from the parallel session (2026-10-27): name "Audits", dark default theme, Positive observations card/page.
- Interim repeat rule until Part 1 arrives: a question is a *finding* in an audit when it has an auditor note, is not
  marked COMPLIANT / N/A in the evidence column, and its section lost points in that audit (Q4 2025 notes proved exact
  against ABYATONA-1112's Part 1: 50 notes = 50 Partial/No). Repeat = finding in a contractor's audit and again in its
  next audit; "times repeated" counts consecutive repeats. Labelled "based on auditor notes".
- Owner decision 2026-10-27: SIBS's two Q4 2025 audits (12 Nov and 19 Nov) are treated as ONE Q4 visit for repeats —
  a finding in either counts once — so SIBS has a single Q4 → Q1 comparison.

## 22. Owner direction 2026-10-30 — "the Excel is the truth"
- **Rely 100% on the Excel.** Data comes only from the workbooks (`HS_AUDIT_FINDINGS.xlsx`, plus completed checklist workbooks).
  **No pictures** are imported or shown.
- **Scores were edited in the Excel**: keep the scoring concept, not the typed totals. Every total is recomputed from the
  workbook's own points (A, B points ratio; C = mean of C1, C2; total = mean). The typed total stays as a data check only.
  Counter-check found: 19 of 21 typed totals differ (RPCO Q1 60% vs 44%, NBC 60% vs 50%, JV-ECH Q1 85% vs 74%, PPCO Q1 76% vs 68%,
  Abyatona H55 Q4 67% vs 58%); JV-ECH Q1 C2 scored 21.5 of 21; PPCO Q4 and SIBS 12 Nov have identical section points; the
  checklist template adds +0.012 to the total, hard-codes B8 = 0.65 and reads B8's answer from the wrong row.
- **Audit AL FAHD 4800001272, 19 Jul 2026 (Q3 2026)** imported from its completed checklist (exact Part 1 answers).
- **Dashboard for executives**: less text, more charts. The biggest card is split in the middle: contractors ranked (top),
  **score over time line chart** (bottom). Hovering any card shows a second layer of detail.
- **Motion**: one calm language, 1.5 s expo-out for every entrance, draw and page transition; no bounce.
- **Auditor's view**: a **Log** of every observation and audit with search and filters; **New audit** imports the Excel
  checklist in the browser (auto-categorised, no pictures) or takes manual entry, scored live with the Excel formula.
- **One place per thing**: navigation is Overview · Log · + New audit. The /audits portfolio page is retired (its trend is on
  the Overview, its audit list is the Log, bands are on the Portfolio card).
- Under the "All" quarter filter headline figures use every audit (a quarter with one audit never decides the headline);
  a selected quarter is compared with the quarter before it.

## 23. Owner feedback 2026-10-30 (second round)
- **Only two quarters** (Q4 2025, Q1 2026) are in the findings workbook: the AL FAHD checklist workbook is the template
  (questions, weights), not an audit. The July 2026 audit is not imported (supersedes that line of §22).
- The month line chart said nothing with two quarters: replaced by **score by quarter** (one line per contractor, the
  portfolio average bold, hover a line for its name and scores).
- Contractors card: the bar takes the free space; tighter spacing.
- **No decorative mini icons** (categories are marked by a colour dot); no explanatory notes, footers or subtitles,
  especially on the Log, the reports and the audit input.
- **Too many numbers and letters for an auditor**: question pages show date, Noted / Clear and the note; one dot per
  audit; no codes, quarters, inspection numbers or section percentages there. Reports drop codes and point fractions.
- Header: the **Overview button is removed** (the wordmark goes home).
- Bottom row: three equal cards: **Sub-regions** (SR1 vs SR2), **Audits conducted** (total, by quarter), **Positives**.
