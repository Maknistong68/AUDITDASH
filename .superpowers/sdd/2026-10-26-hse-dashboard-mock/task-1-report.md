# Task 1 report: Excel importer to seed JSON

Status: DONE_WITH_CONCERNS. Commit: 3dd0c4b (branch claude/audit-dashboard-design-4dt7ud, not pushed).

## Built
- scripts/import_excel.py: parse_checklist, parse_results, main (CLI as in brief; re-inserts script dir on sys.path because `python -I` drops it).
- scripts/contractors.py: CONTRACTORS (raw string -> contract), contractor_for() raises ValueError naming unknown strings. Full T2 raw string is "Design and Build for OXAGON Terminal 2 (T2) Dredging and Quay Walls-D&B".
- scripts/site_keywords.py: CODE_CATEGORY map (from the spec table) and category_for().
- tests/py/test_import.py: the 12 brief tests + 1 extra (medicine keyword). requirements-dev.txt, .gitignore (data/source/, node_modules/, .next/, caches).
- data/seed/{contractors,audits,observations,checklist}.json: 12 contractors, 20 audits, 1421 observations (negative 1139, positive 138, site 144), 81 checklist items (A 15 / B 36 / C 30).

## Tests
`python3 -I -m pytest tests/py -q` -> 13 passed. TDD: first run failed with ModuleNotFoundError, then passed after implementation. Keyword test added later failed first, then passed after the fix.

## Site-observation spot check (10 random + health set)
Defaults/keywords fine for 9 of 10. Wrong: "ATROVENT medicine expired ... site nurse" landed in `site`; added keywords medicin|nurse|first aid to health. Remaining judgement calls: a PPE non-compliance item lands in `competence` because its text contains "training/competent"; DB panel left open and boulders on excavation slopes land in `permits` (spec keywords electrical/excavation); "workers not paid salary" stays `site` (welfare is out of scope). Final site split: site 76, permits 45, health 16, competence 7.

## Surprising data (please review)
1. Audit 4800001112-Q4-2025-20251015 (Abyatona Zone F, Q4): every Part 3 row is labelled "Positive Observations". Rows are numbered 1-17 (matches declared positive count 17), then 51 unnumbered rows follow that are really per-checklist-item notes (many read "No program found..."), and the declared negative count is `#REF!`. I keep the 17 numbered positives and DROP the 51 unnumbered rows (importer prints a warning). Result: this audit has 0 negative observations. Decision needed if you would rather keep them (e.g. as negatives with itemCode null).
2. Labels vary: "Positive Observation(s)", "Positive", "Other / Site Observation", "Other / Site Findings", "Site / Other Findings". Matching is anchored on the full short label, because a question text ("require positive verification...") also contains "positive". A positive row may carry an SR# code (SIBS Q4 A1-A4): it stays positive, itemCode kept, category null.
3. SR# "B6.1 to 6.6" (Sarco Disa Q4) becomes a negative with itemCode B6.1. Some SR# cells hold plain numbers (the 1-17 above), treated as numbering, not codes.
4. Q1 sheets pre-fill every checklist code as an SR# row; rows with no comment text and no photo are skipped (not observations). Negative counts therefore do not equal the Excel "Number of Negative Observation" cell in most audits (e.g. 1134 Q1 parsed 64 vs declared 52; SIBS Q4 81 vs 59). Positive counts match the declared cell in all 20 audits; site counts for Al Fahd 1272 Q4 are 14/9 as the brief expects. I did not try to reproduce the declared negative figure.
5. Spec text says 13 contractors; workbook and brief give 12 (tests assert 12).
6. Part 2 section scores are 17 per audit (A, B, B1-B12, C, C1, C2); N/A final scores are simply not stored (possible=0 for those, e.g. B5 in Abyatona 1112). totalScore is the sheet value (some audits are rounded to 2dp in Excel, e.g. 0.71).
7. Checklist C2 items start at C2.2 (no C2.1) in the workbook. Two observations had code C2.1 with empty text; they were dropped as template rows.
8. Auditor names are inconsistent ("J.Bernal", "G. Ahmed", extra spaces); whitespace collapsed, names otherwise untouched. Phone numbers are never read; grep for "055" in seed JSON returns nothing.

## Choices not fixed by the brief
- ChecklistItem.subsection is the sub-header code ("B1", "C1", "C2"), null for A items, so it joins to SectionScore.code. Section labels come from the Part 2 table.
- SectionScore.label is the workbook text with the "N." prefix removed (A/B/C keep upper-case names).
- Observation ids are `<auditId>-<n>`, n counted after dropped rows.
- hasPhoto = any "Picture" cell in an observation's rows (cells showing `#VALUE!` count as no photo).
- Positive observations never get a category; negatives/site with a code use the code map.

## Self-review
Diff re-read: no phone/contact reads, no sys.path leaks from data/source, scripts live outside data/source, warnings suppressed only around load_workbook. Known weak spots: keyword pass is substring based (spec list plus medicin/nurse/first aid); the unnumbered-positive drop rule is specific to the anomaly in item 1.

## Fix round 1
Changed: the 51 unnumbered "Positive Observations" rows in audit 4800001112-Q4-2025-20251015 are now imported as kind `negative` (17 numbered stay positive), with a comment naming the audit at the rule in scripts/import_excel.py. itemCode is resolved by matching the row's Observation Notes text to checklist questions (parse_results now takes the checklist); category_for now runs the keyword pass for negatives without a resolvable code (default `site`), so non-positives never have a null category. Added 2 tests (that audit: 17 positives, >=40 negatives, all categorised; every non-positive in the seed has a category).
Result: that audit has 51 negatives; itemCodes matched: 0 of 51, because the Notes column in those rows only holds the label "Positive Observations" (no question text), so all itemCode = null. Categories: site 37, permits 7, competence 4, health 3. Seed now 1472 observations.
Command: `python3 -I -m pytest tests/py -q` -> 15 passed.
