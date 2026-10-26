# HSE Audit Dashboard (Mock-Data Phase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running, animated HSE audit dashboard (portfolio → 4 drill levels, main issues, audit reel, audit report) driven by seed data imported from the two real Excel workbooks.

**Architecture:** A Python importer turns the workbooks into `data/seed/*.json`. A Next.js App Router app reads them through a repository interface (`lib/data/`), derives every number with pure functions in `lib/analytics.ts`, and renders custom SVG charts animated with Framer Motion. Supabase, the audit wizard, share links and deploy are **Plan 2** (milestones 4–7 of the spec), not this plan.

**Tech Stack:** Python 3 + openpyxl + pytest · Next.js 15 (App Router) · TypeScript strict · Tailwind CSS v4 · Framer Motion · Vitest · Playwright (pre-installed Chromium).

**Spec:** `docs/superpowers/specs/2026-10-26-hse-audit-dashboard-design.md`

## Global Constraints
- HSE only. No UI, types or stubs for Environment, Security, Worker Welfare or CRC.
- Score = Σ(weight × value) / Σ(weight of applicable items); Full=1, Partial=0.5, No=0, N/A excluded.
- Bands (score as %): Excellent 90–100, Good 80–89, Partially Compliant 70–79, Minimally Compliant 60–69, Non-Compliant <60.
- 10 categories and code map exactly as the spec table; ids: `leadership, plans, rams, permits, competence, subcontractor, monitoring, incident, site, health`.
- Canvas designed at 1920×1080; must render without horizontal scroll or clipped hero at 1366×768. Hero (Level 1) fits one viewport; main issues + reel sit below the fold.
- Light and dark themes, toggle persisted in `localStorage` (wrapped in try/catch), default follows `prefers-color-scheme`.
- Minimal text on screen: numbers, icons, short labels; long text only at the Observation level and in the Audit Report.
- Every animation respects `prefers-reduced-motion` (instant transitions).
- Raw workbooks live in `data/source/` and are **git-ignored**; auditor phone numbers never enter seed JSON.
- `DATA_SOURCE` env defaults to `mock`; only the mock repository is built in this plan.

## Review Focus
1. Quarter/region filter that leaves zero audits (e.g. SR2 + a quarter with none) → empty-state, no NaN/`Infinity` in rings or bars.
2. Contractor audited once (no previous quarter) → league shows no trend arrow, not "+0" or a crash.
3. Category with no applicable items for an audit (e.g. B5 Utility Clearance possible = 0 → `permits` partly N/A) → excluded from the denominator, never divides by zero.
4. Deep link / browser refresh on a Level 4–5 URL → page renders directly with correct breadcrumb (no reliance on in-memory navigation state).
5. Very long observation text and multi-line Excel cells (bullets, line breaks) → preserved line breaks, no overflow outside the card at 1366×768.

---

## File Structure
```
scripts/import_excel.py            Excel → seed JSON (CLI: --results <xlsx> --checklist <xlsx> --out data/seed)
scripts/contractors.py             CONTRACTORS alias table (project string → contract no, name, subregion)
scripts/site_keywords.py           keyword → category for "Other / Site Findings"
tests/py/test_import.py            importer tests
data/seed/{checklist,contractors,audits,observations}.json   generated, committed
lib/types.ts                       domain types (below)
lib/categories.ts                  CATEGORIES, categoryForCode()
lib/scoring.ts                     scoreResponses(), bandFor()
lib/analytics.ts                   all derived numbers
lib/data/repo.ts                   Repo interface + getRepo()
lib/data/mock.ts                   JSON-backed Repo
lib/filters.ts                     parse/serialize Filter <-> URL search params
app/layout.tsx, app/globals.css    theme tokens, fonts
app/page.tsx                       Level 1 portfolio + below-fold sections
app/category/[cat]/page.tsx                                  L2
app/category/[cat]/[contractor]/page.tsx                     L3
app/category/[cat]/[contractor]/[item]/page.tsx              L4
app/category/[cat]/[contractor]/[item]/[obs]/page.tsx        L5
app/contractor/[contractor]/page.tsx                         alternate entry
app/audit/[audit]/page.tsx                                   audit report
components/shell/{TopBar,ThemeToggle,FilterBar,Breadcrumb}.tsx
components/charts/{ScoreRing,GapRadar,LeagueBars,Sparkline,SectionBars,Sunburst}.tsx
components/sections/{MainIssues,AuditReel}.tsx
components/motion/{CountUp,DrillTransition}.tsx
tests/unit/*.test.ts               vitest
tests/e2e/*.spec.ts                playwright
.claude/agents/maturity-assessor.md
```

