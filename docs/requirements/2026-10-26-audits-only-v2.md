# Audits Only — v2 requirements (from the owner, 2026-10-26)

App name: **Audits Only**.

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
