# HSE Audit Dashboard

A dashboard for directors that turns contractor HSE (health, safety and environment) audit results into a quick, honest picture: who is doing well, where the gaps are, and what to do about them. Built with Next.js 15 on mock data generated from the real audit workbooks.

## Screens

- **Main bento**: portfolio overview of contractors and categories at a glance.
- **Details with swipe**: per-contractor details; swipe (or arrow keys) between that contractor's audits, latest first.
- **Category drill**: drill into a category to see where scores are lost.
- **Item / observation**: the individual checklist item and its observation.
- **Audit report**: the full report for one audit.

## Local setup

```bash
npm ci
npm run dev
```

Then open http://localhost:3000.

## Regenerating mock data

Place the two workbooks in `data/source/` (git-ignored), then:

```bash
pip install -r requirements-dev.txt
python3 -I scripts/import_excel.py \
  --results data/source/HS_AUDIT_FINDINGS_SAMPLES.xlsx \
  --checklist data/source/Excellence_HS_checklist.xlsx \
  --out data/seed
```

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

Plan 2: Supabase backend (with RLS), an audit wizard for capturing new audits, and expiring share links for reports.