## Shared types (`lib/types.ts`, created in Task 2, used everywhere)
```ts
export type Compliance = 'full' | 'partial' | 'no' | 'na';
export type CategoryId = 'leadership'|'plans'|'rams'|'permits'|'competence'|'subcontractor'|'monitoring'|'incident'|'site'|'health';
export type Subregion = 'SR1' | 'SR2';
export type Quarter = 'Q4-2025' | 'Q1-2026';
export type Band = 'Excellent'|'Good'|'Partially Compliant'|'Minimally Compliant'|'Non-Compliant';
export interface Category { id: CategoryId; name: string; short: string; color: string; icon: string }
export interface ChecklistItem { code: string; section: 'A'|'B'|'C'; subsection: string | null; question: string; weight: number; category: CategoryId }
export interface Contractor { id: string; name: string; contractNo: string; subregion: Subregion }
export interface SectionScore { code: string; label: string; possible: number; scored: number }
export interface Audit { id: string; contractorId: string; quarter: Quarter; date: string; location: string; inspectionNo: string; auditors: string[]; totalScore: number; sections: SectionScore[] }
export interface Observation { id: string; auditId: string; itemCode: string | null; kind: 'negative'|'positive'|'site'; text: string; category: CategoryId | null; hasPhoto: boolean }
export interface Filter { quarter: Quarter | 'all'; regions: Subregion[]; contractorId?: string }  // contractorId not in URL; used by contractor profile
```
Seed JSON files hold arrays of exactly these shapes (camelCase keys). `Audit.id` = `<contractNo>-<quarter>-<yyyymmdd>`; `Contractor.id` = contract number (e.g. `4800001112`); `SectionScore.code` ∈ `A, B, B1…B12, C, C1, C2`.

---

### Task 1: Excel importer → seed JSON

**Files:**
- Create: `scripts/import_excel.py`, `scripts/contractors.py`, `scripts/site_keywords.py`, `tests/py/test_import.py`, `requirements-dev.txt` (openpyxl, pytest), `.gitignore` (`data/source/`, `node_modules/`, `.next/`)
- Generate: `data/seed/*.json`

**Interfaces:**
- Produces: seed JSON in the shapes above; CLI `python -I scripts/import_excel.py --results data/source/HS_AUDIT_FINDINGS_SAMPLES.xlsx --checklist data/source/Excellence_HS_checklist.xlsx --out data/seed`.
- Python functions: `parse_checklist(path) -> list[dict]`, `parse_results(path) -> tuple[list[dict], list[dict], list[dict]]` (contractors, audits, observations), `category_for(code: str | None, kind: str, text: str) -> str | None`.

