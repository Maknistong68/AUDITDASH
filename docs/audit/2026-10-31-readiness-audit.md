# Readiness audit — 31 Oct 2026

Scope: security, roles and readiness, UI/UX and accessibility, and Saudi law compliance for the HSE contractor-audit dashboard on `main` (`ed1c0ec`).
Method: four independent read-only reviews run in parallel, plus a real-browser pass (screenshots in both themes, axe-core).
The compliance section is not legal advice: a Saudi-qualified lawyer must confirm the items marked *counsel*.

## Verdict

**Good enough to show inside the team. Not ready to launch.** The dashboard is correct, fast and tested (244 unit tests and 168 browser tests pass). Three things block a launch:

1. **The GitHub repository is public and holds real client data.** This is the most urgent problem.
2. **There is no login, and there are no roles.** Anyone with the link sees everything.
3. **"Submit" in the new-audit wizard saves nothing.** It keeps a local copy and downloads a JSON file that the importer cannot read.

## 1. Fix today (critical)

| # | Finding | Evidence | Do |
|---|---|---|---|
| C1 | The repo `maknistong68/auditdash` is **public**. | GitHub API reports `"private": false`. `data/seed/*.json`, `data/contractors.csv`, test fixtures, `docs/` and `docs/screens/*.png` hold 12 real contractors, 20 audits, 8 auditor names and 1,436 observations. Those observations name NEOM and individual workers. | Make the repo private now (GitHub → Settings → Danger zone → Change visibility). Then purge the data from the git history, or start a fresh private repo and move only the code. Treat the data as already exposed: tell the client, and record the incident (PDPL breach assessment, see §5). |
| C2 | No access control. | No middleware, no auth, no users. `lib/data/repo.ts:12-16` throws for the Supabase backend. | Until real login exists, turn on **Vercel Deployment Protection for production and previews** (not previews only). Never share a public URL. |

## 2. Security

| Sev | Finding | Evidence | Do |
|---|---|---|---|
| High | Every observation's text is sent to the browser. | `app/log/page.tsx:21-28` passes the whole `buildLog(repo)` result to a client component, about 1.04 MB. Other pages also send observation text. | Once login exists, filter and page the data on the server, and send only the rows the user may see. |
| Medium | The contractor list is bundled into a public static JavaScript file. | `components/input/AuditWizard.tsx:5` and `lib/input/contractors.ts:1` import `contractors.json`. | Load it from the server after login. |
| Medium | No security headers, and `X-Powered-By: Next.js` is sent. | Response headers. | Add `headers()` to `next.config` with a CSP, `frame-ancestors 'none'`, `Referrer-Policy`, `X-Content-Type-Options: nosniff` and `Permissions-Policy`. Set `poweredByHeader: false`. |
| Low | An uploaded .xlsx can freeze the tab. | No size cap. `lib/input/xlsx.ts:127` unzips every sheet. The regex at `xlsx.ts:51` is quadratic: a 352 KB file took 11.6 s. No XXE risk. | Cap uploads at about 5 MB, unzip only the sheets needed, and replace the regex. |
| Low | Wizard drafts stay in `localStorage` unencrypted. | `lib/input/storage.ts` | Clear drafts on submit and on logout; later, store drafts on the server. |
| Low | Dependencies: 1 high (postcss, through next 15.5.x) and 1 moderate in production. | `npm audit --omit=dev` | Move to the patched Next release on a branch and run the full test suite. Real risk is low: postcss only runs at build time. |
| Low | The importer uses an unpinned `openpyxl` and no `defusedxml`. | `scripts/import_excel.py` | Pin `openpyxl` and install `defusedxml`. |
| Clean | No XSS, open redirects, leaked secrets or source maps were found. Error pages leak nothing. | — | Keep it that way. Never use `dangerouslySetInnerHTML` on audit text. |

## 3. Roles and readiness

**Roles: not ready.**
- There are no users, roles or audit trail, and the auditor's name is free text.
- Suggested roles:

