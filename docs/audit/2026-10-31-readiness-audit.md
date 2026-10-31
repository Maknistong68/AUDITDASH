# Readiness audit — 31 Oct 2026

Scope: security, roles and readiness, UI/UX and accessibility, and Saudi law compliance for the HSE contractor-audit dashboard on `main` (`ed1c0ec`).
Method: four independent read-only reviews run in parallel, plus a real-browser pass (screenshots in both themes, axe-core).
The compliance section is not legal advice: a Saudi-qualified lawyer must confirm the items marked *counsel*.

## Verdict

**Good enough to show inside the team. Not ready to launch.** The dashboard is correct, fast and tested (244 unit tests and 168 browser tests pass). Three things block a launch:

1. **The GitHub repository is public, and it holds real client data.** This is the most urgent problem.
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

_See the section added below once the browser review completes._

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
6. Fix the accessibility issues in §4.

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