Parsing facts: results sheets hold side-by-side audit blocks **10 columns wide**, starting where row 0 has a cell containing `Project`; values sit in merged cells, so read "first non-empty cell after the label" within the block. Sheet name gives quarter (`Q4 2025`→`Q4-2025`) and subregion (`SUBREGION1`→`SR1`). Part 3 rows: `SR#` matching `^[ABC]\d+(\.\d+)?$` → `negative`; `Positive Observation` → `positive`; `Other / Site Findings` → `site`; continuation rows (no SR#) append to the previous observation's text with `\n`. Checklist items come from the checklist workbook's `Health & Safety` sheet (code, question, weight; section from code letter; subsection from B/C sub-headers). Normalise codes: strip spaces, and C-section sub-header `1` → `C1`.

`scripts/contractors.py` — `CONTRACTORS` maps every raw project string to a contract:
| contractNo | name | subregion | raw strings |
|---|---|---|---|
| 4800001134 | Abyatona (Box Culvert H55) | SR1 | `4800001134-ABYATONA` |
| 4800001112 | Abyatona (Zone F Culvert) | SR1 | `4800001112-ABYATONA` |
| 4800000901 | Al-Biriki | SR1 | `480000901-AL-BIRIKI` |
| 4800000838 | SIBS | SR1 | `SIBS 838`, `SIBS - 4800000838`, `800000838-SIBS` |
| 4800001322 | PPCO | SR1 | `4800001322-PPCO` |
| 4800000882 | Al Fahd (SBC Expansion) | SR1 | `4800000882-AL FAHD` |
| 4200000026 | NBC | SR1 | `4200000026 - NBC` |
| 4800001440 | RPCO | SR1 | `4800001440-RPCO` |
| 4800000892 | TDP | SR1 | `4800000892-TDP` |
| 4800001272 | Al Fahd (Coast Guard) | SR2 | `AL FAHD-4800001272` |
| 4800001131 | JV-ECH (Port T1) | SR2 | `JV-ECH-T1-4800001131` |
| 4800000876 | Sarco Disa (Port T2) | SR2 | `Design and Build for OXAGON Terminal 2 (T2) Dredging…`, `Sarco Disa - 4800000876` |
Unknown project strings raise `ValueError` naming the string.

- [ ] **Step 1: Copy the two uploaded workbooks into `data/source/` and write failing tests**

```python
def test_twenty_audits_twelve_contractors(seed): assert len(seed.audits) == 20 and len(seed.contractors) == 12
def test_totals_match_excel(seed):
    t = {a['id']: a['totalScore'] for a in seed.audits}
    assert t['4800001272-Q4-2025-20251029'] == 0.71
    assert t['4800001131-Q1-2026-20260301'] == 0.85
    assert abs(t['4800001112-Q4-2025-20251015'] - 0.620940170940171) < 1e-9
def test_sibs_has_three_audits(seed): assert sum(a['contractorId']=='4800000838' for a in seed.audits) == 3
def test_alfahd_1272_q4_counts(seed):
    obs = [o for o in seed.observations if o['auditId']=='4800001272-Q4-2025-20251029']
    assert sum(o['kind']=='positive' for o in obs) == 14 and sum(o['kind']=='site' for o in obs) == 9
def test_multiline_observation_joined(seed):  # B4.1 for Al Fahd 1272 Q4 spans several rows
    o = next(o for o in seed.observations if o['auditId']=='4800001272-Q4-2025-20251029' and o['itemCode']=='B4.1')
    assert 'permit register' in o['text'] and '\n' in o['text']
def test_checklist_weights(seed):
    w = {i['code']: i['weight'] for i in seed.checklist}
    assert sum(v for k,v in w.items() if k.startswith('A')) == 45 and w['B2.2'] == 2 and w['C2.17'] == 3
def test_every_item_has_category(seed): assert all(i['category'] for i in seed.checklist)
def test_no_phone_numbers(seed_text): assert '055-' not in seed_text
def test_site_keywords(): assert category_for(None,'site','Tower light found operational without earthing') == 'permits'
def test_site_keywords_health(): assert category_for(None,'site','Mosquito presence was observed') == 'health'
def test_site_default(): assert category_for(None,'site','Parking area requires expansion') == 'site'
def test_positive_has_no_category(): assert category_for(None,'positive','Neat offices') is None
```
`seed` fixture runs the importer into `tmp_path` and loads the four files.

- [ ] **Step 2: Run** `python -I -m pytest tests/py -q` → FAIL (module not found)
- [ ] **Step 3: Implement** `scripts/import_excel.py`, `contractors.py`, `site_keywords.py`. Code→category map lives in Python here and is mirrored in `lib/categories.ts` (Task 2 test asserts they agree by reading `data/seed/checklist.json`).
- [ ] **Step 4: Run** pytest → all PASS; run the CLI to write `data/seed/`; spot-read 10 `site` observations' categories and fix keywords if any is clearly wrong.
- [ ] **Step 5: Commit** `feat(data): import HSE workbooks into seed JSON`

### Task 2: App scaffold, domain types, categories, scoring, mock repo

**Files:**
- Create: Next.js app (`npx create-next-app@15 . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*"` then add `framer-motion`, `vitest`, `@playwright/test` pinned to the pre-installed version), `vitest.config.ts`, `lib/types.ts`, `lib/categories.ts`, `lib/scoring.ts`, `lib/data/repo.ts`, `lib/data/mock.ts`
- Test: `tests/unit/scoring.test.ts`, `tests/unit/categories.test.ts`, `tests/unit/mock.test.ts`

**Interfaces:**
- Produces:
  - `CATEGORIES: Category[]` (spec order), `categoryById(id): Category`, `categoryForCode(code: string): CategoryId`
  - `scoreResponses(items: ChecklistItem[], responses: Record<string, Compliance>): { score: number | null; possible: number; scored: number }` (null when no applicable items)
  - `bandFor(score: number): Band`
  - `interface Repo { checklist(): ChecklistItem[]; contractors(): Contractor[]; audits(): Audit[]; observations(): Observation[] }`, `getRepo(): Repo` (mock unless `DATA_SOURCE==='supabase'`, which throws "not implemented" in this plan)

- [ ] **Step 1: Failing tests**

```ts
test('ABYATONA-1112 checklist answers score 62.76%', () => {
  // fixture tests/unit/fixtures/abyatona-1112-responses.json: code→compliance copied from the checklist workbook column "Complaince"
  expect(scoreResponses(checklist, fixture).score).toBeCloseTo(0.6276068, 6);
});
test('N/A excluded', () => expect(scoreResponses([itemW3], { X: 'na' }).score).toBeNull());
test('bands', () => { expect(bandFor(0.9)).toBe('Excellent'); expect(bandFor(0.8999)).toBe('Good'); expect(bandFor(0.6276)).toBe('Minimally Compliant'); expect(bandFor(0.59)).toBe('Non-Compliant'); });
test('TS category map agrees with seed', () => checklist.forEach(i => expect(categoryForCode(i.code)).toBe(i.category)));
test('10 categories', () => expect(CATEGORIES.map(c => c.id)).toEqual(['leadership','plans','rams','permits','competence','subcontractor','monitoring','incident','site','health']));
test('mock repo loads seed', () => expect(getRepo().audits()).toHaveLength(20));
```
Note the 62.76% is the whole-checklist score; the fixture must include all A/B/C answers incl. N/A for B5.

- [ ] **Step 2: Run** `npx vitest run` → FAIL
- [ ] **Step 3: Implement** the four lib files. Category colours: pick a 10-hue categorical palette per the `dataviz` skill (load it now), validated for both themes; icons from `lucide-react`.
- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run build` → all green
- [ ] **Step 5: Commit** `feat(core): scaffold app, scoring, categories, mock repo`

### Task 3: Analytics

**Files:** Create `lib/analytics.ts`, `lib/filters.ts`; Test `tests/unit/analytics.test.ts`, `tests/unit/filters.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `Repo`.
- Produces (all pure, take `(repo: Repo, filter: Filter, …)`):
  - `filterAudits(repo, filter): Audit[]`
  - `portfolioSummary(repo, filter): { avgScore: number | null; band: Band | null; delta: number | null; audits: number; negatives: number; positives: number }` — delta = avg(Q1-2026) − avg(Q4-2025) for the filtered regions when `quarter` is `Q1-2026` or `all`; null for `Q4-2025`.
  - `categoryGaps(repo, filter): { category: CategoryId; gapRate: number | null; findings: number; prevGapRate: number | null }[]` — gapRate = negative findings on the category's items ÷ applicable item-slots (items × audits, minus items whose subsection scored `possible === 0` in that audit). `site` observations count toward findings but not slots.
  - `league(repo, filter): { contractor: Contractor; latest: number; previous: number | null }[]` sorted by `latest` desc; latest = most recent audit in filter.
  - `topIssues(repo, filter, n = 6): { itemCode: string; question: string; category: CategoryId; auditsHit: number; auditsTotal: number; byQuarter: Record<Quarter, number> }[]` sorted by auditsHit desc, then code.
  - `categoryDetail(repo, filter, cat): { contractors: { contractor: Contractor; gapRate: number; findings: number }[]; items: { itemCode: string; question: string; hits: number }[] }`
  - `contractorInCategory(repo, filter, cat, contractorId): { audits: Audit[]; items: { item: ChecklistItem; hitsByAudit: Record<string, Observation | null> }[] }`
  - `itemHistory(repo, contractorId, itemCode): { audit: Audit; observation: Observation | null }[]` (chronological)
  - `parseFilter(sp: URLSearchParams): Filter` / `filterToQuery(f: Filter): string` — params `q` (`Q4-2025|Q1-2026|all`, default `all`) and `r` (`SR1,SR2`, default both).

- [ ] **Step 1: Failing tests** (use the real seed so numbers are meaningful):

```ts
test('portfolio all', () => { const s = portfolioSummary(repo, ALL); expect(s.audits).toBe(20); expect(s.avgScore).toBeGreaterThan(0.6); expect(s.avgScore).toBeLessThan(0.75); });
test('empty filter yields nulls not NaN', () => { const s = portfolioSummary(repo, { quarter: 'Q4-2025', regions: [] }); expect(s).toMatchObject({ audits: 0, avgScore: null, band: null }); });
test('ten gaps, rates in [0,1] or null', () => { const g = categoryGaps(repo, ALL); expect(g).toHaveLength(10); g.forEach(x => x.gapRate === null || expect(x.gapRate).toBeGreaterThanOrEqual(0)); });
test('utility clearance N/A not in denominator', () => { /* audit 4800001112 Q4 has B5 possible 0 → its B5 items add no slots */ });
test('single-audit contractor has previous null', () => expect(league(repo, ALL).find(l => l.contractor.id === '4200000026')!.previous).toBeNull());
test('JV-ECH trend up', () => { const l = league(repo, ALL).find(l => l.contractor.id === '4800001131')!; expect(l.latest).toBe(0.85); expect(l.previous).toBe(0.74); });
test('top issues sorted', () => { const t = topIssues(repo, ALL); expect(t[0].auditsHit).toBeGreaterThanOrEqual(t[1].auditsHit); expect(t[0].auditsTotal).toBe(20); });
test('itemHistory chronological', () => { const h = itemHistory(repo, '4800001272', 'B4.1'); expect(h.map(x => x.audit.date)).toEqual([...h.map(x => x.audit.date)].sort()); });
test('filter round-trip', () => expect(parseFilter(new URLSearchParams(filterToQuery({ quarter: 'Q1-2026', regions: ['SR2'] })))).toEqual({ quarter: 'Q1-2026', regions: ['SR2'] }));
test('bad params fall back to defaults', () => expect(parseFilter(new URLSearchParams('q=zzz&r=XX'))).toEqual({ quarter: 'all', regions: ['SR1','SR2'] }));
```
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** · **Step 4: Run** `npx vitest run` → PASS
- [ ] **Step 5: Commit** `feat(analytics): portfolio, gaps, league, issues, drill selectors`

### Task 4: Shell, themes, Level 1 portfolio hero

**Files:** Create `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `components/shell/*`, `components/charts/{ScoreRing,GapRadar,LeagueBars}.tsx`, `components/motion/CountUp.tsx`; Test `tests/e2e/portfolio.spec.ts`, `playwright.config.ts`

**Interfaces:**
- Consumes: `getRepo`, `parseFilter`, `portfolioSummary`, `categoryGaps`, `league`, `CATEGORIES`, `bandFor`.
- Produces: `ScoreRing({ value: number | null; size: number; label?: string })`, `GapRadar({ gaps; onSelect?: (c: CategoryId) => void })` (each tile is a `Link` to `/category/<id>?<filter>` with `layoutId="cat-<id>"`), `LeagueBars({ rows })` (each bar links to `/contractor/<id>`), `CountUp({ value; format })`.

Before coding the UI, load **design-taste-frontend** (app-screen run) and **dataviz**, choose the direction for a dark command-center / light executive pair, and record tokens in `globals.css` as CSS variables on `:root` with dark overrides on `[data-theme="dark"]` and `prefers-color-scheme`. Layout: CSS grid `grid-cols-[3fr_5fr_4fr]` within `100svh` minus top bar for the hero. Worst 3 radar tiles pulse (Framer Motion, disabled under reduced motion). Band colour drives the ring.

- [ ] **Step 1: Failing e2e**

```ts
for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`hero fits ${vp.width}`, async ({ page }) => {
  await page.setViewportSize(vp); await page.goto('/');
  await expect(page.getByTestId('score-ring')).toBeVisible();
  await expect(page.getByTestId('gap-tile')).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await page.getByTestId('hero').boundingBox(); expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
});
test('theme toggle persists', async ({ page }) => { await page.goto('/'); await page.getByRole('button', { name: /theme/i }).click(); const t = await page.locator('html').getAttribute('data-theme'); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', t!); });
test('empty filter shows empty state', async ({ page }) => { await page.goto('/?q=Q4-2025&r='); await expect(page.getByTestId('empty-state')).toBeVisible(); await expect(page.locator('text=NaN')).toHaveCount(0); });
test('filter changes URL and numbers', async ({ page }) => { await page.goto('/'); await page.getByRole('button', { name: 'Q1 2026' }).click(); await expect(page).toHaveURL(/q=Q1-2026/); });
```
- [ ] **Step 2: Run** `npx playwright test tests/e2e/portfolio.spec.ts` → FAIL
- [ ] **Step 3: Implement** shell + hero.
- [ ] **Step 4: Run** e2e → PASS; take screenshots at both sizes × both themes into the scratchpad and review them against the design-taste-frontend checklist; fix what fails.
- [ ] **Step 5: Commit** `feat(ui): portfolio hero with themes, ring, gap radar, league`

### Task 5: Below the fold — Main Issues + Audit Reel

**Files:** Create `components/sections/MainIssues.tsx`, `components/sections/AuditReel.tsx`, `components/charts/Sparkline.tsx`; Modify `app/page.tsx`; Test `tests/e2e/below-fold.spec.ts`

**Interfaces:**
- Consumes: `topIssues`, `filterAudits`, `ScoreRing`.
- Produces: issue card links to `/category/<cat>?…` with the item highlighted (`#item-<code>`); reel card links to `/audit/<auditId>`.

Reel: horizontal scroll-snap, newest first, wheel → horizontal scroll, arrow buttons, cards stagger in on view. Issue card: `auditsHit/auditsTotal` big, Q4→Q1 sparkline, category chip, question truncated to 2 lines.

- [ ] **Step 1: Failing e2e** — reel has 20 cards on `/` and 8 on `/?q=Q1-2026&r=SR1`; clicking the first reel card navigates to `/audit/…`; Main Issues shows 6 cards ordered by count; page has no horizontal document scroll at 1366.
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** · **Step 4: Run** → PASS + screenshot review
- [ ] **Step 5: Commit** `feat(ui): main issues and audit reel`

### Task 6: Drill-down L2–L5 with morph transitions

**Files:** Create the four `app/category/…` pages, `components/shell/Breadcrumb.tsx`, `components/motion/DrillTransition.tsx`, `components/charts/SectionBars.tsx`; Test `tests/e2e/drill.spec.ts`

**Interfaces:**
- Consumes: `categoryDetail`, `contractorInCategory`, `itemHistory`, `categoryById`, filter helpers.
- Produces: routes — L2 `/category/[cat]`, L3 `/category/[cat]/[contractor]`, L4 `/category/[cat]/[contractor]/[item]`, L5 `…/[item]/[obs]` (obs = `Observation.id`). All server components reading the repo from params + search params, so deep links work. `Breadcrumb({ trail: { label: string; href: string }[] })`; Esc navigates to the parent crumb.

Content: L2 — category header tile (shares `layoutId` with its radar tile), contractors ranked by gap rate as animated bars, driving items list, Q4 vs Q1 gap. L3 — that contractor's items in the category as a grid of dots per audit (red = finding, green = none, grey = N/A), section bars. L4 — timeline across that contractor's audits with the observation for each. L5 — full observation text (`white-space: pre-line`), photo placeholder, category chip, link to `/audit/<id>`. Unknown params → `notFound()`.

- [ ] **Step 1: Failing e2e**

```ts
test('four-level drill and back', async ({ page }) => {
  await page.goto('/'); await page.getByTestId('gap-tile').filter({ hasText: 'Subcontractor' }).click();
  await expect(page).toHaveURL(/\/category\/subcontractor/);
  await page.getByTestId('contractor-row').first().click(); await expect(page).toHaveURL(/\/category\/subcontractor\/\d+/);
  await page.getByTestId('item-row').first().click(); await expect(page).toHaveURL(/\/category\/subcontractor\/\d+\/B6\.\d/);
  await page.getByTestId('observation-link').first().click(); await expect(page.getByTestId('observation-text')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page).toHaveURL(/\/B6\.\d(\?|$)/);
});
test('deep link L5 renders with breadcrumb', async ({ page }) => { /* goto a known obs URL from seed */ await expect(page.getByTestId('breadcrumb').locator('a')).toHaveCount(4); });
test('unknown category 404', async ({ page }) => { const r = await page.goto('/category/nope'); expect(r!.status()).toBe(404); });
test('long observation does not overflow at 1366', async ({ page }) => { /* longest seed observation */ expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); });
test('reduced motion', async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/category/rams'); await expect(page.getByTestId('contractor-row').first()).toBeVisible(); });
```
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** · **Step 4: Run** → PASS + screenshot review of each level
- [ ] **Step 5: Commit** `feat(ui): four-level drill-down with morph transitions`

### Task 7: Contractor profile + Audit Report

**Files:** Create `app/contractor/[contractor]/page.tsx`, `app/audit/[audit]/page.tsx`, `components/charts/Sunburst.tsx`; Test `tests/e2e/report.spec.ts`

**Interfaces:**
- Consumes: repo, `categoryGaps` with `Filter.contractorId` set (honoured by `filterAudits`, so Task 3 must apply it there), `SectionBars`, `ScoreRing`.
- Produces: `/contractor/[id]` — A/B/C sunburst (sections → subsections, coloured by score), 10-category mini radar linking to `/category/<cat>/<id>`, audit history rings. `/audit/[id]` — header (project, date, location, inspection no., auditors), ring + band, section bars, observation list with category filter chips and a Positives tab, `@media print` stylesheet.

- [ ] **Step 1: Failing tests** — vitest: `categoryGaps(repo, { ...ALL, contractorId: '4800001272' })` returns 10 rows using only that contractor's 2 audits. e2e: `/audit/4800001272-Q4-2025-20251029` shows 71% and "Partially Compliant"; Positives tab lists 14; selecting category chip "Permits" filters list to permits only; `/contractor/4800001131` shows two audit rings 74 and 85; unknown ids → 404.
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** · **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat(ui): contractor profile and audit report`

### Task 8: Maturity assessor + milestone gate

**Files:** Create `.claude/agents/maturity-assessor.md`, `docs/maturity/plan1.md` (generated), `README.md` (run instructions: `pip install -r requirements-dev.txt`, import command, `npm i`, `npm run dev`, tests)

**Interfaces:** Agent frontmatter `name: maturity-assessor`, `description`, `tools: Read, Grep, Glob, Bash`. Body: the six dimensions and 1–5 rubric from the spec, required evidence per dimension (test output, screenshots at 1366×768 + 1920×1080 in both themes, `scrollWidth` check, contrast via design-taste-frontend inspector, `npm run build` output), output format = table of scores + prioritised fix list written to `docs/maturity/<milestone>.md`. Dimension 6 (security/deploy) is scored "n/a — Plan 2" in this phase.

- [ ] **Step 1:** Write the agent file and README.
- [ ] **Step 2: Run full verification:** `python -I -m pytest tests/py -q && npx vitest run && npm run lint && npm run build && npx playwright test` → all green.
- [ ] **Step 3:** Dispatch the `maturity-assessor` agent; fix every item scored < 4; re-run until all scored dimensions ≥ 4.
- [ ] **Step 4:** superpowers:requesting-code-review on the branch; address findings.
- [ ] **Step 5: Commit & push** `docs: maturity assessor and plan-1 report` → `git push -u origin claude/audit-dashboard-design-4dt7ud`

---

## Amendment 1 (2026-10-26) — follows spec Revision 1
Tasks 1–3 stand. Task 4's functional shell (URL filters, themes, empty state, testids `hero`, `score-ring`,
`empty-state`) stands; its visuals are replaced. New/changed tasks, executed in this order:

