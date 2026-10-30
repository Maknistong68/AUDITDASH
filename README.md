# Audits

A dashboard for directors that turns contractor HSE (health, safety and environment) audit results into a quick, honest picture: who is doing well, where the gaps are, and what to do about them. Built with Next.js 15. **The Excel workbooks are the source of truth**: every figure is imported from them.

## Screens

- **Overview** (`/`): contractors ranked, score over time (line chart by month), main problem, portfolio, repeat findings, positives. Hover any card for a second layer of detail.
- **Log** (`/log`): every observation and every audit, with search and filters (contractor, category, kind, quarter, region).
- **New audit** (`/audits/new`): upload the completed Excel checklist (read in the browser, pictures never imported, observations categorised automatically) or fill the checklist in; live score with the Excel formula.
- Drill-downs: category (where score is lost), contractor, question, observation, audit report, repeat findings, positives.

## Scoring (the Excel formula, applied honestly)

Full = 1, Partial = 0.5, No = 0, N/A excluded. A and B = points scored ÷ possible; C = mean of C1 and C2; total = mean of A, B, C.
The app computes every total from the workbook's own points. The typed Excel total is kept as `reportedScore` and shown only as a data check
(the template adds +0.012 to the total and several totals were edited by hand). Bands follow the whole % shown: 90+ Excellent, 80+ Good,
70+ Partially, 60+ Minimally, below 60 Non-Compliant.

## Local setup

```bash
npm ci
npm run dev
```

Then open http://localhost:3000.

## Regenerating mock data

Place the workbooks in `data/source/` (git-ignored), then:

```bash
pip install -r requirements-dev.txt
python3 -I scripts/import_excel.py \
  --results data/source/HS_AUDIT_FINDINGS.xlsx \
  --checklist data/source/AL_FAHD_1272_checklist.xlsx \
  --audit data/source/AL_FAHD_1272_checklist.xlsx \
  --previous data/seed/observations.json \
  --out data/seed
```

- `--results`: the findings workbook (one 10-column block per audit, one sheet per quarter and sub-region).
- `--checklist`: a checklist workbook; its Part 1 gives the questions and weights (latest template revision).
- `--audit` (repeatable): a completed checklist workbook imported as one more audit, with its Part 1 answers.
- `--previous`: keeps item codes recovered by an earlier import for notes whose code is no longer readable.

The importer prints every data check (Excel total differing from its own points, points over possible, copied blocks).

## Tests

```bash
python3 -I -m pytest tests/py -q   # importer tests; need the workbooks in data/source/
npx vitest run                     # unit tests (npm test)
npm run lint
npx playwright test                # end-to-end (npm run test:e2e)
```

The pytest importer tests read the source workbooks, so they only run where `data/source/` is populated.

## Deploy to Vercel

1. Import the GitHub repo in Vercel.
2. Framework preset: **Next.js**. Root directory: `./`.
3. Environment variables: none needed. `DATA_SOURCE` defaults to `mock`.
4. Production branch: `main`.

`npm run build` needs no network access and no secrets.

### Before sharing the Vercel link

Turn on **Vercel Deployment Protection** (Settings → Deployment Protection: Vercel Authentication, or Password Protection) before you send the link to anyone. The mock data is real audit data and the app has no login until Plan 2. Pages also send `noindex, nofollow`, but that only keeps them out of search engines; it does not stop someone with the link.

## Data note

The seed data in `data/seed/` contains real contractor and auditor names and real findings. Treat the repository as confidential and do not make it public.

## Roadmap

Plan 2: Supabase backend (with RLS) so audits entered in the app reach everyone (today they stay in the browser and download as JSON), and expiring share links for reports.