| Role | Can |
|---|---|
| Executive | Read only |
| Auditor | Create and submit their own audits |
| HSE lead | Review, approve and import; manage the contractor register |
| Admin | Manage users |

- Build it with Supabase Auth, row-level security, Next middleware and an `audit_events` table that records who did what and when.

**Data flow: partly ready.**
- Strong points:
  - The importer refuses unknown contractors.
  - It checks the register.
  - It recomputes scores honestly.
- Gaps:
  - The data checks only print warnings. Add a `--strict` mode that fails.
  - The results workbook gets no duplicate-ID check.
  - `--previous` has to be passed by hand.
  - There is no diff or backup of the seed before it is overwritten.
- **The wizard's Submit is a dead end.** The screen says "Audit submitted", but nothing reaches the dashboard. Until a server write path exists, relabel the button, for example "Save draft + download". Otherwise auditors will believe they have filed an audit.

**Correctness: needs your sign-off.**
- The interim "finding" rule (`isFinding`, `lib/analytics.ts`) was checked against one audit only, and it may overcount.
- Merging same-quarter audits into one visit was approved for SIBS only, but it applies to every contractor.
- Executives need a one-line explanation of why the computed score differs from the Excel score. Consider bringing back the "based on auditor notes" label.
- Each trend line rests on only 1–2 audits per contractor. Do not present it as a trend in front of the client yet.

**Engineering:**
- No CI (`.github/` is missing).
- No `app/error.tsx` or `app/global-error.tsx`.
- No `.nvmrc`.
- Dependency versions use caret ranges.
- The Python tests need the confidential workbooks, so they cannot run in CI. They need synthetic fixtures.
- No error tracking, backups or quarter-close runbook.

## 4. UI/UX and accessibility

**Browser pass.**
- All 13 routes return 200 at 1440, 1366 and 390 px, in both themes, with no horizontal scroll.
- Landmarks, `aria-current`, the tab roles and reduced-motion handling are all done properly.
- Print gives a clean 10-page A4 report.

**axe-core violation nodes:**
- **Dark:** 0–2 per page, except `/category/subcontractor`, which has 10.
- **Light:** 6–19 per page. Almost all are colour-contrast failures.