### Task 3b: Analytics for scoreboard, repeats, high-risk, regions, compare
**Files:** Modify `lib/analytics.ts`; Create `lib/highRisk.ts`; Test `tests/unit/analytics-scoreboard.test.ts`
**Produces:**
- `HIGH_RISK_KEYWORDS: RegExp` and `isHighRisk(o: Observation): boolean` (category `permits`, or kind `site` matching keywords).
- `contractorCards(repo, filter): { contractor: Contractor; auditId: string; total: number; band: Band; rings: { A: number | null; B: number | null; C: number | null }; previous: number | null; rank: number }[]` sorted by total desc (rank 1-based, ties share rank). rings = latest audit SectionScore scored/possible for codes A, B, C (null when possible 0).
- `bandDistribution(repo, filter): Record<Band, number>` over contractors' latest totals (all 5 keys present).
- `repeatFindings(repo, filter): { contractor: Contractor; itemCode: string; question: string; category: CategoryId; quarters: Quarter[] }[]` per the spec definition; empty when filter.quarter === 'Q4-2025'.
- `highRiskCount(repo, filter): number` over filtered audits, N/A-excluded.
- `regionComparison(repo, filter): { region: Subregion; byQuarter: Record<Quarter, number | null> }[]` (avg totalScore; ignores filter.quarter, respects regions).
- `compareContractors(repo, filter, ids: string[]): { card: ReturnType<typeof contractorCards>[number]; gaps: ReturnType<typeof categoryGaps>; repeats: ReturnType<typeof repeatFindings> }[]` (ids order kept, unknown ids skipped, max 3).
**Tests (must include):** JV-ECH (4800001131) card total 0.85, previous 0.74, rank 1 for filter all; ring values in [0,1] or null; bandDistribution sums to number of contractors with audits; repeatFindings empty for Q4-2025 and every row's contractor has audits in both quarters; isHighRisk true for 'Tower light found operational without earthing' (site) and false for 'Mosquito presence' (site); regionComparison returns SR1 and SR2 rows with both quarter keys; compareContractors keeps order and caps at 3; empty filter → [] / zeros, no NaN.

### Task 4R2: Apple-style hero — top strip, contractor ring scoreboard, compare tray
**Files:** Modify `app/page.tsx`, `app/globals.css`, `app/layout.tsx`, shell components; Create `components/charts/ActivityRings.tsx`, `components/sections/{TopStrip,Scoreboard,ContractorCard,CompareTray}.tsx`; Test `tests/e2e/portfolio.spec.ts` (update), `tests/e2e/compare.spec.ts`
**Consumes:** Task 3b functions, `portfolioSummary`.
- Top strip testids: `kpi-score`, `kpi-bands`, `kpi-repeats`, `kpi-highrisk`. Scoreboard: 12 cards for filter all, testid `contractor-card`, each links to `/contractor/<id>` and has a select toggle (accessible name "Compare <name>"). `score-ring` testid stays on the portfolio score element inside the top strip.
- Compare tray (testid `compare-tray`) appears when ≥2 selected, max 3 (4th toggle disabled), shows rings, 10 category gaps per contractor, trend, top 3 repeat issues; selection in URL param `c=<id,id>` so it survives refresh; Esc / close button clears.
- Hero (testid `hero`) = top strip + scoreboard and must fit 1366×768 and 1920×1080 without horizontal scroll (scoreboard grid 6×2 at 1920, 4×3 or scaled at 1366).
- Remove the gap-tile list and race from the hero (gap-by-category moves below the fold in Task 5); update e2e: replace `gap-tile` count assertion with `contractor-card` count 12; keep theme, empty-state, filter tests.
- Load skills: `awesome-design-md` (read its apple.md) + `design-taste-frontend` + `dataviz`.
**Tests:** e2e: 12 cards; selecting 2 shows tray with 2 columns; 4th disabled after 3; `?c=4800001131,4800001322` deep link opens tray; Esc closes and removes `c`; empty filter shows empty state; hero fits both viewports; reduced motion renders rings at final values.
**Deliverables:** docs/screens/portfolio-*.png (4), docs/screens/portfolio-motion.webm, docs/screens/compare-1920-light.png.