| Sev | Finding | Evidence | Do |
|---|---|---|---|
| High | Light theme fails contrast on every page. | Unselected header tabs: #6e6e73 on #e6e6e8, ratio 4.06. Dark muted count chip: #a1a1a6 on #636366, ratio 2.32 (`/log`, `/audit`). Coral gap text on `/category`: 4.12. | Darken `--muted`/`--faint` in light, and darken the chip background in dark. This one token fix clears most of axe's list. |
| High | No "Skip to content" link. | Keyboard users press Tab 14 times before reaching content, on every page. | Add a skip link that targets `<main id>`. |
| High | The upload drop zone has no visible focus, and its file input has no label. | `components/input/StartStep.tsx:99` (`outline-none`) and `:112`. axe rates the missing label critical. | Add a `focus-visible` ring and `aria-label="Upload Excel checklist"`. Fix the nested-interactive warning on `/audits/new`. |
| High | Four type tabs (Security, Environmental, Welfare, CRC) lead to empty pages. | `/?t=security` shows "No audits yet". | Show counts ("H&S 20 · Security 0"), or mark them "Coming soon", until data exists. |
| High | No Arabic or RTL support. | `<html lang="en">` is fixed in `app/layout.tsx:32`. `'en-US'` and a hand-written month list in `lib/format.ts`. Inter has no Arabic glyphs. A forced RTL test truncates and flips arrows on the wrong side. | Start now: logical CSS properties (`ms-`/`pe-`), `Intl` formatters, `dir`, and an Arabic-capable font. |
| Medium | **A section shows 102%.** | The Excel records Planning as 21.5 / 21 in one audit (`audits.json`, audit #16). The headline score is capped, but the section row is not. | Cap the section display at 100%, and report the over-score as an Excel data issue. Ask the auditor to correct the workbook. |
| Medium | Scores read ambiguously. | "74% score lost" sits beside a contractor scoring "74%". On `/category`, "Worst 100% / Best 43%" read backwards. "Excel 85%" under a 74% headline has no explanation. | Name the polarity ("74% of points lost"), and add one line on computed vs Excel. |
| Medium | The mobile header is about 165 px of a 390 px-wide screen (3 sticky rows), and the CRC tab is clipped. On `/log`, list cards show blank for about 0.8 s after a fast scroll. | Mobile screenshots. | Collapse the filters into one "Filters" button and sheet on mobile. |
| Medium | Global filters show on single-record pages. | The type, quarter and SR filters appear on `/audit/…`, where they don't apply. | Hide or scope them there. |
| Medium | Key numbers count up for 1.5 s, so a quick glance reads a wrong value (73% vs 74%). | `lib/motion.ts:11` | Keep the calm motion for layout, but let numbers settle in about 0.6 s. |
| Low | The overview's `<h2>` is empty, and the logo is the only `<h1>`. There is no `theme-color` meta tag. | axe `empty-heading` | Give the overview a real heading, screen-reader-only if you prefer. |
| Low | In print, raw `*` and `•` bullets from Excel stay as text, and section labels are cut off. | Print PDF | Turn bullets into list items, and let labels wrap in print. |
| Low | The light-theme "Main problem" card stays dark. | Light screenshots | Use the theme tokens there too. |

## 5. Saudi law compliance

**PDPL (Personal Data Protection Law) and its Implementing Regulation: applies.**
- Auditor names are personal data.
- Worker names inside observations are personal data too, and sensitive if they relate to health or injury.

| Requirement | Status | Do |
|---|---|---|
| Lawful basis | Missing | Write a legitimate-interest assessment (*counsel*). |
| Privacy notice | Missing | Arabic and English, shown at login. |
| Data minimisation | Partly met: phone numbers are already dropped. **Worker names are kept.** | Pseudonymise worker names at import. Replace them with "Worker A", or remove them. |
| Retention and destruction | Missing | Set a retention period per record type and delete on schedule. |
| Record of processing activities | Missing | One page: what, why, who, where, how long. |
| Breach notification | Missing | Runbook: notify SDAIA within 72 hours, and the people affected when there is risk. |
| Data processing agreements | Missing | Sign DPAs with Vercel, GitHub and Supabase. |
| Cross-border transfer (Transfer Regulation, Sept 2024) | **Gap.** Vercel, GitHub and Supabase host the data outside KSA. | SDAIA standard contractual clauses plus a transfer risk assessment, or host in KSA (*counsel*). |
| DPO, and the national register of controllers | Probably not required | Write down why (*counsel*). Watch the Oct 2026 consultation on the Implementing Regulation. |
| Penalties | Fines up to SAR 5M; criminal penalties for disclosing sensitive data. | — |

**NCA controls (ECC-2:2024, CCC-2:2024, NCNICC-1:2025):**
- These apply if the client, or NEOM, is a government entity or critical national infrastructure. Ask the client.
- If they apply:
  - NDMO data classification may require hosting in KSA with a CST-registered cloud provider: STC, Oracle Jeddah/Riyadh, Google Dammam, or AWS's KSA region (expected Dec 2026).
  - Vercel and Supabase have no KSA region.
  - Also expect MFA, logging, backups and yearly reviews.
  - NEOM's supplier code may add contract clauses.

**Other rules:**
- OSH record rules (MHRSD) apply only if the app becomes the official system of record for incidents and inspections.
- The Electronic Transactions Law applies only if audits become official signed records. That would require tamper-evident records and e-signatures.
- Arabic and RTL support is strongly recommended. WCAG 2.1 AA is best practice.

## 6. What to do

**Now (this week)**
1. Make the repo private, then purge the history or start a fresh repo (C1).
2. Turn on Vercel protection for production and previews (C2).
3. Pseudonymise worker names in the importer, and replace committed data with synthetic fixtures.
4. Relabel the wizard's Submit button.
5. Add security headers, `poweredByHeader: false`, `app/error.tsx` and `global-error.tsx`.
6. Add `.nvmrc`, pin dependencies and `openpyxl`, add a `--strict` importer mode and the duplicate-ID check.
7. Add GitHub Actions: lint, typecheck, unit tests, and Playwright on synthetic data.
8. Sign off, in writing, the finding rule and the visit-merge rule.

**Before launch**
1. Supabase Auth, roles, row-level security, middleware and an `audit_events` table.
2. A real server-side submit with validation (zod), and server-side paging for the log.
3. Decide hosting and data classification with the client (KSA hosting, or SCCs plus a transfer risk assessment).
4. Paperwork: privacy notice (AR/EN), legitimate-interest assessment, record of processing, DPAs, DPO decision, retention policy, breach runbook.
5. Error tracking, backups, MFA, and a quarter-close runbook.
6. Fix the accessibility issues in §4: contrast tokens, skip link, upload focus and label, empty type tabs, the 102% cap, score wording, and the mobile filter sheet.

**After launch**
- Review and corrective-action workflow.
- Evidence uploads, stored in KSA if required.
- Arabic and RTL interface.
- Share links with expiry.
- Usage analytics.
- Periodic access reviews.

## 7. What not to do

- **Don't** share any public link or screenshot that shows real names, and don't put the dashboard on a public URL.
- **Don't** commit `data/source/` or any real export, and don't add real data to test fixtures or `docs/screens`.
- **Don't** paste named observations into foreign AI or translation tools. That is a cross-border transfer.
- **Don't** let auditors use the wizard as if it files audits, until it does.
- **Don't** present the dashboard as the official incident or inspection register, or as signed audit records, yet.
- **Don't** show the per-contractor trend to the client as a trend while it rests on 1–2 audits.
- **Don't** change the scoring rules silently. Every rule change needs the owner's sign-off and a note in `docs/requirements`.
- **Don't** pick a cloud region or new vendor before the client confirms the data classification.

## 8. Follow-up audit, same day (UX skill pass + security review of the Supabase branch)

A second pass with the VectorLab `ux-audit` skill (screenshots at 375 and 1280 px in both themes, axe-core, keyboard, reduced motion) and the `security-review` skill on the Supabase branch. Fixed in `main`:

- Keyboard: "Skip to content" link; the upload drop zone shows the house focus ring; the file input has a name; the stepper's names match their text.
- Contrast: light-theme muted text now ≥ 4.5:1 on the pill tracks; the selected view-toggle and tab counts in dark; the category tile next to the active one. axe is clean on `/`, `/log`, `/contractors`, `/audit/…`, `/audits/new`, `/repeats` in both themes.
- Reduced motion: every house tween is instant (the Log's 120 row entrances no longer run).
- Text floor: nothing below 12 px (percent marks, chart axis labels, legend chips, the uppercase labels).
- Icon buttons: tooltips on hover and keyboard focus (theme switch, resume, delete, remove note, clear search, compare), 44 px tap areas around them.
- Forms: "Submit audit" is always clickable and takes the auditor to the first missing item; "Start another audit"; a visible "Search" label on the Log from 700 px; the Security/Environmental/Welfare/CRC empty state says what will appear; the checklist's filtered-zero state has a reset.
- Anti-slop: the frosted bar has a hairline edge and an opaque fallback; light-mode shadows stay under 0.08 alpha.
- Privacy: the pseudonymiser now hides titled names in any spelling, names listed locally in `data/source/names.txt` (only their SHA-256 is committed), and writes `data/source/privacy-review.txt` for a human check after every import. 37 titled and 24 listed names are hidden in the seed.
- Supabase schema: a role counts only after the email is confirmed (no pre-sign-up takeover of an invited address, no invite-list oracle); a filed submission's content is immutable and its hash is in the audit trail.

Left as owner decisions (they change the approved design): 32 px filter chips and 41 px list rows against a 44 px tap floor; the 1.5 s motion and 80 ms stagger against the skill's 300 ms / 30 ms tokens; blur on the sticky bar; hover-only "Open" affordance on list rows; the faded category-carousel previews (axe flags their contrast); "New audit" as a noun label; `#1 … score lost` tile names that omit the delta text.