### Task 5 (revised): Below the fold
Sections in order: **Where it fails** (10 categories, each links to `/category/<id>`, testid `gap-tile`, `layoutId="cat-<id>"`, single severity hue), **Region comparison** (SR1 vs SR2 per quarter, testid `region-compare`), **Main issues** (testid `issue-card`, as original Task 5), **Past audits reel** (testid `reel-card`, as original Task 5). Apple style. Original Task 5 tests apply plus: 10 `gap-tile`s below the hero; region-compare shows 2 regions.

Tasks 6–8 unchanged in scope; they follow the Apple style established by Task 4R2.

---

## Amendment 2 (2026-10-26) — follows spec Revision 2
Replaces Task 4R2's scoreboard visuals and re-scopes Tasks 5–7. Order: 4R3 → 5r2 → 6r → 7r → 8.

### Task 4R3: Bento main screen (no rings)
**Files:** Modify `app/page.tsx`, `app/globals.css`, `components/sections/*` (CompareTray keeps behaviour); Create `components/bento/{BentoGrid,ContractorsCard,MainProblemCard,ScoreCard,RepeatsCard,HighRiskCard,BandsCard,RegionCard}.tsx`, `components/charts/SectionBars.tsx` (A/B/C mini bars); Delete `ActivityRings.tsx` and the ring scoreboard; Test `tests/e2e/portfolio.spec.ts`, `tests/e2e/compare.spec.ts` (update).
**Consumes:** contractorCards, portfolioSummary, bandDistribution, repeatFindings, highRiskCount, regionComparison, categoryGaps, categoryDetail, topIssues, compareContractors.
**Add to lib/analytics.ts:** `mainProblem(repo, filter): { category: CategoryId; gapRate: number; prevGapRate: number | null; quarter: Quarter; items: { itemCode: string; question: string; hits: number }[] } | null` — worst category by score-based gap on the LATEST quarter present in the filtered audits; prevGapRate = previous quarter's gap (same regions/contractor) or null; items = top 3 by hits from categoryDetail for that quarter. Unit-test: filter all → quarter Q1-2026, category equals argmax of categoryGaps for Q1-2026; empty filter → null.
**Requirements:** testids: `hero` (bento grid, fits 1366×768 & 1920×1080, no horizontal scroll), `score-ring` stays on the portfolio score element, `contractor-row` ×12 for filter all (each links `/contractor/<id>`, compare toggle "Compare <name>"), `main-problem` (links `/category/<id>?<query>`), `kpi-repeats`, `kpi-highrisk`, `kpi-bands`, `region-compare`. XL card spans the left ~half full height; rows animate in with stagger; bar widths animate; no rings anywhere (compare tray shows A/B/C via SectionBars). Apple style tokens from 4R2 kept.
**Tests:** e2e: 12 contractor rows in descending score order; main-problem shows a category name and links correctly; compare flow still works (2 → tray, 4th disabled, `c=` deep link, Esc); hero fits; empty state; no `svg circle` ring elements inside `hero`.
**Deliverables:** regenerated docs/screens/portfolio-*.png, compare-1920-light.png, portfolio-motion.webm.

### Task 5r2: Below the fold
"Where it fails" (10 categories, testid `gap-tile`, single severity hue, link `/category/<id>`), Main issues (testid `issue-card`, link `/category/<cat>?…#item-<code>`), Past-audit reel (testid `reel-card`, newest first, scroll-snap, arrows, link `/audit/<id>`). Tests as original Task 5 (reel 20 cards for all, 8 for `?q=Q1-2026&r=SR1`; issues 6 ordered; no horizontal document scroll) plus 10 gap-tiles.

### Task 6r: Swipeable details + drill levels
Routes: `/contractor/[contractor]` (carousel of that contractor's audits within filter regions, latest first; slide = score + band + Δ, A/B/C SectionBars, 10-category gaps for that audit, findings grouped by category (capped, expandable), link "Full report" → `/audit/<id>`); `/category/[cat]` (carousel by quarter, latest first; slide = gap %, contractors ranked by gap (rows link `/category/[cat]/[contractor]`), driving items); `/category/[cat]/[contractor]` (carousel of that contractor's audits; items of the category with finding/no finding/N/A per audit; rows link to item); `/category/[cat]/[contractor]/[item]` (item history timeline); `/category/[cat]/[contractor]/[item]/[obs]` (observation full text). Carousel: drag/swipe (framer drag), ←/→ keys, prev/next buttons with accessible names, dots, current slide in URL `?s=<index>` (deep-linkable), reduced-motion = no slide animation. Breadcrumb on all, Esc → parent. Unknown params → 404. Tests: four-level drill path Main → category → contractor → item → observation and back via Esc; swipe/arrow changes slide and URL `s`; deep link `?s=1` opens earlier audit; contractor with one audit shows no arrows; unknown id 404; long observation no overflow at 1366.

### Task 7r: Audit report
`/audit/[audit]` as original Task 7's report (header, score, SectionBars, observations filterable by category chips, Positives tab, print stylesheet), Apple style. Tests: `/audit/4800001272-Q4-2025-20251029` shows 71% and "Partially Compliant", Positives tab lists 14, category chip filters, unknown id 404.

---

## Amendment 3 (2026-10-26) — follows spec Revision 3 ("Audits Only" v2)
Order: 9 → 10 → 11 → 12 → 13 → 14 → 15. Each task keeps all existing tests green and adds its own.

### Task 9: Audit types, checklists and type-aware data
- Importer: parse `Health & Safety`, `Security`, `Environment`, `Worker Welfare` sheets (same layout: section letter rows, item code | question | weight)
  and `CRC` (13 risk areas, weight 1) into `data/seed/checklists/{hs,security,environmental,welfare,crc}.json` (keep `data/seed/checklist.json` for H&S).
  pytest: counts per type > 0, codes unique per type, weights numeric, CRC has 13 items.
- `lib/types.ts`: `AuditType = 'hs'|'security'|'environmental'|'welfare'|'crc'`; `Filter.type` (default 'hs'); `Audit.type` (seed audits 'hs').
- `lib/auditTypes.ts`: labels, short labels ("H&S"), checklist loader, per-type categories (H&S = existing 10; others = their sections).
- `lib/scoring.ts`: `scoreAppAudit(type, items, answers)` per spec (Compliant 1 / Observation 0.5 / Non-Compliant 0 / N/A excluded; H&S formula; others mean of sections). Vitest incl. H&S fixture 0.6276 via mapped answers.
- `lib/filters.ts`: `t` param round-trip; invalid → 'hs'.

### Task 10: Header, tabs, + New Audit, dashboard regrid, empty tabs
- Rename to "Audits Only". Type tabs (testid `type-tabs`, buttons "H&S", "Security", "Environmental", "Welfare", "CRC"), same style as quarter tabs.
  `+ New Audit` button (testid `new-audit`) top right → `/audits/new?type=<t>`.
- Regrid the hero per spec Revision 3 (Contractors · Main Problem · Audit Overview · Audit Trends · Findings/Open Actions); no large empty areas;
  fits 1366×768 & 1920×1080, no horizontal scroll. Non-H&S tab with no audits → empty state with + New Audit.
- e2e: tabs switch `t=` and highlight; new-audit visible on every tab; empty state on Security; hero fit; inspector no FAILs.

### Task 11: Main Problem card + Driven By categories
- `gapContribution(repo, filter)` → `{ category, gapRate, share }[]` (share of total lost score, sums to ~1) for the latest quarter; vitest.
- Card titled "Main Problem – <quarter label>", strongest visual weight; Driven By = top 4 categories with share % + severity bar, links to each category;
  clicking the card animates into the controller view (shared `layoutId` / View Transitions API with fallback). e2e: title text, 4 driver rows, click → `/category/<id>`.

### Task 12: Controller view — progressive slide-down cards
- `/category/[cat]` becomes four stacked cards per spec (testids `controller-card-1..4`, `aria-expanded`); card 1 open; activating card N opens it with a
  slide-down spring and fades others; keyboard (Enter/Space, ↓/↑); reduced motion instant. Quarter switch inside card 1 (keeps `?s=`/quarter rules).
- `recommendedActions(repo, filter, cat)` extracts action sentences from notes (patterns: "contractor to", "recommend", "shall", "should", "to be"), dedupes, max 8; vitest.
- e2e: card 1 open, 2–4 collapsed+faded; click card 2 → expanded; contractor rows link to `/category/[cat]/[contractor]`; actions list non-empty for subcontractor.

### Task 13: New Audit wizard (browser storage)
- `/audits/new` + `/audits/[localId]/edit`: 4 steps with progress header, per-step validation, autosave draft (localStorage `audits-only:audits:v1`, try/catch),
  photos in IndexedDB (resized ≤1600px), Save Draft / Submit; submit computes score via `scoreAppAudit`. `lib/localAudits.ts` (pure serialise/validate + storage adapter).
- Contractor list from seed + free text; checklist from Task 9 per type; findings editor; review totals.
- e2e: create H&S draft → reload → draft restored; fill Security audit → submit → appears in My audits with score; validation blocks empty step 1.

### Task 14: My audits + client dashboards for entered audits
- "My audits" strip (drafts with Resume, submitted with score) on every tab; `/audits/local/[id]` report view (client) reusing the report layout.
- Non-H&S tabs: client-side dashboard from submitted browser audits using the same analytics over a `LocalRepo`; Findings/Open Actions card counts app findings by status.
- e2e: submit Welfare audit → Welfare tab shows score and Main Problem from it; H&S tab shows it in My audits.

### Task 15: Verification gate
Full chain green; maturity-assessor (milestone `v2`) ≥4 on scored dimensions; final whole-branch review; one fix wave; screenshots + motion video refreshed.
