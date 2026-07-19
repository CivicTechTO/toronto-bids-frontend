# Toronto Bids Archive Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fully static research archive over the Toronto Bids nightly export — ~24k prebuilt, citable record pages with faceted browse, full-text search, supplier profiles, and a first-class data-download page — deployed to GitHub Pages.

**Architecture:** A build-time prepare step (pure TypeScript) applies all data rules (award dedupe, amount tiers, keyspace scoping, supplier slugs) to `bids.json`, Astro generates the pages, Pagefind indexes the built HTML post-build, and GitHub Actions rebuilds nightly with a shrink-guard that refuses to deploy a shrunken archive. Spec: `docs/superpowers/specs/2026-07-18-frontend-design.md`.

**Tech Stack:** Astro 5 (SSG), React 19 island (@tanstack/react-table 8) for browse tables, Tailwind 4, Pagefind 1, Vitest 3 + cheerio for tests, plain `.ts` Node scripts (Node ≥ 23.6 type stripping), GitHub Pages + Actions.

## Prerequisites (backend — fixed by the maintainer BEFORE execution)

Three high-priority issues on `CivicTechTO/toronto-bids` are prerequisites, not plan tasks:

- **[#144](https://github.com/CivicTechTO/toronto-bids/issues/144)** — export carries `supplier_key` on every supplier. Blocks Task 3.
- **[#145](https://github.com/CivicTechTO/toronto-bids/issues/145)** — reference-null award_summary bids nest under `solicitations[].bids`, orphans in top-level `unlinked_bids`. Blocks Task 3.
- **[#146](https://github.com/CivicTechTO/toronto-bids/issues/146)** — nightly publish to `toronto-bids-data` releases + frontend deploy trigger. Blocks Task 22 only.

Task 3 verifies #144/#145 against a freshly regenerated export and stops with a clear message if they haven't landed. Everything through Task 21 runs against the committed fixture.

## Global Constraints

- Aggregate ONLY `*_numeric` amount fields; exclude rows with verdict `not_an_award`; label every sum as a machine-parseable undercount.
- Award rows are dual-provenance (`odata` + `ckan_awarded`) — always go through `dedupeAwards` before display or aggregation; never dedupe by (document, supplier).
- Never compare `bid_price_numeric` across different `hst_basis`; always display the basis.
- Five keyspaces never join: `document_number`, `workspace_number`, `call_number`, council `reference`, `(buyer, native_ref)`. URLs are keyspace-scoped exactly per the spec's table; cross-keyspace totals are never one number.
- `title === null` renders as `Doc <document_number> — <rfx_type>, <division>` with an explicit "no title published" marker; non-null `title_source` gets a provenance badge.
- Supplier permalinks slug `supplier_key` — never `display_name`, never `supplier_id` (rebuilt nightly, unstable).
- All internal links go through `href()` from `src/lib/url.ts` (GitHub Pages base path).
- Headline numbers are City-only and labeled; agency data segments per-buyer with `partnered`/`funding_share` badges; `value_confidential === 1` renders "value withheld (confidential attachment)".
- The build fails loudly (no deploy) on: malformed export, >20% entity-count drop vs the previous deploy, missing internal link targets, supplier slug collisions.
- Documents are listed/indexed, never served: `ariba_attachment` entries render without links; `award_summary`/`staff_report` entries link their City URL.
- Versions (caret ranges): astro ^5, @astrojs/react ^4, react ^19, @tanstack/react-table ^8, tailwindcss ^4 (+ @tailwindcss/vite), pagefind ^1, vitest ^3, cheerio ^1, typescript ^5. Node ≥ 23.6; scripts are erasable-syntax `.ts` run directly with `node`.
- Import-extension convention: relative imports in `src/` and `tests/` may be extensionless (Vitest/Astro resolve them); `.ts` extensions are REQUIRED only in `scripts/*.ts` chains executed by bare `node`.
- Unit tests: `npx vitest run` (inline literal fixtures). Site tests: `TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts` — targeted HTML assertions for each entity's record page (per the spec, these supersede golden-file snapshots), plus a dist-wide internal-link crawl and entity page-count checks in `tests/site/links.test.ts` (Task 21).

---

### Task 1: Frontend scaffold: Astro 5 + React + Tailwind 4 + Vitest + CI skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `astro.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.site.config.ts`
- Create: `.gitignore`
- Create: `src/styles/global.css`
- Create: `src/pages/index.astro` (placeholder, replaced by the real home page in Task 13)
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing (first task; the repo contains only `docs/superpowers/specs/`).
- Produces: `npm run build` = `astro build && pagefind --site dist` (used by every site task and CI); `npx vitest run` runs unit tests from `tests/prepare/**` (Tasks 2, 4–12); `npx vitest run -c vitest.site.config.ts` runs post-build tests from `tests/site/**` (Tasks 13–21); env-var conventions `SITE_URL` / `BASE_PATH` read by `astro.config.mjs`; gitignored `.data/` directory for the local export (Tasks 3, 10, 12); `.github/workflows/ci.yml` (green step by step: the unit-test step passes from this task on via `passWithNoTests`, the fixture-build step is trivially green until pages read data, the site-test step goes green in Task 13 — noted in Step 8).

All commands run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend` (no interactive `create-astro`; every config file is authored directly).

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "toronto-bids-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build && pagefind --site dist",
    "preview": "astro preview",
    "test": "vitest run",
    "test:site": "vitest run -c vitest.site.config.ts"
  },
  "dependencies": {
    "@astrojs/react": "^4",
    "@tanstack/react-table": "^8",
    "astro": "^5",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4",
    "@types/node": "^24",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "cheerio": "^1",
    "pagefind": "^1",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json` and `astro.config.mjs`**

`tsconfig.json` — `allowImportingTsExtensions` + `noEmit` because all relative imports in `src/` and `scripts/` carry explicit `.ts` extensions, so plain `node scripts/foo.ts` works via Node ≥23.6 type stripping; `verbatimModuleSyntax` forces `import type` for types, which type stripping requires:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*", "scripts/**/*", "tests/**/*"],
  "exclude": ["dist", "node_modules"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true
  }
}
```

`astro.config.mjs`:

```js
// @ts-check
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// SITE_URL / BASE_PATH let CI build the fixture site at BASE_PATH=/ while
// production deploys under the GitHub Pages project path. Default build.format
// ('directory') gives the spec's trailing-slash URLs.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://civictechto.github.io',
  base: process.env.BASE_PATH ?? '/toronto-bids-frontend',
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
```

- [ ] **Step 3: Write the two Vitest configs and `.gitignore`**

`vitest.config.ts` — unit tests only; `passWithNoTests` keeps the CI unit-test step green until Task 2 adds the first test:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/prepare/**/*.test.ts'],
    exclude: ['tests/site/**', 'node_modules/**'],
    passWithNoTests: true,
  },
});
```

`vitest.site.config.ts` — post-build HTML assertions; deliberately NO `passWithNoTests`, so a broken include glob can never silently pass once site tests exist:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/site/**/*.test.ts'],
  },
});
```

`.gitignore`:

```text
node_modules/
dist/
.astro/
.data/
.DS_Store
```

- [ ] **Step 4: Write `src/styles/global.css` and the placeholder index page**

`src/styles/global.css`:

```css
@import "tailwindcss";
```

`src/pages/index.astro`:

```astro
---
// Placeholder so the scaffold builds end to end. Replaced by the real home page
// in Task 13.
import '../styles/global.css';
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Toronto Bids Archive</title>
  </head>
  <body>
    <main class="mx-auto max-w-2xl p-8">
      <h1 class="text-2xl font-bold">Toronto Bids Archive</h1>
      <p class="mt-2">Scaffold placeholder — replaced in Task 13.</p>
    </main>
  </body>
</html>
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: ends with `added N packages` and exit 0; `package-lock.json` is created (commit it — CI's `npm ci` and `cache: npm` require it). No unresolvable peer-dependency errors (`@astrojs/react@4` + `react@19` are compatible).

- [ ] **Step 6: Verify the full build pipeline (Astro + Tailwind + Pagefind)**

Run: `npm run build && ls dist/index.html`
Expected: Astro output includes `1 page(s) built`, then Pagefind runs and logs `Indexed 1 page`; exit 0; `dist/index.html` is listed. (The build also creates the gitignored `.astro/` directory.)

- [ ] **Step 7: Verify the unit-test runner**

Run: `npx vitest run`
Expected: `No test files found, exiting with code 0` — exit 0 (via `passWithNoTests`; real tests arrive in Task 2).

- [ ] **Step 8: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Unit tests
        run: npx vitest run
      - name: Build against the committed fixture
        run: npm run build
        env:
          TB_DATA_FILE: tests/fixtures/bids.fixture.json
          BASE_PATH: /
      - name: Site tests over dist/
        run: npx vitest run -c vitest.site.config.ts
```

Note: this workflow only goes fully green as later tasks land — by design. "Unit tests" passes from this task on (`passWithNoTests`, real tests from Task 2). "Build against the committed fixture" passes now (nothing reads `TB_DATA_FILE` yet) and keeps passing once Task 3 commits the fixture and Tasks 13+ read it. "Site tests over dist/" fails with `No test files found` until Task 13 adds `tests/site/` — expected until then.

- [ ] **Step 9: Verify the workflow file**

Run: `grep -c "vitest run" .github/workflows/ci.yml`
Expected: `2`

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json astro.config.mjs vitest.config.ts vitest.site.config.ts .gitignore .github/workflows/ci.yml src/styles/global.css src/pages/index.astro && git commit -m "chore: scaffold Astro 5 + React + Tailwind 4 + Vitest + CI skeleton"
```

### Task 2: Export types + `validateExport` + loader plumbing

**Files:**
- Create: `src/prepare/types.ts`
- Create: `src/prepare/validate.ts`
- Test: `tests/prepare/validate.test.ts`

**Interfaces:**
- Consumes: scaffold from Task 1 (`npx vitest run`, tsconfig with `.ts`-extension imports).
- Produces: ALL exported interfaces in `src/prepare/types.ts`, verbatim from the contract — `SyncSource`, `Meta`, `AwardRow`, `BidRow`, `DocumentEntry`, `AribaPosting`, `Solicitation`, `NonCompetitive`, `SupplierRec`, `CompositeAward`, `BackgroundPdf`, `CouncilItem`, `SuspendedFirm`, `CapitalProject`, `AgencySolicitation`, `AgencyAward`, `AgencyBid`, `Buyer`, `ExportDoc`, plus derived `DedupedAward`, `DisplayTitle`, `SumResult`, `Bridge`, `CompositeCall`, `SupplierRollup`, `Headline`, `Prepared` — imported (never redeclared) by Tasks 3–21. `Prepared` carries two additions beyond the original contract text (binding review decisions): `wsSlugByNumber: Map<string, string>` — noncompetitive `workspace_number` → URL slug (Task 7's `wsSlug`; built with loud collision detection in Task 10's `prepare()`; consumed by Task 15's `getStaticPaths` and every `/noncompetitive/{slug}/` link) — and `dedupedAwardsByDoc` explicitly covers each solicitation's awards AND the `unlinked_awards` bucket grouped by `document_number` (nothing silently dropped). Also `export class ExportShapeError extends Error { problems: string[] }` and `export function validateExport(raw: unknown): ExportDoc` (throws `ExportShapeError` listing ALL problems) — consumed by `scripts/make-fixture.ts` (Task 3), `getPrepared()` (Task 10), and `scripts/check-shrink.ts` (Task 11). Loader plumbing established here: modules reached by bare `node scripts/*.ts` chains (Tasks 3, 11) need explicit `.ts` extensions on relative imports — this task's `validate.ts` uses them, and Step 6 verifies tsc accepts them; elsewhere in `src/` and `tests/` extensionless relative imports are equally fine (Vitest and Astro resolve both — see the plan header's import-extension convention). The data-file convention `process.env.TB_DATA_FILE ?? '.data/bids.json'` is implemented in Task 10's `getPrepared()`.

All commands run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`.

- [ ] **Step 1: Write the failing test**

`tests/prepare/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ExportDoc } from '../../src/prepare/types.ts';
import { ExportShapeError, validateExport } from '../../src/prepare/validate.ts';

/** Smallest valid post-#144/#145 export: meta + all 11 top-level arrays. */
function makeValidDoc(): any {
  return {
    meta: {
      generated_at: '2026-07-18T05:30:00',
      counts: { solicitation: 1, supplier: 1 },
      sources: [
        { source: 'odata', status: 'ok', finished_at: '2026-07-18T05:00:00', rows_fetched: 10, rows_upserted: 10 },
      ],
    },
    solicitations: [
      {
        document_number: '3524228095',
        status: 'Awarded',
        rfx_type: 'RFQ',
        noip_type: null,
        form_type: null,
        title: null,
        description: null,
        issue_date: '2024-01-15',
        submission_deadline: null,
        category: 'Goods and Services',
        division: 'Transportation Services',
        buyer_name: null,
        buyer_email: null,
        buyer_phone: null,
        wards: null,
        ariba_posting_link: null,
        source: 'odata',
        title_source: null,
        first_seen: '2026-01-01',
        last_seen: '2026-07-18',
        awards: [],
        ariba_postings: [],
        documents: [],
        bids: [],
      },
    ],
    noncompetitive: [],
    suspended_firms: [],
    suppliers: [
      {
        supplier_id: 42,
        supplier_key: 'acme paving ltd',
        display_name: 'Acme Paving Ltd.',
        variants: ['ACME PAVING LTD'],
        first_seen: '2026-01-01',
        last_seen: '2026-07-18',
      },
    ],
    capital_projects: [],
    composite_awards: [],
    council_items: [
      {
        reference: '2024.GG9.10',
        title: 'Award of RFQ',
        decision_text: 'Adopted',
        first_seen: '2026-01-01',
        last_seen: '2026-07-18',
        background_pdfs: [],
        bids: [],
      },
    ],
    unlinked_ariba_postings: [],
    unlinked_awards: [],
    unlinked_bids: [],
    buyers: [],
  };
}

function problemsOf(raw: unknown): string[] {
  try {
    validateExport(raw);
  } catch (e) {
    if (e instanceof ExportShapeError) return e.problems;
    throw e;
  }
  throw new Error('expected validateExport to throw ExportShapeError');
}

describe('validateExport', () => {
  it('returns the document typed as ExportDoc when the shape is valid', () => {
    const doc: ExportDoc = validateExport(makeValidDoc());
    expect(doc.solicitations[0]!.document_number).toBe('3524228095');
    expect(doc.suppliers[0]!.supplier_key).toBe('acme paving ltd');
  });

  it('rejects a non-object payload with a single problem', () => {
    expect(problemsOf('not an object')).toEqual(['export is not a JSON object']);
    expect(problemsOf(null)).toEqual(['export is not a JSON object']);
  });

  it('collects ALL problems instead of stopping at the first', () => {
    const raw = makeValidDoc();
    delete raw.buyers;
    delete raw.council_items;
    raw.meta.generated_at = 42;
    const problems = problemsOf(raw);
    expect(problems).toContain('meta.generated_at: missing or not a string');
    expect(problems).toContain('council_items: missing or not an array');
    expect(problems).toContain('buyers: missing or not an array');
    expect(problems).toHaveLength(3);
  });

  it('flags a pre-#145 export (solicitation missing its bids array, no unlinked_bids)', () => {
    const raw = makeValidDoc();
    delete raw.solicitations[0].bids;
    delete raw.unlinked_bids;
    const problems = problemsOf(raw);
    expect(problems).toContain('solicitations[0].bids: missing or not an array (backend issue #145 landed?)');
    expect(problems).toContain('unlinked_bids: missing or not an array (backend issue #145 landed?)');
  });

  it('flags a pre-#144 supplier missing supplier_key', () => {
    const raw = makeValidDoc();
    delete raw.suppliers[0].supplier_key;
    expect(problemsOf(raw)).toContain(
      'suppliers[0].supplier_key: missing or not a non-empty string (backend issue #144 landed?)',
    );
  });

  it('flags rows missing identity fields', () => {
    const raw = makeValidDoc();
    raw.noncompetitive = [{ supplier_name_raw: 'Acme' }];
    raw.composite_awards = [{ id: 1 }];
    const problems = problemsOf(raw);
    expect(problems).toContain('noncompetitive[0].workspace_number: missing or not a string');
    expect(problems).toContain('composite_awards[0].call_number: missing or not a string');
  });

  it('names the problem count in the error message', () => {
    const raw = makeValidDoc();
    delete raw.buyers;
    expect(() => validateExport(raw)).toThrow(ExportShapeError);
    expect(() => validateExport(raw)).toThrow(/1 problem\(s\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run`
Expected: FAIL — `Failed to resolve import "../../src/prepare/validate.ts"` (the module does not exist yet); exit code 1.

- [ ] **Step 3: Write `src/prepare/types.ts` (VERBATIM from the interface contract)**

```ts
// The shape of bids.json produced by the backend's build_export_document()
// (CivicTechTO/toronto-bids), post backend issues #144 (supplier_key on suppliers)
// and #145 (solicitations[].bids + top-level unlinked_bids). This file is the
// single source of truth for the frontend: every prepare module, page, and script
// imports these names — never redeclare, never rename.

export interface SyncSource { source: string; status: string; finished_at: string | null; rows_fetched: number; rows_upserted: number }
export interface Meta { generated_at: string; counts: Record<string, number>; sources: SyncSource[] }
export interface AwardRow { supplier_name_raw: string | null; supplier_id: number | null; award_amount: string | null; award_amount_numeric: number | null; award_amount_labelled?: number | null; award_amount_verdict?: string | null; award_date: string | null; source: string; first_seen: string; last_seen: string }
export interface BidRow { reference: string | null; document_number: string | null; bidder_name_raw: string; supplier_id: number | null; bid_price: string | null; bid_price_numeric: number | null; hst_basis: 'including' | 'excluding' | null; price_header: string | null; source: string; first_seen: string; last_seen: string }
export interface DocumentEntry { source: 'ariba_attachment' | 'award_summary' | 'staff_report'; name: string; path: string; type: string | null; size_bytes: number | null; url: string | null }
export interface AribaPosting { rfx_id: string; title: string | null; posting_type: string | null; status: string | null; customer_name: string | null; posted_date: string | null; close_date: string | null; categories: string[] | null; amount_min: string | null; amount_max: string | null; currency: string | null; public_posting_url: string | null; sourcing_url: string | null; external_rfx_id: string | null; source: string; first_seen: string; last_seen: string; document_number?: string | null }
export interface Solicitation { document_number: string; status: string; rfx_type: string | null; noip_type: string | null; form_type: string | null; title: string | null; description: string | null; issue_date: string; submission_deadline: string | null; category: string | null; division: string | null; buyer_name: string | null; buyer_email: string | null; buyer_phone: string | null; wards: string | null; ariba_posting_link: string | null; source: string; title_source: string | null; first_seen: string; last_seen: string; awards: AwardRow[]; ariba_postings: AribaPosting[]; documents: DocumentEntry[]; bids: BidRow[] }
export interface NonCompetitive { workspace_number: string; supplier_name_raw: string | null; supplier_id: number | null; reason: string | null; contract_amount: string | null; contract_amount_numeric: number | null; contract_amount_labelled?: number | null; contract_amount_verdict?: string | null; contract_date: string | null; division: string | null; council_authority_link: string | null; source: string; first_seen: string; last_seen: string }
export interface SupplierRec { supplier_id: number; supplier_key: string; display_name: string; variants: string[]; first_seen: string; last_seen: string }
export interface CompositeAward { id: number; call_number: string; call_number_raw: string | null; reference: string | null; title: string | null; supplier_name_raw: string | null; supplier_id: number | null; award_value: string | null; award_value_numeric: number | null; source: string; first_seen: string; last_seen: string }
export interface BackgroundPdf { url: string; reference: string | null; kind: string; sha256: string | null; document_number: string | null; first_seen: string; last_seen: string }
export interface CouncilItem { reference: string; title: string | null; decision_text: string | null; first_seen: string; last_seen: string; background_pdfs: BackgroundPdf[]; bids: BidRow[] }
export interface SuspendedFirm { supplier_name_raw: string; status: string | null; start_date: string | null; end_date: string | null; suspension_type: string | null; council_authority: string | null; supplier_id: number | null; source: string; first_seen: string; last_seen: string }
export interface CapitalProject { name: string; contract_number: string | null; type_of_work: string | null; scope: string | null; delivery_division: string | null; owner_division: string | null; target_sourcing_year: string | null; target_award_year: string | null; sourcing_type: string | null; estimated_range: string | null; estimated_term_months: string | null; source: string; first_seen: string; last_seen: string }
export interface AgencySolicitation { native_ref: string; title: string | null; status: string | null; posted_date: string | null; closing_date: string | null; portal_url: string | null; source: string; first_seen: string; last_seen: string }
export interface AgencyAward { native_ref: string; supplier_name_raw: string | null; supplier_id: number | null; award_amount: string | null; award_amount_numeric: number | null; value_confidential: number; award_date: string | null; report_url: string | null; source: string; first_seen: string; last_seen: string }
export interface AgencyBid { native_ref: string; bidder_name_raw: string; supplier_id: number | null; bid_price: string | null; bid_price_numeric: number | null; report_url: string | null; source: string; first_seen: string; last_seen: string }
export interface Buyer { slug: string; name: string; kind: string; partnered: number; funding_share: number | null; platform: string | null; notes: string | null; first_seen: string; last_seen: string; solicitations: AgencySolicitation[]; awards: AgencyAward[]; bids: AgencyBid[] }
export interface ExportDoc { meta: Meta; solicitations: Solicitation[]; noncompetitive: NonCompetitive[]; suspended_firms: SuspendedFirm[]; suppliers: SupplierRec[]; capital_projects: CapitalProject[]; composite_awards: CompositeAward[]; council_items: CouncilItem[]; unlinked_ariba_postings: AribaPosting[]; unlinked_awards: (AwardRow & { document_number: string })[]; unlinked_bids: BidRow[]; buyers: Buyer[] }

// ---- Derived/prepared types (produced by src/prepare/*, consumed by pages) ----

export interface DedupedAward extends AwardRow { sources: string[] }
export interface DisplayTitle { text: string; untitled: boolean }
export interface SumResult { total: number; counted: number; skipped: number }
export interface Bridge { refToDoc: Map<string, string>; docToRefs: Map<string, string[]> }
export interface CompositeCall { call_number: string; reference: string | null; title: string | null; lines: CompositeAward[]; total: SumResult }
export interface SupplierRollup {
  slug: string; supplier: SupplierRec;
  awards: { document_number: string; sol: Solicitation | null; award: DedupedAward }[];
  compositeAwards: CompositeAward[];
  noncompetitive: NonCompetitive[];
  bids: { reference: string | null; document_number: string | null; bid: BidRow }[];
  suspended: SuspendedFirm[];
  totals: { cityAwards: SumResult; composite: SumResult; noncompetitive: SumResult };
}
export interface Headline { solicitations: number; awardedTotal: SumResult; noncompetitiveTotal: SumResult; openCount: number; bidCount: number; supplierCount: number }
export interface Prepared {
  doc: ExportDoc;
  generatedAt: string;
  dedupedAwardsByDoc: Map<string, DedupedAward[]>; // per solicitation AND per distinct unlinked_awards document_number
  bridge: Bridge;
  supplierSlugById: Map<number, string>;
  wsSlugByNumber: Map<string, string>;           // noncompetitive workspace_number → URL slug (wsSlug, Task 7)
  rollupsBySlug: Map<string, SupplierRollup>;
  compositeCalls: CompositeCall[];               // grouped, sorted by call_number
  councilByRef: Map<string, CouncilItem>;
  solByDoc: Map<string, Solicitation>;
  headline: Headline;
  counts: Record<string, number>;                // countsOf(doc) — served as counts.json
}
```

- [ ] **Step 4: Write `src/prepare/validate.ts`**

```ts
import type { ExportDoc } from './types.ts';

/** Thrown by validateExport; `problems` lists EVERY shape violation found. */
export class ExportShapeError extends Error {
  problems: string[];

  constructor(problems: string[]) {
    super(`export failed shape validation, ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
    this.name = 'ExportShapeError';
    this.problems = problems;
  }
}

const TOP_LEVEL_ARRAYS = [
  'solicitations',
  'noncompetitive',
  'suspended_firms',
  'suppliers',
  'capital_projects',
  'composite_awards',
  'council_items',
  'unlinked_ariba_postings',
  'unlinked_awards',
  'unlinked_bids',
  'buyers',
] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Structural guard over a parsed bids.json. Collects every problem (missing
 * top-level keys, malformed meta, rows missing identity fields or nested
 * arrays) and throws a single ExportShapeError listing all of them, so a failed
 * nightly build reports the full damage at once. Returns the input typed as
 * ExportDoc when clean.
 */
export function validateExport(raw: unknown): ExportDoc {
  if (!isRecord(raw)) throw new ExportShapeError(['export is not a JSON object']);
  const problems: string[] = [];

  if (!isRecord(raw.meta)) {
    problems.push('meta: missing or not an object');
  } else {
    if (typeof raw.meta.generated_at !== 'string') problems.push('meta.generated_at: missing or not a string');
    if (!isRecord(raw.meta.counts)) problems.push('meta.counts: missing or not an object');
    if (!Array.isArray(raw.meta.sources)) problems.push('meta.sources: missing or not an array');
  }

  for (const key of TOP_LEVEL_ARRAYS) {
    if (!Array.isArray(raw[key])) {
      const hint = key === 'unlinked_bids' ? ' (backend issue #145 landed?)' : '';
      problems.push(`${key}: missing or not an array${hint}`);
    }
  }

  if (Array.isArray(raw.solicitations)) {
    raw.solicitations.forEach((sol: unknown, i: number) => {
      if (!isRecord(sol)) {
        problems.push(`solicitations[${i}]: not an object`);
        return;
      }
      if (typeof sol.document_number !== 'string') problems.push(`solicitations[${i}].document_number: missing or not a string`);
      if (typeof sol.issue_date !== 'string') problems.push(`solicitations[${i}].issue_date: missing or not a string`);
      for (const nested of ['awards', 'ariba_postings', 'documents', 'bids'] as const) {
        if (!Array.isArray(sol[nested])) {
          const hint = nested === 'bids' ? ' (backend issue #145 landed?)' : '';
          problems.push(`solicitations[${i}].${nested}: missing or not an array${hint}`);
        }
      }
    });
  }

  if (Array.isArray(raw.suppliers)) {
    raw.suppliers.forEach((s: unknown, i: number) => {
      if (!isRecord(s)) {
        problems.push(`suppliers[${i}]: not an object`);
        return;
      }
      if (typeof s.supplier_id !== 'number') problems.push(`suppliers[${i}].supplier_id: missing or not a number`);
      if (typeof s.supplier_key !== 'string' || s.supplier_key === '') {
        problems.push(`suppliers[${i}].supplier_key: missing or not a non-empty string (backend issue #144 landed?)`);
      }
      if (typeof s.display_name !== 'string') problems.push(`suppliers[${i}].display_name: missing or not a string`);
      if (!Array.isArray(s.variants)) problems.push(`suppliers[${i}].variants: missing or not an array`);
    });
  }

  if (Array.isArray(raw.noncompetitive)) {
    raw.noncompetitive.forEach((n: unknown, i: number) => {
      if (!isRecord(n) || typeof n.workspace_number !== 'string') {
        problems.push(`noncompetitive[${i}].workspace_number: missing or not a string`);
      }
    });
  }

  if (Array.isArray(raw.council_items)) {
    raw.council_items.forEach((c: unknown, i: number) => {
      if (!isRecord(c)) {
        problems.push(`council_items[${i}]: not an object`);
        return;
      }
      if (typeof c.reference !== 'string') problems.push(`council_items[${i}].reference: missing or not a string`);
      if (!Array.isArray(c.background_pdfs)) problems.push(`council_items[${i}].background_pdfs: missing or not an array`);
      if (!Array.isArray(c.bids)) problems.push(`council_items[${i}].bids: missing or not an array`);
    });
  }

  if (Array.isArray(raw.composite_awards)) {
    raw.composite_awards.forEach((c: unknown, i: number) => {
      if (!isRecord(c) || typeof c.call_number !== 'string') {
        problems.push(`composite_awards[${i}].call_number: missing or not a string`);
      }
    });
  }

  if (Array.isArray(raw.buyers)) {
    raw.buyers.forEach((b: unknown, i: number) => {
      if (!isRecord(b)) {
        problems.push(`buyers[${i}]: not an object`);
        return;
      }
      if (typeof b.slug !== 'string') problems.push(`buyers[${i}].slug: missing or not a string`);
      for (const nested of ['solicitations', 'awards', 'bids'] as const) {
        if (!Array.isArray(b[nested])) problems.push(`buyers[${i}].${nested}: missing or not an array`);
      }
    });
  }

  if (problems.length > 0) throw new ExportShapeError(problems);
  return raw as unknown as ExportDoc;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run`
Expected: PASS — 1 test file, 7 tests passed; exit 0.

- [ ] **Step 6: Verify the type-checker and the `.ts`-extension import plumbing**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0 (proves `verbatimModuleSyntax` + `allowImportingTsExtensions` accept the `./types.ts`-style imports that Node type stripping needs in Task 3's script).

- [ ] **Step 7: Commit**

```bash
git add src/prepare/types.ts src/prepare/validate.ts tests/prepare/validate.test.ts && git commit -m "feat: export types and validateExport shape guard"
```

### Task 3: Fixture generator + committed fixture (requires backend issues #144+#145 landed; regenerate export via `cd /Users/alex/code/projects/toronto-bids/toronto-bids/scrapers && uv run tb export`)

**Files:**
- Create: `scripts/make-fixture.ts`
- Create: `tests/fixtures/bids.fixture.json` (generated by the script, committed)
- Regenerates (gitignored, not committed): `.data/bids.json`

**Interfaces:**
- Consumes: `validateExport` / `ExportShapeError` and the types from Task 2 (`ExportDoc`, `Solicitation`, `CouncilItem`, `CompositeAward`, `Buyer`). PREREQUISITE (not a plan task): backend issues **#144** (`supplier_key` on exported suppliers) and **#145** (`solicitations[].bids` + top-level `unlinked_bids`) landed in `CivicTechTO/toronto-bids` — Steps 1–2 regenerate the export and verify both, and this task STOPS if either is missing.
- Produces: `tests/fixtures/bids.fixture.json` — consumed by ci.yml's fixture build (Task 1), Task 10's integration test, and all site tests (Tasks 13–21); `scripts/make-fixture.ts` for later regeneration; a fresh full export at `.data/bids.json`, the default local data file for `getPrepared()` (Task 10) and full-data builds (Task 22's checklist).

Commands run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend` except Step 1, which runs in the backend repo.

- [ ] **Step 1: Regenerate the backend export into the frontend's `.data/` directory**

Runs in the BACKEND repo. Writing straight to the frontend's gitignored `.data/bids.json` gives both this task's input and the local dev data file in one step.

Run: `cd /Users/alex/code/projects/toronto-bids/toronto-bids/scrapers && uv run tb export --out /Users/alex/code/projects/toronto-bids/toronto-bids-frontend/.data/bids.json`
Expected: `Exported 7444 solicitations to /Users/alex/code/projects/toronto-bids/toronto-bids-frontend/.data/bids.json` (the count drifts upward as the archive syncs; ~7,444 as of 2026-07-18). Takes under a minute.

- [ ] **Step 2: Verify backend prerequisites #144 and #145 in the fresh export — STOP if missing**

Run (frontend repo):

```bash
node -e '
const fs = require("node:fs");
const doc = JSON.parse(fs.readFileSync(".data/bids.json", "utf8"));
const noKey = (doc.suppliers ?? []).filter((s) => typeof s.supplier_key !== "string" || s.supplier_key === "").length;
const solsWithBidsArray = (doc.solicitations ?? []).filter((s) => Array.isArray(s.bids)).length;
const nestedBids = (doc.solicitations ?? []).reduce((n, s) => n + (Array.isArray(s.bids) ? s.bids.length : 0), 0);
if (noKey > 0) { console.error(`STOP: ${noKey} suppliers lack supplier_key — backend issue #144 is NOT landed in CivicTechTO/toronto-bids. Land it there, re-run Step 1, then retry. Do not proceed with Task 3.`); process.exit(1); }
if (solsWithBidsArray !== (doc.solicitations ?? []).length || !Array.isArray(doc.unlinked_bids)) { console.error("STOP: solicitations[].bids and/or unlinked_bids missing — backend issue #145 is NOT landed in CivicTechTO/toronto-bids. Land it there, re-run Step 1, then retry. Do not proceed with Task 3."); process.exit(1); }
console.log(`prerequisites OK: all ${doc.suppliers.length} suppliers carry supplier_key; ${nestedBids} solicitation-nested bids; ${doc.unlinked_bids.length} unlinked_bids`);
'
```

Expected: `prerequisites OK: all 7744 suppliers carry supplier_key; N solicitation-nested bids; M unlinked_bids` where N + M ≈ 1,028 (the reference-null award_summary bids) and N > 0.
If it prints a `STOP:` line instead: halt this task and the plan here. The backend issues must be fixed in `CivicTechTO/toronto-bids` first — do NOT work around the missing fields in the frontend.

- [ ] **Step 3: Write `scripts/make-fixture.ts`**

Implements the fixture selection criteria: picks by CRITERIA (never hardcoded IDs), computes the referential closure (council-bid `document_number` → solicitation; every referenced `supplier_id` → supplier; `suspended_firm.council_authority` → council item), injects two synthetic buyers, recomputes `meta.counts` from the fixture's own arrays (the backend's 16 sqlite table names), keeps 3 sync_run rows, validates with `validateExport`, and writes deterministically.

```ts
// Samples a full bids.json export down to a small committed fixture
// (tests/fixtures/bids.fixture.json) by CRITERIA — never by hardcoded IDs — so
// it can be regenerated from any sufficiently fresh export. Deterministic for a
// given input file: selection is first-match over the export's own (ORDER BY)
// array order. Requires an export produced AFTER backend issues #144
// (supplier_key) and #145 (solicitations[].bids + unlinked_bids); validateExport
// enforces both on the input.
//
// Usage (frontend repo root): node scripts/make-fixture.ts .data/bids.json

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateExport } from '../src/prepare/validate.ts';
import type {
  Buyer,
  CompositeAward,
  CouncilItem,
  ExportDoc,
  Solicitation,
} from '../src/prepare/types.ts';

const OUT = 'tests/fixtures/bids.fixture.json';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('usage: node scripts/make-fixture.ts <path-to-full-export>');
  process.exit(1);
}

const doc: ExportDoc = validateExport(JSON.parse(readFileSync(inputPath, 'utf8')));

const solByDoc = new Map<string, Solicitation>(doc.solicitations.map((s) => [s.document_number, s]));
const councilByRef = new Map<string, CouncilItem>(doc.council_items.map((c) => [c.reference, c]));

const report: string[] = [];
const missing: string[] = [];
const pickedDocs = new Set<string>();
const pickedRefs = new Set<string>();

function pickSol(label: string, required: boolean, pred: (s: Solicitation) => boolean): void {
  const found = doc.solicitations.find(pred);
  if (found) {
    pickedDocs.add(found.document_number);
    report.push(`${label}: solicitation ${found.document_number}`);
  } else if (required) {
    missing.push(label);
  } else {
    report.push(`${label}: none in source (skipped)`);
  }
}

// --- Solicitation criteria ---
pickSol('untitled with dual-source awards', true, (s) =>
  s.title === null
  && s.awards.some((a) => a.source === 'odata')
  && s.awards.some((a) => a.source === 'ckan_awarded'));
pickSol('titled with recovered title_source', true, (s) => s.title !== null && s.title_source !== null);
pickSol('ariba_attachment document with nested (zip-in-zip) path', true, (s) =>
  s.documents.some((d) => d.source === 'ariba_attachment' && d.path.includes('/')));
pickSol('award_summary/staff_report document with a live URL', true, (s) =>
  s.documents.some((d) => (d.source === 'award_summary' || d.source === 'staff_report') && d.url !== null));
pickSol('Open with an Ariba posting', true, (s) => s.status === 'Open' && s.ariba_postings.length > 0);
pickSol('solicitation-nested award_summary bids (#145)', true, (s) => s.bids.length > 0);
pickSol('award row with a human verdict', false, (s) => s.awards.some((a) => a.award_amount_verdict != null));

// --- Council items ---
// Bridged item with mixed hst_basis: among qualifying items, take the one whose
// bids reference the fewest distinct existing solicitations (keeps the closure
// small); tie-break on reference for determinism.
function referencedDocs(c: CouncilItem): Set<string> {
  const s = new Set<string>();
  for (const b of c.bids) {
    if (b.document_number !== null && solByDoc.has(b.document_number)) s.add(b.document_number);
  }
  return s;
}
const qualifying = doc.council_items.filter((c) =>
  c.bids.some((b) => b.hst_basis === 'including')
  && c.bids.some((b) => b.hst_basis === 'excluding')
  && referencedDocs(c).size > 0);
qualifying.sort((a, b) =>
  referencedDocs(a).size - referencedDocs(b).size
  || (a.reference < b.reference ? -1 : a.reference > b.reference ? 1 : 0));
const bridged = qualifying[0];
if (bridged) {
  pickedRefs.add(bridged.reference);
  report.push(`council item with mixed hst_basis bridged to solicitation(s): ${bridged.reference}`);
} else {
  missing.push('council item with mixed hst_basis bridged to a solicitation');
}

const pre2019 = doc.council_items.find((c) =>
  Number(c.reference.slice(0, 4)) < 2019
  && c.bids.length > 0
  && c.bids.every((b) => b.document_number === null));
if (pre2019) {
  pickedRefs.add(pre2019.reference);
  report.push(`pre-2019 council item, bids without document_number: ${pre2019.reference}`);
} else {
  missing.push('pre-2019 council item whose bids have document_number: null');
}

// suspended_firm.council_authority -> council_item closure (graceful when the
// authority string does not resolve to a council reference in the export).
for (const firm of doc.suspended_firms) {
  const auth = firm.council_authority;
  if (auth === null) continue;
  const ref = councilByRef.has(auth) ? auth : (auth.match(/\d{4}\.[A-Z]{1,3}\d+\.\d+/)?.[0] ?? null);
  if (ref !== null && councilByRef.has(ref)) {
    pickedRefs.add(ref);
    report.push(`council item cited by suspended firm "${firm.supplier_name_raw}": ${ref}`);
  }
}

// --- Referential closure: every solicitation referenced by an included council
// item's bids (and existing in the export) is included, so council->solicitation
// links inside the fixture site always resolve. ---
for (const ref of pickedRefs) {
  const item = councilByRef.get(ref);
  if (!item) continue;
  for (const d of referencedDocs(item)) pickedDocs.add(d);
}

// --- Non-competitive: prefer a row with a stated reason and a parsed amount ---
const nc = doc.noncompetitive.find((n) => n.reason !== null && n.contract_amount_numeric !== null)
  ?? doc.noncompetitive[0];
if (nc) report.push(`noncompetitive: ${nc.workspace_number}`);
else missing.push('one noncompetitive row');

// --- Composite call with >=2 distinct winners (first in call_number order) ---
const byCall = new Map<string, CompositeAward[]>();
for (const line of doc.composite_awards) {
  const arr = byCall.get(line.call_number) ?? [];
  arr.push(line);
  byCall.set(line.call_number, arr);
}
let compositeLines: CompositeAward[] = [];
for (const [call, lines] of byCall) {
  if (new Set(lines.map((l) => l.supplier_name_raw)).size >= 2) {
    compositeLines = lines;
    report.push(`composite call with >=2 winners: ${call} (${lines.length} lines)`);
    break;
  }
}
if (compositeLines.length === 0) missing.push('composite call with >=2 winners');

if (missing.length > 0) {
  console.error('STOP: could not satisfy required fixture criteria:\n- ' + missing.join('\n- '));
  process.exit(1);
}

// --- Assemble output arrays, preserving the export's own deterministic order ---
const solicitations = doc.solicitations.filter((s) => pickedDocs.has(s.document_number));
const councilItems = doc.council_items.filter((c) => pickedRefs.has(c.reference));
const noncompetitive = nc ? [nc] : [];
const suspendedFirms = doc.suspended_firms;
const capitalProjects = doc.capital_projects.slice(0, 3);
const unlinkedPostings = doc.unlinked_ariba_postings.slice(0, 2);

// --- Synthetic buyers (the real export's buyers array is empty today) ---
const SEEN = '2026-07-18T00:00:00';
const buyers: Buyer[] = [
  {
    slug: 'toronto-zoo-test',
    name: 'Toronto Zoo (synthetic test buyer)',
    kind: 'agency',
    partnered: 0,
    funding_share: null,
    platform: 'bidsandtenders',
    notes: 'Synthetic fixture row for empty-state buyer pages. Not real data.',
    first_seen: SEEN,
    last_seen: SEEN,
    solicitations: [],
    awards: [],
    bids: [],
  },
  {
    slug: 'trca-test',
    name: 'Toronto and Region Conservation Authority (synthetic test buyer)',
    kind: 'agency',
    partnered: 1,
    funding_share: 0.626,
    platform: 'city_partnered',
    notes: 'Synthetic fixture row: partnered buyer with a confidential-value award. Not real data.',
    first_seen: SEEN,
    last_seen: SEEN,
    solicitations: [{
      native_ref: 'TRCA-2026-001',
      title: 'Erosion control works (synthetic)',
      status: 'Closed',
      posted_date: '2026-06-01',
      closing_date: '2026-06-20',
      portal_url: null,
      source: 'synthetic',
      first_seen: SEEN,
      last_seen: SEEN,
    }],
    awards: [{
      native_ref: 'TRCA-2026-001',
      supplier_name_raw: 'Synthetic Shoreline Contracting Inc.',
      supplier_id: null,
      award_amount: null,
      award_amount_numeric: null,
      value_confidential: 1,
      award_date: '2026-07-02',
      report_url: null,
      source: 'synthetic',
      first_seen: SEEN,
      last_seen: SEEN,
    }],
    bids: [],
  },
];

// --- Supplier closure: every supplier_id referenced by any included row ---
const supplierIds = new Set<number>();
function addId(id: number | null): void {
  if (id !== null) supplierIds.add(id);
}
for (const s of solicitations) {
  for (const a of s.awards) addId(a.supplier_id);
  for (const b of s.bids) addId(b.supplier_id);
}
for (const c of councilItems) for (const b of c.bids) addId(b.supplier_id);
for (const n of noncompetitive) addId(n.supplier_id);
for (const l of compositeLines) addId(l.supplier_id);
for (const f of suspendedFirms) addId(f.supplier_id);
const suppliers = doc.suppliers.filter((s) => supplierIds.has(s.supplier_id));

const fixture: ExportDoc = {
  meta: {
    generated_at: doc.meta.generated_at,
    counts: {}, // recomputed below from the fixture's own arrays
    sources: doc.meta.sources.slice(0, 3),
  },
  solicitations,
  noncompetitive,
  suspended_firms: suspendedFirms,
  suppliers,
  capital_projects: capitalProjects,
  composite_awards: compositeLines,
  council_items: councilItems,
  unlinked_ariba_postings: unlinkedPostings,
  unlinked_awards: [],
  unlinked_bids: [],
  buyers,
};

// meta.counts mirrors the backend's 16 sqlite table names (db.counts), recomputed
// so count-based UI and tests over the fixture stay truthful.
function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}
fixture.meta.counts = {
  solicitation: fixture.solicitations.length,
  award: sum(fixture.solicitations.map((s) => s.awards.length)) + fixture.unlinked_awards.length,
  noncompetitive: fixture.noncompetitive.length,
  ariba_posting: sum(fixture.solicitations.map((s) => s.ariba_postings.length)) + fixture.unlinked_ariba_postings.length,
  suspended_firm: fixture.suspended_firms.length,
  supplier: fixture.suppliers.length,
  capital_project: fixture.capital_projects.length,
  bid: sum(fixture.council_items.map((c) => c.bids.length)) + sum(fixture.solicitations.map((s) => s.bids.length)) + fixture.unlinked_bids.length,
  council_item: fixture.council_items.length,
  background_pdf: sum(fixture.council_items.map((c) => c.background_pdfs.length)),
  composite_award: fixture.composite_awards.length,
  sync_run: fixture.meta.sources.length,
  buyer: fixture.buyers.length,
  agency_solicitation: sum(fixture.buyers.map((b) => b.solicitations.length)),
  agency_award: sum(fixture.buyers.map((b) => b.awards.length)),
  agency_bid: sum(fixture.buyers.map((b) => b.bids.length)),
};

validateExport(fixture); // throws ExportShapeError if the fixture itself is malformed

for (const line of report) console.log(line);
console.log('fixture passes validateExport');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n');
console.log(
  `wrote ${OUT} — ${fixture.solicitations.length} solicitations, ${fixture.council_items.length} council items, `
  + `${fixture.noncompetitive.length} noncompetitive, ${fixture.composite_awards.length} composite lines, `
  + `${fixture.suspended_firms.length} suspended firms, ${fixture.capital_projects.length} capital projects, `
  + `${fixture.suppliers.length} suppliers, ${fixture.buyers.length} buyers`,
);
```

- [ ] **Step 4: Type-check the script**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Run the generator**

Run: `node scripts/make-fixture.ts .data/bids.json`
Expected: one report line per criterion naming a real record id (exact ids and counts depend on the live export), no `STOP` and no `none in source` lines — except `award row with a human verdict: none in source (skipped)` is acceptable — then `fixture passes validateExport` and a final `wrote tests/fixtures/bids.fixture.json — ...` summary. Example shape:

```
untitled with dual-source awards: solicitation 3524228095
titled with recovered title_source: solicitation 6033543189
...
council item with mixed hst_basis bridged to solicitation(s): 2020.GG17.4
pre-2019 council item, bids without document_number: 2015.BA47.1
noncompetitive: 2023-0456
composite call with >=2 winners: 3405-09-3197 (3 lines)
fixture passes validateExport
wrote tests/fixtures/bids.fixture.json — 9 solicitations, 3 council items, 1 noncompetitive, 3 composite lines, 3 suspended firms, 3 capital projects, 21 suppliers, 2 buyers
```

If it prints `STOP: could not satisfy required fixture criteria`, halt and investigate the export before proceeding — do not weaken the criteria.

- [ ] **Step 6: Verify the fixture satisfies every selection criterion**

Run:

```bash
node -e '
const fs = require("node:fs");
const doc = JSON.parse(fs.readFileSync("tests/fixtures/bids.fixture.json", "utf8"));
const full = JSON.parse(fs.readFileSync(".data/bids.json", "utf8"));
const fullDocs = new Set(full.solicitations.map((s) => s.document_number));
const sols = doc.solicitations;
let failed = false;
const has = (label, ok) => { console.log((ok ? "ok      " : "MISSING ") + label); if (!ok) failed = true; };
has("untitled sol with dual-source awards", sols.some((s) => s.title === null && s.awards.some((a) => a.source === "odata") && s.awards.some((a) => a.source === "ckan_awarded")));
has("titled sol with title_source provenance", sols.some((s) => s.title !== null && s.title_source !== null));
has("ariba_attachment doc with / in path", sols.some((s) => s.documents.some((d) => d.source === "ariba_attachment" && d.path.includes("/"))));
has("award_summary/staff_report doc with live URL", sols.some((s) => s.documents.some((d) => (d.source === "award_summary" || d.source === "staff_report") && d.url)));
has("Open sol with an ariba posting", sols.some((s) => s.status === "Open" && s.ariba_postings.length > 0));
has("sol with nested award_summary bids", sols.some((s) => s.bids.length > 0));
has("council item with mixed hst_basis bridged to an included sol", doc.council_items.some((c) => c.bids.some((b) => b.hst_basis === "including") && c.bids.some((b) => b.hst_basis === "excluding") && c.bids.some((b) => b.document_number && sols.some((s) => s.document_number === b.document_number))));
has("closure: council bid docs existing in the full export are included", doc.council_items.every((c) => c.bids.every((b) => b.document_number === null || !fullDocs.has(b.document_number) || sols.some((s) => s.document_number === b.document_number))));
has("pre-2019 council item, all bids without document_number", doc.council_items.some((c) => Number(c.reference.slice(0, 4)) < 2019 && c.bids.length > 0 && c.bids.every((b) => b.document_number === null)));
has("one noncompetitive", doc.noncompetitive.length === 1);
has("composite: exactly one call, >=2 distinct winners", new Set(doc.composite_awards.map((a) => a.call_number)).size === 1 && new Set(doc.composite_awards.map((a) => a.supplier_name_raw)).size >= 2);
has("all 3 suspended firms", doc.suspended_firms.length === 3);
has("3 capital projects", doc.capital_projects.length === 3);
has("2 unlinked ariba postings", doc.unlinked_ariba_postings.length === 2);
has("synthetic toronto-zoo-test buyer, partnered 0", doc.buyers.some((b) => b.slug === "toronto-zoo-test" && b.partnered === 0));
has("synthetic partnered buyer, funding_share 0.626, confidential award", doc.buyers.some((b) => b.partnered === 1 && b.funding_share === 0.626 && b.awards.some((a) => a.value_confidential === 1)));
has("suppliers closed over included rows, all with supplier_key", doc.suppliers.length > 0 && doc.suppliers.every((s) => typeof s.supplier_key === "string" && s.supplier_key.length > 0));
has("meta.counts recomputed (spot check)", doc.meta.counts.solicitation === sols.length && doc.meta.counts.council_item === doc.council_items.length && doc.meta.counts.supplier === doc.suppliers.length && doc.meta.counts.sync_run === doc.meta.sources.length);
has("3 sync_run rows kept", doc.meta.sources.length === 3);
console.log("verdict award present (optional): " + sols.some((s) => s.awards.some((a) => a.award_amount_verdict != null)));
console.log(`sizes: ${sols.length} sols, ${doc.council_items.length} council, ${doc.suppliers.length} suppliers`);
process.exit(failed ? 1 : 0);
'
```

Expected: all 19 checked lines start with `ok`, none with `MISSING`; two informational lines follow; exit code 0.

- [ ] **Step 7: Verify determinism (same input → byte-identical fixture)**

Run: `node scripts/make-fixture.ts .data/bids.json >/dev/null && shasum tests/fixtures/bids.fixture.json && node scripts/make-fixture.ts .data/bids.json >/dev/null && shasum tests/fixtures/bids.fixture.json`
Expected: the two printed SHA-1 hashes are identical.

- [ ] **Step 8: Commit**

```bash
git add scripts/make-fixture.ts tests/fixtures/bids.fixture.json && git commit -m "feat: fixture generator and committed bids fixture"
```

(`.data/bids.json` stays uncommitted — it is gitignored by Task 1.)

### Task 4: `amounts.ts` — formatCAD + sumAwardNumeric

**Files:**
- Create: `src/prepare/amounts.ts`
- Test: `tests/prepare/amounts.test.ts`

**Interfaces:**
- Consumes: `SumResult` from `src/prepare/types.ts` (Task 2).
- Produces: `formatCAD(n: number): string` (en-CA `"$1,234,567.89"`) and `sumAwardNumeric(rows: { numeric: number | null; verdict: string | null | undefined }[]): SumResult` — consumed by Task 8 (rollup totals), Task 9 (index totals), Task 10 (headline), and Tasks 13–18 (display). Implements data rule 2: aggregate only the `*_numeric` tier, exclude verdict `not_an_award`, count every skip so sums can be labelled as machine-parseable undercounts.

- [ ] **Step 1: Write the failing test for formatCAD**

Create `tests/prepare/amounts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatCAD } from '../../src/prepare/amounts.ts';

describe('formatCAD', () => {
  it('formats with $ prefix, comma thousands, two decimals (en-CA)', () => {
    expect(formatCAD(1234567.89)).toBe('$1,234,567.89');
  });

  it('pads whole numbers to two decimals', () => {
    expect(formatCAD(1000)).toBe('$1,000.00');
  });

  it('formats zero', () => {
    expect(formatCAD(0)).toBe('$0.00');
  });

  it('rounds sub-cent values', () => {
    expect(formatCAD(31.654)).toBe('$31.65');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/amounts.test.ts`
Expected: FAIL with `Error: Failed to resolve import "../../src/prepare/amounts.ts" from "tests/prepare/amounts.test.ts". Does the file exist?`

- [ ] **Step 3: Implement formatCAD**

Create `src/prepare/amounts.ts`:

```ts
import type { SumResult } from './types.ts';

const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

/** Format a number as Canadian dollars, en-CA locale: "$1,234,567.89". */
export function formatCAD(n: number): string {
  return cad.format(n);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/amounts.test.ts`
Expected: PASS — `Test Files  1 passed (1)`, `Tests  4 passed (4)`

- [ ] **Step 5: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/amounts.ts tests/prepare/amounts.test.ts && git commit -m "feat: add formatCAD (en-CA currency formatting)"
```

- [ ] **Step 6: Write the failing tests for sumAwardNumeric**

In `tests/prepare/amounts.test.ts`, replace the import line

```ts
import { formatCAD } from '../../src/prepare/amounts.ts';
```

with

```ts
import { formatCAD, sumAwardNumeric } from '../../src/prepare/amounts.ts';
```

and append at the end of the file:

```ts
describe('sumAwardNumeric', () => {
  it('returns zeros for an empty list', () => {
    expect(sumAwardNumeric([])).toEqual({ total: 0, counted: 0, skipped: 0 });
  });

  it('sums numeric values and counts them', () => {
    const rows = [
      { numeric: 100.5, verdict: null },
      { numeric: 200.25, verdict: undefined },
    ];
    expect(sumAwardNumeric(rows)).toEqual({ total: 300.75, counted: 2, skipped: 0 });
  });

  it('skips null numerics but counts each skip', () => {
    const rows = [
      { numeric: 500, verdict: null },
      { numeric: null, verdict: null }, // raw was "kj" or "31.65/MT" — unparseable
      { numeric: null, verdict: undefined },
    ];
    expect(sumAwardNumeric(rows)).toEqual({ total: 500, counted: 1, skipped: 2 });
  });

  it("skips verdict 'not_an_award' even when a numeric is present", () => {
    const rows = [
      { numeric: 1000, verdict: 'not_an_award' },
      { numeric: 250, verdict: null },
    ];
    expect(sumAwardNumeric(rows)).toEqual({ total: 250, counted: 1, skipped: 1 });
  });

  it('counts rows with any other verdict normally', () => {
    const rows = [{ numeric: 42, verdict: 'plausible' }];
    expect(sumAwardNumeric(rows)).toEqual({ total: 42, counted: 1, skipped: 0 });
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/amounts.test.ts`
Expected: FAIL — the file fails to load because `amounts.ts` has no `sumAwardNumeric` export (error names the missing export, e.g. `does not provide an export named 'sumAwardNumeric'`).

- [ ] **Step 8: Implement sumAwardNumeric**

Replace `src/prepare/amounts.ts` with the complete final module:

```ts
import type { SumResult } from './types.ts';

const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

/** Format a number as Canadian dollars, en-CA locale: "$1,234,567.89". */
export function formatCAD(n: number): string {
  return cad.format(n);
}

/**
 * Sum the machine-parsed numeric tier only (data rule 2).
 * A row is skipped — and the skip counted — when its verdict is
 * 'not_an_award' or its numeric is null (raw was unparseable, e.g. "kj",
 * "31.65/MT", "Non-Compliant"). Callers label every total as a
 * machine-parseable undercount and surface `skipped` beside `total`.
 */
export function sumAwardNumeric(
  rows: { numeric: number | null; verdict: string | null | undefined }[],
): SumResult {
  const result: SumResult = { total: 0, counted: 0, skipped: 0 };
  for (const row of rows) {
    if (row.verdict === 'not_an_award' || row.numeric === null) {
      result.skipped += 1;
      continue;
    }
    result.total += row.numeric;
    result.counted += 1;
  }
  return result;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/amounts.test.ts`
Expected: PASS — `Test Files  1 passed (1)`, `Tests  9 passed (9)`

- [ ] **Step 10: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/amounts.ts tests/prepare/amounts.test.ts && git commit -m "feat: add sumAwardNumeric (numeric-tier sums, not_an_award excluded, skips counted)"
```

### Task 5: `awards.ts` — dedupeAwards

**Files:**
- Create: `src/prepare/awards.ts`
- Test: `tests/prepare/awards.test.ts`

**Interfaces:**
- Consumes: `AwardRow`, `DedupedAward` from `src/prepare/types.ts` (Task 2).
- Produces: `dedupeAwards(rows: AwardRow[]): DedupedAward[]` — group key `` `${supplier_name_raw ?? ''} ${award_amount ?? ''} ${award_date ?? ''}` ``; the odata row's field values win; `sources[]` sorted odata-first then alphabetical; ckan-only groups kept. Consumed by Task 10 (`prepare()` builds `dedupedAwardsByDoc` for every solicitation and for `unlinked_awards`), which feeds Task 8's rollups and Task 9's indexes. Implements data rule 1: dual-provenance rows (odata 7,519 + ckan_awarded 7,512) display as one line with CKAN presence as a cross-check note, and rows are NEVER deduped by (document, supplier) — standing-offer call-ups legitimately repeat suppliers.

- [ ] **Step 1: Write the failing test**

Create `tests/prepare/awards.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dedupeAwards } from '../../src/prepare/awards.ts';
import type { AwardRow } from '../../src/prepare/types.ts';

function award(over: Partial<AwardRow>): AwardRow {
  return {
    supplier_name_raw: 'ACME PAVING LTD',
    supplier_id: 41,
    award_amount: '$1,000,000.00',
    award_amount_numeric: 1000000,
    award_date: '2024-03-01',
    source: 'odata',
    first_seen: '2024-03-02',
    last_seen: '2026-07-17',
    ...over,
  };
}

describe('dedupeAwards', () => {
  it('collapses an identical odata + ckan_awarded pair into one row', () => {
    const rows = [
      award({ source: 'odata' }),
      award({ source: 'ckan_awarded', supplier_id: null, first_seen: '2024-03-05' }),
    ];
    const out = dedupeAwards(rows);
    expect(out).toHaveLength(1);
    expect(out[0].sources).toEqual(['odata', 'ckan_awarded']);
  });

  it("the odata row's field values win even when the ckan row comes first", () => {
    const rows = [
      award({ source: 'ckan_awarded', supplier_id: null, first_seen: '2024-03-05' }),
      award({ source: 'odata', supplier_id: 41, first_seen: '2024-03-02' }),
    ];
    const out = dedupeAwards(rows);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('odata');
    expect(out[0].supplier_id).toBe(41);
    expect(out[0].first_seen).toBe('2024-03-02');
    expect(out[0].sources).toEqual(['odata', 'ckan_awarded']);
  });

  it('keeps ckan-only rows', () => {
    const out = dedupeAwards([award({ source: 'ckan_awarded' })]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('ckan_awarded');
    expect(out[0].sources).toEqual(['ckan_awarded']);
  });

  it('never merges standing-offer call-ups: same supplier, different amount or date', () => {
    const rows = [
      award({ award_amount: '$10,000.00', award_amount_numeric: 10000, award_date: '2024-01-10' }),
      award({ award_amount: '$25,000.00', award_amount_numeric: 25000, award_date: '2024-01-10' }),
      award({ award_amount: '$10,000.00', award_amount_numeric: 10000, award_date: '2024-06-01' }),
    ];
    expect(dedupeAwards(rows)).toHaveLength(3);
  });

  it('preserves first-appearance order of groups', () => {
    const rows = [
      award({ supplier_name_raw: 'B FIRM', source: 'odata' }),
      award({ supplier_name_raw: 'A FIRM', source: 'odata' }),
      award({ supplier_name_raw: 'B FIRM', source: 'ckan_awarded' }),
    ];
    const out = dedupeAwards(rows);
    expect(out.map((r) => r.supplier_name_raw)).toEqual(['B FIRM', 'A FIRM']);
  });

  it('treats null key fields as empty strings in the group key', () => {
    const rows = [
      award({ supplier_name_raw: null, award_amount: null, award_amount_numeric: null, source: 'odata' }),
      award({ supplier_name_raw: null, award_amount: null, award_amount_numeric: null, source: 'ckan_awarded' }),
    ];
    const out = dedupeAwards(rows);
    expect(out).toHaveLength(1);
    expect(out[0].sources).toEqual(['odata', 'ckan_awarded']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/awards.test.ts`
Expected: FAIL with `Error: Failed to resolve import "../../src/prepare/awards.ts" from "tests/prepare/awards.test.ts". Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/prepare/awards.ts`:

```ts
import type { AwardRow, DedupedAward } from './types.ts';

/**
 * Data rule 1: award rows are dual-provenance — the same award appears once
 * per source (odata + ckan_awarded). Group by the raw line identity
 * (supplier, verbatim amount, date); the odata row's field values win;
 * CKAN presence survives only in `sources[]` (rendered as a cross-check
 * note). CKAN-only groups are kept. NEVER dedupe by (document, supplier):
 * one row is one award line, and standing-offer call-ups legitimately
 * repeat suppliers — the amount and date in the key keep those apart.
 */
export function dedupeAwards(rows: AwardRow[]): DedupedAward[] {
  const groups = new Map<string, { rep: AwardRow; sources: Set<string> }>();
  const order: string[] = [];
  for (const row of rows) {
    const key = `${row.supplier_name_raw ?? ''} ${row.award_amount ?? ''} ${row.award_date ?? ''}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { rep: row, sources: new Set([row.source]) });
      order.push(key);
    } else {
      existing.sources.add(row.source);
      if (row.source === 'odata' && existing.rep.source !== 'odata') {
        existing.rep = row;
      }
    }
  }
  return order.map((key) => {
    const { rep, sources } = groups.get(key)!;
    const sorted = [...sources].sort((a, b) => {
      if (a === b) return 0;
      if (a === 'odata') return -1;
      if (b === 'odata') return 1;
      return a < b ? -1 : 1;
    });
    return { ...rep, sources: sorted };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/awards.test.ts`
Expected: PASS — `Test Files  1 passed (1)`, `Tests  6 passed (6)`

- [ ] **Step 5: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/awards.ts tests/prepare/awards.test.ts && git commit -m "feat: add dedupeAwards (dual-provenance dedupe, odata fields win, ckan-only kept)"
```

### Task 6: `titles.ts` — displayTitle + normalizeCategory + provenance labels

**Files:**
- Create: `src/prepare/titles.ts`
- Test: `tests/prepare/titles.test.ts`

**Interfaces:**
- Consumes: `Solicitation`, `DisplayTitle` from `src/prepare/types.ts` (Task 2).
- Produces: `displayTitle(sol: Pick<Solicitation, 'document_number' | 'title' | 'rfx_type' | 'division'>): DisplayTitle`, `normalizeCategory(category: string | null): string | null`, `TITLE_SOURCE_LABELS: Record<string, string>` (keys: `bid_award_panel`, `council_pre_ariba`, `council_composite`, `legacy_ariba_html`) — consumed by Task 9 (index titles + normalized category facet), Task 13 (`ProvenanceBadge.astro`), and Tasks 14–17 (record page headings). Implements data rules 5 (null title → `Doc <n> — <rfx_type>, <division>` with an explicit untitled marker) and 6 (`'Goods & Services'` folds into `'Goods and Services'` for facets; raw value still shown on record pages).

- [ ] **Step 1: Write the failing test for displayTitle**

Create `tests/prepare/titles.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { displayTitle } from '../../src/prepare/titles.ts';

describe('displayTitle', () => {
  it('uses the published title verbatim when present', () => {
    expect(
      displayTitle({
        document_number: '3524228095',
        title: 'Road Resurfacing — Various Locations',
        rfx_type: 'RFT',
        division: 'Transportation Services',
      }),
    ).toEqual({ text: 'Road Resurfacing — Various Locations', untitled: false });
  });

  it('builds "Doc <n> — <rfx_type>, <division>" for a null title (data rule 5)', () => {
    expect(
      displayTitle({
        document_number: '3524228095',
        title: null,
        rfx_type: 'RFQ',
        division: 'Transportation Services',
      }),
    ).toEqual({ text: 'Doc 3524228095 — RFQ, Transportation Services', untitled: true });
  });

  it('omits the division when null', () => {
    expect(
      displayTitle({ document_number: '3524228095', title: null, rfx_type: 'RFQ', division: null }),
    ).toEqual({ text: 'Doc 3524228095 — RFQ', untitled: true });
  });

  it('omits the rfx_type when null', () => {
    expect(
      displayTitle({
        document_number: '3524228095',
        title: null,
        rfx_type: null,
        division: 'Transportation Services',
      }),
    ).toEqual({ text: 'Doc 3524228095 — Transportation Services', untitled: true });
  });

  it('falls back to the bare document number when rfx_type and division are both null', () => {
    expect(
      displayTitle({ document_number: '3524228095', title: null, rfx_type: null, division: null }),
    ).toEqual({ text: 'Doc 3524228095', untitled: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/titles.test.ts`
Expected: FAIL with `Error: Failed to resolve import "../../src/prepare/titles.ts" from "tests/prepare/titles.test.ts". Does the file exist?`

- [ ] **Step 3: Implement displayTitle**

Create `src/prepare/titles.ts`:

```ts
import type { DisplayTitle, Solicitation } from './types.ts';

/**
 * Data rule 5: `title === null` means the City published no title (3,464 of
 * 7,444 solicitations). Untitled records render as
 * "Doc <document_number> — <rfx_type>, <division>", dropping whichever
 * parts are null. Callers show an explicit "no title published" marker
 * whenever `untitled` is true.
 */
export function displayTitle(
  sol: Pick<Solicitation, 'document_number' | 'title' | 'rfx_type' | 'division'>,
): DisplayTitle {
  if (sol.title !== null) return { text: sol.title, untitled: false };
  const parts = [sol.rfx_type, sol.division].filter((p): p is string => p !== null);
  const suffix = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
  return { text: `Doc ${sol.document_number}${suffix}`, untitled: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/titles.test.ts`
Expected: PASS — `Test Files  1 passed (1)`, `Tests  5 passed (5)`

- [ ] **Step 5: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/titles.ts tests/prepare/titles.test.ts && git commit -m "feat: add displayTitle (untitled-record display, data rule 5)"
```

- [ ] **Step 6: Write the failing tests for normalizeCategory and TITLE_SOURCE_LABELS**

In `tests/prepare/titles.test.ts`, replace the import line

```ts
import { displayTitle } from '../../src/prepare/titles.ts';
```

with

```ts
import { displayTitle, normalizeCategory, TITLE_SOURCE_LABELS } from '../../src/prepare/titles.ts';
```

and append at the end of the file:

```ts
describe('normalizeCategory', () => {
  it("folds 'Goods & Services' into 'Goods and Services' (data rule 6)", () => {
    expect(normalizeCategory('Goods & Services')).toBe('Goods and Services');
  });

  it("leaves 'Goods and Services' unchanged", () => {
    expect(normalizeCategory('Goods and Services')).toBe('Goods and Services');
  });

  it('leaves other categories unchanged', () => {
    expect(normalizeCategory('Professional Services')).toBe('Professional Services');
  });

  it('passes null through', () => {
    expect(normalizeCategory(null)).toBeNull();
  });
});

describe('TITLE_SOURCE_LABELS', () => {
  it('labels all four title_source values with non-empty text', () => {
    expect(Object.keys(TITLE_SOURCE_LABELS).sort()).toEqual([
      'bid_award_panel',
      'council_composite',
      'council_pre_ariba',
      'legacy_ariba_html',
    ]);
    for (const label of Object.values(TITLE_SOURCE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/titles.test.ts`
Expected: FAIL — the file fails to load because `titles.ts` has no `normalizeCategory` export (error names the missing export, e.g. `does not provide an export named 'normalizeCategory'`).

- [ ] **Step 8: Implement normalizeCategory and TITLE_SOURCE_LABELS**

Replace `src/prepare/titles.ts` with the complete final module:

```ts
import type { DisplayTitle, Solicitation } from './types.ts';

/**
 * Data rule 5: `title === null` means the City published no title (3,464 of
 * 7,444 solicitations). Untitled records render as
 * "Doc <document_number> — <rfx_type>, <division>", dropping whichever
 * parts are null. Callers show an explicit "no title published" marker
 * whenever `untitled` is true.
 */
export function displayTitle(
  sol: Pick<Solicitation, 'document_number' | 'title' | 'rfx_type' | 'division'>,
): DisplayTitle {
  if (sol.title !== null) return { text: sol.title, untitled: false };
  const parts = [sol.rfx_type, sol.division].filter((p): p is string => p !== null);
  const suffix = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
  return { text: `Doc ${sol.document_number}${suffix}`, untitled: true };
}

/**
 * Data rule 6: the City published both 'Goods & Services' (91 rows) and
 * 'Goods and Services' (2,364 rows). Facets and indexes fold the former
 * into the latter; record pages still show the raw value.
 */
export function normalizeCategory(category: string | null): string | null {
  if (category === 'Goods & Services') return 'Goods and Services';
  return category;
}

/**
 * Badge text for recovered titles (`title_source` non-null, data rule 5).
 * Rendered by ProvenanceBadge.astro next to the display title.
 */
export const TITLE_SOURCE_LABELS: Record<string, string> = {
  bid_award_panel: 'Title from Bid Award Panel records',
  council_pre_ariba: 'Title from council agenda (pre-Ariba)',
  council_composite: 'Title from council composite award records',
  legacy_ariba_html: 'Title from legacy Ariba HTML',
};
```

- [ ] **Step 9: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/titles.test.ts`
Expected: PASS — `Test Files  1 passed (1)`, `Tests  10 passed (10)`

- [ ] **Step 10: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/titles.ts tests/prepare/titles.test.ts && git commit -m "feat: add normalizeCategory fold and title_source provenance labels"
```

### Task 7: `slugs.ts` — supplierSlug + buildSupplierSlugs + wsSlug

**Files:**
- Create: `src/prepare/slugs.ts`
- Test: `tests/prepare/slugs.test.ts`

**Interfaces:**
- Consumes: `SupplierRec` from `src/prepare/types.ts` (Task 2).
- Produces: `supplierSlug(supplierKey: string): string` (lowercase, non-`[a-z0-9]` runs → `'-'`, trim `'-'`) and `buildSupplierSlugs(suppliers: SupplierRec[]): Map<number, string>` (throws an `Error` naming BOTH `supplier_key`s on collision) — consumed by Task 8 (rollup keys), Task 10 (`supplierSlugById`; a collision aborts `prepare()`, satisfying the build-fails-loudly rule), Task 17 (supplier URLs). Implements data rule 8: permalinks slug the stable `supplier_key` — never `display_name`, never `supplier_id`. Runtime data dependency: real exports carry `supplier_key` only after backend issue #144; this task's unit tests use inline literals and need nothing from the backend.
- Also produces: `wsSlug(ws: string): string` — URL-safe slug for noncompetitive `workspace_number` values: `trim()`, every run of characters outside `[A-Za-z0-9._-]` → `'-'`, trim leading/trailing `'-'`; case, digits, dots, underscores, and dashes are preserved so most values pass through unchanged. Needed because 77 of 2,856 real workspace_number values contain spaces/parens/commas/ampersands/slashes and are unusable raw as an Astro route param. Consumed by Task 9 (`NoncompetitiveIndexRow.wl`), Task 10 (`Prepared.wsSlugByNumber` with loud collision detection), and Task 15 (`getStaticPaths` params and all `/noncompetitive/{slug}/` links; the record page displays the raw `workspace_number` verbatim).

- [ ] **Step 1: Write the failing test for supplierSlug**

Create `tests/prepare/slugs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { supplierSlug } from '../../src/prepare/slugs.ts';

describe('supplierSlug', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(supplierSlug('ACME PAVING LTD')).toBe('acme-paving-ltd');
  });

  it('collapses punctuation runs into a single dash', () => {
    expect(supplierSlug('ACME & SONS, LTD.')).toBe('acme-sons-ltd');
  });

  it('trims leading and trailing dashes produced by edge punctuation', () => {
    expect(supplierSlug('(1234567 ONTARIO INC.)')).toBe('1234567-ontario-inc');
  });

  it('keeps digits', () => {
    expect(supplierSlug('A1 GROUP 2000')).toBe('a1-group-2000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/slugs.test.ts`
Expected: FAIL with `Error: Failed to resolve import "../../src/prepare/slugs.ts" from "tests/prepare/slugs.test.ts". Does the file exist?`

- [ ] **Step 3: Implement supplierSlug**

Create `src/prepare/slugs.ts`:

```ts
import type { SupplierRec } from './types.ts';

/**
 * Data rule 8: supplier permalinks slug the stable normalized
 * `supplier_key` — never `display_name` (shifts as variants accrue) and
 * never `supplier_id` (rebuilt nightly). Lowercase; every run of
 * characters outside [a-z0-9] becomes a single '-'; leading/trailing
 * dashes are trimmed.
 */
export function supplierSlug(supplierKey: string): string {
  return supplierKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/slugs.test.ts`
Expected: PASS — `Test Files  1 passed (1)`, `Tests  4 passed (4)`

- [ ] **Step 5: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/slugs.ts tests/prepare/slugs.test.ts && git commit -m "feat: add supplierSlug (stable supplier_key slugging)"
```

- [ ] **Step 6: Write the failing tests for buildSupplierSlugs**

In `tests/prepare/slugs.test.ts`, replace the import line

```ts
import { supplierSlug } from '../../src/prepare/slugs.ts';
```

with

```ts
import { supplierSlug, buildSupplierSlugs } from '../../src/prepare/slugs.ts';
import type { SupplierRec } from '../../src/prepare/types.ts';
```

and append at the end of the file:

```ts
function supplier(over: Partial<SupplierRec>): SupplierRec {
  return {
    supplier_id: 1,
    supplier_key: 'acme paving ltd',
    display_name: 'Acme Paving Ltd.',
    variants: ['ACME PAVING LTD', 'Acme Paving Ltd.'],
    first_seen: '2024-01-01',
    last_seen: '2026-07-17',
    ...over,
  };
}

describe('buildSupplierSlugs', () => {
  it('maps every supplier_id to the slug of its supplier_key', () => {
    const slugs = buildSupplierSlugs([
      supplier({ supplier_id: 41, supplier_key: 'acme paving ltd' }),
      supplier({ supplier_id: 99, supplier_key: 'idle corp', display_name: 'Idle Corp', variants: [] }),
    ]);
    expect(slugs.size).toBe(2);
    expect(slugs.get(41)).toBe('acme-paving-ltd');
    expect(slugs.get(99)).toBe('idle-corp');
  });

  it('throws on a slug collision, naming BOTH supplier_keys and the slug', () => {
    const suppliers = [
      supplier({ supplier_id: 1, supplier_key: 'acme ltd' }),
      supplier({ supplier_id: 2, supplier_key: 'acme. ltd' }),
    ];
    expect(() => buildSupplierSlugs(suppliers)).toThrowError(
      'Supplier slug collision: "acme-ltd" from supplier_key "acme ltd" and supplier_key "acme. ltd"',
    );
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/slugs.test.ts`
Expected: FAIL — the file fails to load because `slugs.ts` has no `buildSupplierSlugs` export (error names the missing export, e.g. `does not provide an export named 'buildSupplierSlugs'`).

- [ ] **Step 8: Implement buildSupplierSlugs**

Replace `src/prepare/slugs.ts` with the complete final module:

```ts
import type { SupplierRec } from './types.ts';

/**
 * Data rule 8: supplier permalinks slug the stable normalized
 * `supplier_key` — never `display_name` (shifts as variants accrue) and
 * never `supplier_id` (rebuilt nightly). Lowercase; every run of
 * characters outside [a-z0-9] becomes a single '-'; leading/trailing
 * dashes are trimmed.
 */
export function supplierSlug(supplierKey: string): string {
  return supplierKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Slug every supplier, mapping the build-internal `supplier_id` join key
 * to the permalink slug. Two distinct supplier_keys slugging identically
 * would silently merge two firms' permalinks, so a collision throws —
 * naming both keys — and the site build fails instead of deploying.
 */
export function buildSupplierSlugs(suppliers: SupplierRec[]): Map<number, string> {
  const keyBySlug = new Map<string, string>();
  const result = new Map<number, string>();
  for (const s of suppliers) {
    const slug = supplierSlug(s.supplier_key);
    const existing = keyBySlug.get(slug);
    if (existing !== undefined) {
      throw new Error(
        `Supplier slug collision: "${slug}" from supplier_key "${existing}" and supplier_key "${s.supplier_key}"`,
      );
    }
    keyBySlug.set(slug, s.supplier_key);
    result.set(s.supplier_id, slug);
  }
  return result;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/slugs.test.ts`
Expected: PASS — `Test Files  1 passed (1)`, `Tests  6 passed (6)`

- [ ] **Step 10: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/slugs.ts tests/prepare/slugs.test.ts && git commit -m "feat: add buildSupplierSlugs with loud collision detection"
```

- [ ] **Step 11: Write the failing tests for wsSlug**

In `tests/prepare/slugs.test.ts`, replace the import line

```ts
import { supplierSlug, buildSupplierSlugs } from '../../src/prepare/slugs.ts';
```

with

```ts
import { supplierSlug, buildSupplierSlugs, wsSlug } from '../../src/prepare/slugs.ts';
```

and append at the end of the file:

```ts
describe('wsSlug', () => {
  it('passes clean workspace numbers through unchanged', () => {
    expect(wsSlug('2021-0001')).toBe('2021-0001');
    expect(wsSlug('SR1152773518')).toBe('SR1152773518');
  });

  it('replaces runs of spaces, slashes, commas, and ampersands with a single dash', () => {
    expect(wsSlug('SR5252910024 / CW2310865')).toBe('SR5252910024-CW2310865');
    expect(wsSlug('SR5465565873/CW2312872')).toBe('SR5465565873-CW2312872');
    expect(wsSlug('11393, 11394 & 11395')).toBe('11393-11394-11395');
  });

  it('trims edge dashes from wrapping punctuation; preserves case, dots, and underscores', () => {
    expect(wsSlug('10834 (11106)')).toBe('10834-11106');
    expect(wsSlug('CINTAS CANADA LIMITED')).toBe('CINTAS-CANADA-LIMITED');
    expect(wsSlug(' No. 6034_A ')).toBe('No.-6034_A');
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/slugs.test.ts`
Expected: FAIL — the file fails to load because `slugs.ts` has no `wsSlug` export (error names the missing export, e.g. `does not provide an export named 'wsSlug'`).

- [ ] **Step 13: Implement wsSlug**

Replace `src/prepare/slugs.ts` with the complete final module:

```ts
import type { SupplierRec } from './types.ts';

/**
 * Data rule 8: supplier permalinks slug the stable normalized
 * `supplier_key` — never `display_name` (shifts as variants accrue) and
 * never `supplier_id` (rebuilt nightly). Lowercase; every run of
 * characters outside [a-z0-9] becomes a single '-'; leading/trailing
 * dashes are trimmed.
 */
export function supplierSlug(supplierKey: string): string {
  return supplierKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Slug every supplier, mapping the build-internal `supplier_id` join key
 * to the permalink slug. Two distinct supplier_keys slugging identically
 * would silently merge two firms' permalinks, so a collision throws —
 * naming both keys — and the site build fails instead of deploying.
 */
export function buildSupplierSlugs(suppliers: SupplierRec[]): Map<number, string> {
  const keyBySlug = new Map<string, string>();
  const result = new Map<number, string>();
  for (const s of suppliers) {
    const slug = supplierSlug(s.supplier_key);
    const existing = keyBySlug.get(slug);
    if (existing !== undefined) {
      throw new Error(
        `Supplier slug collision: "${slug}" from supplier_key "${existing}" and supplier_key "${s.supplier_key}"`,
      );
    }
    keyBySlug.set(slug, s.supplier_key);
    result.set(s.supplier_id, slug);
  }
  return result;
}

/**
 * URL-safe slug for a noncompetitive workspace_number. 77 of 2,856 real
 * values contain spaces, parens, commas, ampersands, or slashes — unusable
 * raw as an Astro route param (a '/' even splits the path). Case, digits,
 * dots, underscores, and dashes are preserved so most workspace numbers
 * pass through unchanged; every other run of characters becomes a single
 * '-'. Record pages display the raw workspace_number verbatim — only URLs
 * use the slug. Collision detection lives in prepare() (Task 10), which
 * builds Prepared.wsSlugByNumber and throws naming both colliding values.
 */
export function wsSlug(ws: string): string {
  return ws
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 14: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/slugs.test.ts`
Expected: PASS — `Test Files  1 passed (1)`, `Tests  9 passed (9)`

- [ ] **Step 15: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/slugs.ts tests/prepare/slugs.test.ts && git commit -m "feat: add wsSlug (URL-safe workspace_number slugging)"
```

### Task 8: `links.ts` — buildBridge + buildSupplierRollups

**Files:**
- Create: `src/prepare/links.ts`
- Test: `tests/prepare/links.test.ts`

**Interfaces:**
- Consumes: `BidRow`, `CouncilItem`, `Bridge`, `ExportDoc`, `Solicitation`, `SupplierRec`, `DedupedAward`, `CompositeAward`, `NonCompetitive`, `SuspendedFirm`, `SupplierRollup`, `SumResult` from `src/prepare/types.ts` (Task 2); `sumAwardNumeric` from `src/prepare/amounts.ts` (Task 4). The `dedupedByDoc` parameter is the `Map<string, DedupedAward[]>` that Task 10's `prepare()` builds with Task 5's `dedupeAwards` (over each solicitation's awards AND the `unlinked_awards` bucket); this task's tests construct it inline.
- Produces: `buildBridge(councilItems: CouncilItem[]): Bridge` (only from bids carrying BOTH `reference` and `document_number` — data rule 3's one legitimate competitive-spine bridge) and `buildSupplierRollups(doc: ExportDoc, slugs: Map<number, string>, dedupedByDoc: Map<string, DedupedAward[]>): Map<string, SupplierRollup>` (keyed by slug; per-keyspace totals `cityAwards` / `composite` / `noncompetitive` computed separately and NEVER merged) — consumed by Task 10 (`Prepared.bridge`, `Prepared.rollupsBySlug`), Task 14 (council bid-bridge on solicitation pages), Task 16 (council → solicitation links), Task 17 (supplier pages).

- [ ] **Step 1: Write the failing tests for buildBridge**

Create `tests/prepare/links.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildBridge } from '../../src/prepare/links.ts';
import type { BidRow, CouncilItem } from '../../src/prepare/types.ts';

function bid(over: Partial<BidRow>): BidRow {
  return {
    reference: '2024.GG10.5',
    document_number: '3524228095',
    bidder_name_raw: 'ACME PAVING LTD',
    supplier_id: 41,
    bid_price: '$1,100,000.00',
    bid_price_numeric: 1100000,
    hst_basis: 'including',
    price_header: null,
    source: 'bid_award_panel',
    first_seen: '2024-03-02',
    last_seen: '2026-07-17',
    ...over,
  };
}

function council(over: Partial<CouncilItem>): CouncilItem {
  return {
    reference: '2024.GG10.5',
    title: 'Award of RFT for road resurfacing',
    decision_text: 'City Council adopted this Item.',
    first_seen: '2024-03-02',
    last_seen: '2026-07-17',
    background_pdfs: [],
    bids: [],
    ...over,
  };
}

describe('buildBridge', () => {
  it('bridges from bids carrying both reference and document_number', () => {
    const items = [
      council({
        reference: '2024.GG10.5',
        bids: [bid({ reference: '2024.GG10.5', document_number: '3524228095' })],
      }),
    ];
    const bridge = buildBridge(items);
    expect(bridge.refToDoc.get('2024.GG10.5')).toBe('3524228095');
    expect(bridge.docToRefs.get('3524228095')).toEqual(['2024.GG10.5']);
  });

  it('ignores bids missing document_number (pre-2019 council bids)', () => {
    const items = [
      council({ reference: '2015.BA1.1', bids: [bid({ reference: '2015.BA1.1', document_number: null })] }),
    ];
    const bridge = buildBridge(items);
    expect(bridge.refToDoc.size).toBe(0);
    expect(bridge.docToRefs.size).toBe(0);
  });

  it('ignores bids missing reference', () => {
    const items = [council({ bids: [bid({ reference: null, document_number: '3524228095' })] })];
    const bridge = buildBridge(items);
    expect(bridge.refToDoc.size).toBe(0);
    expect(bridge.docToRefs.size).toBe(0);
  });

  it('dedupes repeated (reference, document_number) pairs from multiple bids', () => {
    const items = [
      council({
        reference: '2024.GG10.5',
        bids: [
          bid({ bidder_name_raw: 'ACME PAVING LTD' }),
          bid({ bidder_name_raw: 'BETTER ROADS INC', supplier_id: 42 }),
        ],
      }),
    ];
    const bridge = buildBridge(items);
    expect(bridge.refToDoc.size).toBe(1);
    expect(bridge.docToRefs.get('3524228095')).toEqual(['2024.GG10.5']);
  });

  it('collects multiple references pointing at the same document', () => {
    const items = [
      council({ reference: '2024.GG10.5', bids: [bid({ reference: '2024.GG10.5' })] }),
      council({ reference: '2024.EX7.2', bids: [bid({ reference: '2024.EX7.2' })] }),
    ];
    const bridge = buildBridge(items);
    expect(bridge.docToRefs.get('3524228095')).toEqual(['2024.GG10.5', '2024.EX7.2']);
    expect(bridge.refToDoc.get('2024.EX7.2')).toBe('3524228095');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/links.test.ts`
Expected: FAIL with `Error: Failed to resolve import "../../src/prepare/links.ts" from "tests/prepare/links.test.ts". Does the file exist?`

- [ ] **Step 3: Implement buildBridge**

Create `src/prepare/links.ts`:

```ts
import type { Bridge, CouncilItem } from './types.ts';

/**
 * Data rule 3: the five keyspaces never join, but one bridge legitimately
 * exists on the competitive spine — council bids that carry BOTH a council
 * `reference` and a solicitation `document_number`. Bids missing either
 * identifier (e.g. pre-2019 council bids with document_number null)
 * contribute nothing.
 */
export function buildBridge(councilItems: CouncilItem[]): Bridge {
  const refToDoc = new Map<string, string>();
  const docToRefs = new Map<string, string[]>();
  for (const item of councilItems) {
    for (const b of item.bids) {
      if (b.reference === null || b.document_number === null) continue;
      if (!refToDoc.has(b.reference)) refToDoc.set(b.reference, b.document_number);
      const refs = docToRefs.get(b.document_number) ?? [];
      if (!refs.includes(b.reference)) {
        refs.push(b.reference);
        docToRefs.set(b.document_number, refs);
      }
    }
  }
  return { refToDoc, docToRefs };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/links.test.ts`
Expected: PASS — `Test Files  1 passed (1)`, `Tests  5 passed (5)`

- [ ] **Step 5: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/links.ts tests/prepare/links.test.ts && git commit -m "feat: add buildBridge (council reference <-> document_number, both identifiers required)"
```

- [ ] **Step 6: Write the failing tests for buildSupplierRollups**

In `tests/prepare/links.test.ts`, replace the import block

```ts
import { buildBridge } from '../../src/prepare/links.ts';
import type { BidRow, CouncilItem } from '../../src/prepare/types.ts';
```

with

```ts
import { buildBridge, buildSupplierRollups } from '../../src/prepare/links.ts';
import type {
  BidRow,
  CompositeAward,
  CouncilItem,
  DedupedAward,
  ExportDoc,
  NonCompetitive,
  Solicitation,
  SupplierRec,
  SuspendedFirm,
} from '../../src/prepare/types.ts';
```

and append at the end of the file:

```ts
function sol(over: Partial<Solicitation>): Solicitation {
  return {
    document_number: '3524228095',
    status: 'Awarded',
    rfx_type: 'RFT',
    noip_type: null,
    form_type: null,
    title: 'Road resurfacing 2024',
    description: null,
    issue_date: '2024-01-15',
    submission_deadline: '2024-02-15',
    category: 'Construction Services',
    division: 'Transportation Services',
    buyer_name: null,
    buyer_email: null,
    buyer_phone: null,
    wards: null,
    ariba_posting_link: null,
    source: 'odata',
    title_source: null,
    first_seen: '2024-01-16',
    last_seen: '2026-07-17',
    awards: [],
    ariba_postings: [],
    documents: [],
    bids: [],
    ...over,
  };
}

function dedupedAward(over: Partial<DedupedAward>): DedupedAward {
  return {
    supplier_name_raw: 'ACME PAVING LTD',
    supplier_id: 41,
    award_amount: '$1,000,000.00',
    award_amount_numeric: 1000000,
    award_date: '2024-03-01',
    source: 'odata',
    first_seen: '2024-03-02',
    last_seen: '2026-07-17',
    sources: ['odata', 'ckan_awarded'],
    ...over,
  };
}

function supplier(over: Partial<SupplierRec>): SupplierRec {
  return {
    supplier_id: 41,
    supplier_key: 'acme paving ltd',
    display_name: 'Acme Paving Ltd.',
    variants: ['ACME PAVING LTD'],
    first_seen: '2024-01-01',
    last_seen: '2026-07-17',
    ...over,
  };
}

function composite(over: Partial<CompositeAward>): CompositeAward {
  return {
    id: 7,
    call_number: '3405-10-3197',
    call_number_raw: null,
    reference: '2010.BA45.9',
    title: 'Supply of winter sand',
    supplier_name_raw: 'ACME PAVING LTD',
    supplier_id: 41,
    award_value: '$50,000.00',
    award_value_numeric: 50000,
    source: 'council_composite',
    first_seen: '2024-01-01',
    last_seen: '2026-07-17',
    ...over,
  };
}

function noncomp(over: Partial<NonCompetitive>): NonCompetitive {
  return {
    workspace_number: 'WS-2024-0042',
    supplier_name_raw: 'ACME PAVING LTD',
    supplier_id: 41,
    reason: 'Sole source: proprietary parts',
    contract_amount: '$75,000.00',
    contract_amount_numeric: 75000,
    contract_date: '2024-05-01',
    division: 'Transportation Services',
    council_authority_link: null,
    source: 'noncompetitive_ckan',
    first_seen: '2024-05-02',
    last_seen: '2026-07-17',
    ...over,
  };
}

function firm(over: Partial<SuspendedFirm>): SuspendedFirm {
  return {
    supplier_name_raw: 'ACME PAVING LTD',
    status: 'Suspended',
    start_date: '2025-01-01',
    end_date: null,
    suspension_type: 'full',
    council_authority: '2024.GG12.1',
    supplier_id: 41,
    source: 'suspended_firms',
    first_seen: '2025-01-02',
    last_seen: '2026-07-17',
    ...over,
  };
}

function makeDoc(over: Partial<ExportDoc>): ExportDoc {
  return {
    meta: { generated_at: '2026-07-18T05:30:00', counts: {}, sources: [] },
    solicitations: [],
    noncompetitive: [],
    suspended_firms: [],
    suppliers: [],
    capital_projects: [],
    composite_awards: [],
    council_items: [],
    unlinked_ariba_postings: [],
    unlinked_awards: [],
    unlinked_bids: [],
    buyers: [],
    ...over,
  };
}

describe('buildSupplierRollups', () => {
  it('builds a rollup per supplier, keyed by slug, including inactive suppliers', () => {
    const doc = makeDoc({
      suppliers: [
        supplier({ supplier_id: 41, supplier_key: 'acme paving ltd' }),
        supplier({ supplier_id: 99, supplier_key: 'idle corp', display_name: 'Idle Corp', variants: [] }),
      ],
    });
    const slugs = new Map([[41, 'acme-paving-ltd'], [99, 'idle-corp']]);
    const rollups = buildSupplierRollups(doc, slugs, new Map());
    expect(rollups.size).toBe(2);
    const idle = rollups.get('idle-corp')!;
    expect(idle.supplier.display_name).toBe('Idle Corp');
    expect(idle.awards).toEqual([]);
    expect(idle.compositeAwards).toEqual([]);
    expect(idle.noncompetitive).toEqual([]);
    expect(idle.bids).toEqual([]);
    expect(idle.suspended).toEqual([]);
    expect(idle.totals).toEqual({
      cityAwards: { total: 0, counted: 0, skipped: 0 },
      composite: { total: 0, counted: 0, skipped: 0 },
      noncompetitive: { total: 0, counted: 0, skipped: 0 },
    });
  });

  it('collects city awards with their solicitation and totals only the numeric tier', () => {
    const s = sol({ document_number: '3524228095' });
    const doc = makeDoc({ solicitations: [s], suppliers: [supplier({ supplier_id: 41 })] });
    const dedupedByDoc = new Map([
      ['3524228095', [
        dedupedAward({ supplier_id: 41, award_amount_numeric: 1000000 }),
        dedupedAward({ supplier_id: 77, supplier_name_raw: 'OTHER CO', award_amount_numeric: 5000 }),
      ]],
    ]);
    const rollups = buildSupplierRollups(doc, new Map([[41, 'acme-paving-ltd']]), dedupedByDoc);
    const acme = rollups.get('acme-paving-ltd')!;
    expect(acme.awards).toHaveLength(1);
    expect(acme.awards[0].document_number).toBe('3524228095');
    expect(acme.awards[0].sol).toBe(s);
    expect(acme.awards[0].award.award_amount_numeric).toBe(1000000);
    expect(acme.totals.cityAwards).toEqual({ total: 1000000, counted: 1, skipped: 0 });
  });

  it('attaches sol: null for awards whose document matches no solicitation (unlinked awards)', () => {
    const doc = makeDoc({ suppliers: [supplier({ supplier_id: 41 })] });
    const dedupedByDoc = new Map([['9999999999', [dedupedAward({ supplier_id: 41 })]]]);
    const rollups = buildSupplierRollups(doc, new Map([[41, 'acme-paving-ltd']]), dedupedByDoc);
    const acme = rollups.get('acme-paving-ltd')!;
    expect(acme.awards).toHaveLength(1);
    expect(acme.awards[0].sol).toBeNull();
  });

  it("excludes verdict 'not_an_award' and null numerics from cityAwards, counting skips, while still listing the rows", () => {
    const doc = makeDoc({
      solicitations: [sol()],
      suppliers: [supplier({ supplier_id: 41 })],
    });
    const dedupedByDoc = new Map([
      ['3524228095', [
        dedupedAward({ supplier_id: 41, award_amount_numeric: 100000, award_amount_verdict: null }),
        dedupedAward({ supplier_id: 41, award_amount: 'kj', award_amount_numeric: null }),
        dedupedAward({ supplier_id: 41, award_amount_numeric: 9050000000, award_amount_verdict: 'not_an_award' }),
      ]],
    ]);
    const rollups = buildSupplierRollups(doc, new Map([[41, 'acme-paving-ltd']]), dedupedByDoc);
    const acme = rollups.get('acme-paving-ltd')!;
    expect(acme.awards).toHaveLength(3);
    expect(acme.totals.cityAwards).toEqual({ total: 100000, counted: 1, skipped: 2 });
  });

  it('keeps per-keyspace totals separate — cityAwards, composite, noncompetitive never merged', () => {
    const doc = makeDoc({
      solicitations: [sol()],
      suppliers: [supplier({ supplier_id: 41 })],
      composite_awards: [
        composite({ supplier_id: 41, award_value_numeric: 50000 }),
        composite({ supplier_id: 41, id: 8, award_value: '31.65/MT', award_value_numeric: null }),
      ],
      noncompetitive: [noncomp({ supplier_id: 41, contract_amount_numeric: 75000 })],
    });
    const dedupedByDoc = new Map([
      ['3524228095', [dedupedAward({ supplier_id: 41, award_amount_numeric: 1000000 })]],
    ]);
    const rollups = buildSupplierRollups(doc, new Map([[41, 'acme-paving-ltd']]), dedupedByDoc);
    const acme = rollups.get('acme-paving-ltd')!;
    expect(acme.compositeAwards).toHaveLength(2);
    expect(acme.noncompetitive).toHaveLength(1);
    expect(acme.totals.cityAwards).toEqual({ total: 1000000, counted: 1, skipped: 0 });
    expect(acme.totals.composite).toEqual({ total: 50000, counted: 1, skipped: 1 });
    expect(acme.totals.noncompetitive).toEqual({ total: 75000, counted: 1, skipped: 0 });
    // exactly three per-keyspace results; no combined figure exists
    expect(Object.keys(acme.totals).sort()).toEqual(['cityAwards', 'composite', 'noncompetitive']);
  });

  it('gathers bids from council items, solicitation-nested bids, and unlinked_bids', () => {
    const doc = makeDoc({
      suppliers: [supplier({ supplier_id: 41 })],
      council_items: [
        council({ bids: [bid({ supplier_id: 41, reference: '2024.GG10.5', document_number: null })] }),
      ],
      solicitations: [
        sol({ bids: [bid({ supplier_id: 41, reference: null, document_number: '3524228095' })] }),
      ],
      unlinked_bids: [bid({ supplier_id: 41, reference: null, document_number: '8888888888' })],
    });
    const rollups = buildSupplierRollups(doc, new Map([[41, 'acme-paving-ltd']]), new Map());
    const bids = rollups.get('acme-paving-ltd')!.bids;
    expect(bids).toHaveLength(3);
    expect(bids.map((b) => [b.reference, b.document_number])).toEqual([
      ['2024.GG10.5', null],
      [null, '3524228095'],
      [null, '8888888888'],
    ]);
  });

  it('attributes suspensions by supplier_id', () => {
    const doc = makeDoc({
      suppliers: [supplier({ supplier_id: 41 })],
      suspended_firms: [firm({ supplier_id: 41 })],
    });
    const rollups = buildSupplierRollups(doc, new Map([[41, 'acme-paving-ltd']]), new Map());
    const acme = rollups.get('acme-paving-ltd')!;
    expect(acme.suspended).toHaveLength(1);
    expect(acme.suspended[0].supplier_name_raw).toBe('ACME PAVING LTD');
  });

  it('leaves rows with supplier_id null unattributed', () => {
    const doc = makeDoc({
      suppliers: [supplier({ supplier_id: 41 })],
      noncompetitive: [noncomp({ supplier_id: null })],
    });
    const rollups = buildSupplierRollups(doc, new Map([[41, 'acme-paving-ltd']]), new Map());
    expect(rollups.get('acme-paving-ltd')!.noncompetitive).toEqual([]);
  });

  it('throws when a supplier has no slug', () => {
    const doc = makeDoc({ suppliers: [supplier({ supplier_id: 41, supplier_key: 'acme paving ltd' })] });
    expect(() => buildSupplierRollups(doc, new Map(), new Map())).toThrowError(
      'No slug for supplier_id 41 (supplier_key "acme paving ltd")',
    );
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/links.test.ts`
Expected: FAIL — the file fails to load because `links.ts` has no `buildSupplierRollups` export (error names the missing export, e.g. `does not provide an export named 'buildSupplierRollups'`; all 14 tests in the file report as failed).

- [ ] **Step 8: Implement buildSupplierRollups**

Replace `src/prepare/links.ts` with the complete final module:

```ts
import type {
  BidRow,
  Bridge,
  CouncilItem,
  DedupedAward,
  ExportDoc,
  Solicitation,
  SupplierRollup,
} from './types.ts';
import { sumAwardNumeric } from './amounts.ts';

/**
 * Data rule 3: the five keyspaces never join, but one bridge legitimately
 * exists on the competitive spine — council bids that carry BOTH a council
 * `reference` and a solicitation `document_number`. Bids missing either
 * identifier (e.g. pre-2019 council bids with document_number null)
 * contribute nothing.
 */
export function buildBridge(councilItems: CouncilItem[]): Bridge {
  const refToDoc = new Map<string, string>();
  const docToRefs = new Map<string, string[]>();
  for (const item of councilItems) {
    for (const b of item.bids) {
      if (b.reference === null || b.document_number === null) continue;
      if (!refToDoc.has(b.reference)) refToDoc.set(b.reference, b.document_number);
      const refs = docToRefs.get(b.document_number) ?? [];
      if (!refs.includes(b.reference)) {
        refs.push(b.reference);
        docToRefs.set(b.document_number, refs);
      }
    }
  }
  return { refToDoc, docToRefs };
}

/**
 * One rollup per supplier (every supplier gets one, even with no activity),
 * keyed by permalink slug. Attribution is by `supplier_id` — valid only
 * within this build (data rule 8); the slug is the stable identity.
 * City awards come from the caller's deduped-by-document map (which may
 * include unlinked documents — those get `sol: null`); bids come from
 * council items, solicitation-nested bids, and `unlinked_bids`. Totals are
 * one SumResult per keyspace — cityAwards, composite, noncompetitive —
 * and are NEVER merged into a single figure (data rule 3).
 */
export function buildSupplierRollups(
  doc: ExportDoc,
  slugs: Map<number, string>,
  dedupedByDoc: Map<string, DedupedAward[]>,
): Map<string, SupplierRollup> {
  const solByDoc = new Map<string, Solicitation>();
  for (const s of doc.solicitations) solByDoc.set(s.document_number, s);

  const byId = new Map<number, SupplierRollup>();
  const out = new Map<string, SupplierRollup>();
  for (const supplier of doc.suppliers) {
    const slug = slugs.get(supplier.supplier_id);
    if (slug === undefined) {
      throw new Error(
        `No slug for supplier_id ${supplier.supplier_id} (supplier_key "${supplier.supplier_key}")`,
      );
    }
    const rollup: SupplierRollup = {
      slug,
      supplier,
      awards: [],
      compositeAwards: [],
      noncompetitive: [],
      bids: [],
      suspended: [],
      totals: {
        cityAwards: { total: 0, counted: 0, skipped: 0 },
        composite: { total: 0, counted: 0, skipped: 0 },
        noncompetitive: { total: 0, counted: 0, skipped: 0 },
      },
    };
    byId.set(supplier.supplier_id, rollup);
    out.set(slug, rollup);
  }

  for (const [document_number, awards] of dedupedByDoc) {
    const s = solByDoc.get(document_number) ?? null;
    for (const award of awards) {
      if (award.supplier_id === null) continue;
      byId.get(award.supplier_id)?.awards.push({ document_number, sol: s, award });
    }
  }

  for (const comp of doc.composite_awards) {
    if (comp.supplier_id === null) continue;
    byId.get(comp.supplier_id)?.compositeAwards.push(comp);
  }

  for (const nc of doc.noncompetitive) {
    if (nc.supplier_id === null) continue;
    byId.get(nc.supplier_id)?.noncompetitive.push(nc);
  }

  const addBid = (b: BidRow): void => {
    if (b.supplier_id === null) return;
    byId.get(b.supplier_id)?.bids.push({
      reference: b.reference,
      document_number: b.document_number,
      bid: b,
    });
  };
  for (const item of doc.council_items) for (const b of item.bids) addBid(b);
  for (const s of doc.solicitations) for (const b of s.bids) addBid(b);
  for (const b of doc.unlinked_bids) addBid(b);

  for (const f of doc.suspended_firms) {
    if (f.supplier_id === null) continue;
    byId.get(f.supplier_id)?.suspended.push(f);
  }

  for (const rollup of out.values()) {
    rollup.totals.cityAwards = sumAwardNumeric(
      rollup.awards.map((a) => ({
        numeric: a.award.award_amount_numeric,
        verdict: a.award.award_amount_verdict,
      })),
    );
    rollup.totals.composite = sumAwardNumeric(
      rollup.compositeAwards.map((c) => ({ numeric: c.award_value_numeric, verdict: null })),
    );
    rollup.totals.noncompetitive = sumAwardNumeric(
      rollup.noncompetitive.map((n) => ({
        numeric: n.contract_amount_numeric,
        verdict: n.contract_amount_verdict,
      })),
    );
  }

  return out;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:
`npx vitest run tests/prepare/links.test.ts`
Expected: PASS — `Test Files  1 passed (1)`, `Tests  14 passed (14)`

- [ ] **Step 10: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/links.ts tests/prepare/links.test.ts && git commit -m "feat: add buildSupplierRollups (per-slug rollups, per-keyspace totals never merged)"
```

### Task 9: `indexes.ts` — four browse index builders

**Files:**
- Create: `src/prepare/indexes.ts`
- Test: `tests/prepare/indexes.test.ts`

**Interfaces:**
- Consumes: types from Task 2 (`Prepared`, `Solicitation`, `CouncilItem`, `NonCompetitive`, `BidRow`, `DedupedAward`, `SupplierRollup`, `ExportDoc`); `sumAwardNumeric` (Task 4); `displayTitle`, `normalizeCategory` (Task 6); `wsSlug` (Task 7).
- Produces: `SolicitationIndexRow`, `SupplierIndexRow`, `NoncompetitiveIndexRow`, `CouncilIndexRow` and `buildSolicitationIndex(p)`, `buildSupplierIndex(p)`, `buildNoncompetitiveIndex(p)`, `buildCouncilIndex(p)` — consumed by Task 19's JSON index endpoints and the BrowseTable island. `NoncompetitiveIndexRow` carries both `w` (the raw `workspace_number`, displayed verbatim) and `wl` (its `wsSlug` URL slug) — Task 19's island and noscript tables build `/noncompetitive/{row.wl}/` links from `wl`, matching the paths Task 15 generates from `Prepared.wsSlugByNumber`.

- [ ] **Step 1: Write the failing test**

Create `tests/prepare/indexes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type {
  BidRow, CouncilItem, DedupedAward, ExportDoc, NonCompetitive, Prepared,
  Solicitation, SupplierRollup,
} from '../../src/prepare/types';
import {
  buildCouncilIndex, buildNoncompetitiveIndex, buildSolicitationIndex, buildSupplierIndex,
} from '../../src/prepare/indexes';

const zero = () => ({ total: 0, counted: 0, skipped: 0 });

function sol(over: Partial<Solicitation>): Solicitation {
  return {
    document_number: '1000000001', status: 'Awarded', rfx_type: 'RFQ', noip_type: null,
    form_type: null, title: null, description: null, issue_date: '2023-04-01',
    submission_deadline: null, category: null, division: null, buyer_name: null,
    buyer_email: null, buyer_phone: null, wards: null, ariba_posting_link: null,
    source: 'ckan', title_source: null, first_seen: '2026-01-01', last_seen: '2026-07-18',
    awards: [], ariba_postings: [], documents: [], bids: [], ...over,
  };
}

function bid(over: Partial<BidRow>): BidRow {
  return {
    reference: null, document_number: null, bidder_name_raw: 'Acme Ltd', supplier_id: 1,
    bid_price: '$10.00', bid_price_numeric: 10, hst_basis: 'including', price_header: null,
    source: 'council', first_seen: '2026-01-01', last_seen: '2026-07-18', ...over,
  };
}

function deduped(over: Partial<DedupedAward>): DedupedAward {
  return {
    supplier_name_raw: 'Acme Ltd', supplier_id: 1, award_amount: '$1,000.00',
    award_amount_numeric: 1000, award_amount_labelled: null, award_amount_verdict: null,
    award_date: '2023-06-01', source: 'odata', first_seen: '2026-01-01',
    last_seen: '2026-07-18', sources: ['odata', 'ckan_awarded'], ...over,
  };
}

function council(over: Partial<CouncilItem>): CouncilItem {
  return {
    reference: '2023.PW1.1', title: 'Award of contract', decision_text: null,
    first_seen: '2026-01-01', last_seen: '2026-07-18', background_pdfs: [], bids: [], ...over,
  };
}

function nc(over: Partial<NonCompetitive>): NonCompetitive {
  return {
    workspace_number: '2021-0001', supplier_name_raw: 'Acme Ltd', supplier_id: 1,
    reason: 'Sole source', contract_amount: '$25,000.00', contract_amount_numeric: 25000,
    contract_amount_labelled: null, contract_amount_verdict: null, contract_date: '2021-03-15',
    division: 'Parks', council_authority_link: null, source: 'ckan',
    first_seen: '2026-01-01', last_seen: '2026-07-18', ...over,
  };
}

function rollup(over: Partial<SupplierRollup> & Pick<SupplierRollup, 'slug'>): SupplierRollup {
  return {
    supplier: {
      supplier_id: 1, supplier_key: 'ACME LTD', display_name: 'Acme Ltd', variants: [],
      first_seen: '2026-01-01', last_seen: '2026-07-18',
    },
    awards: [], compositeAwards: [], noncompetitive: [], bids: [], suspended: [],
    totals: { cityAwards: zero(), composite: zero(), noncompetitive: zero() },
    ...over,
  };
}

function exportDoc(over: Partial<ExportDoc>): ExportDoc {
  return {
    meta: { generated_at: '2026-07-18T05:30:00Z', counts: {}, sources: [] },
    solicitations: [], noncompetitive: [], suspended_firms: [], suppliers: [],
    capital_projects: [], composite_awards: [], council_items: [],
    unlinked_ariba_postings: [], unlinked_awards: [], unlinked_bids: [], buyers: [], ...over,
  };
}

function prepared(over: Partial<Prepared>): Prepared {
  return {
    doc: exportDoc({}), generatedAt: '2026-07-18T05:30:00Z',
    dedupedAwardsByDoc: new Map(), bridge: { refToDoc: new Map(), docToRefs: new Map() },
    supplierSlugById: new Map(), wsSlugByNumber: new Map(),
    rollupsBySlug: new Map(), compositeCalls: [],
    councilByRef: new Map(), solByDoc: new Map(),
    headline: {
      solicitations: 0, awardedTotal: zero(), noncompetitiveTotal: zero(),
      openCount: 0, bidCount: 0, supplierCount: 0,
    },
    counts: {}, ...over,
  };
}

describe('buildSolicitationIndex', () => {
  it('builds compact rows: display title, normalized category, award total, bridged bid count, doc count', () => {
    const s = sol({
      document_number: '3524228095', title: null, rfx_type: 'RFQ',
      division: 'Transportation Services', status: 'Awarded', category: 'Goods & Services',
      issue_date: '2023-04-01', submission_deadline: '2023-05-01',
      bids: [bid({ document_number: '3524228095', source: 'award_summary' })],
      documents: [
        { source: 'ariba_attachment', name: 'specs.pdf', path: 'inner.zip/specs.pdf', type: 'pdf', size_bytes: 100, url: null },
        { source: 'staff_report', name: 'report.pdf', path: 'report.pdf', type: 'pdf', size_bytes: null, url: 'https://www.toronto.ca/r.pdf' },
      ],
    });
    const item = council({
      reference: '2023.PW1.1',
      bids: [
        bid({ reference: '2023.PW1.1', document_number: '3524228095' }),
        bid({ reference: '2023.PW1.1', document_number: '9999999999' }),
      ],
    });
    const p = prepared({
      doc: exportDoc({ solicitations: [s], council_items: [item] }),
      dedupedAwardsByDoc: new Map([['3524228095', [
        deduped({ award_amount_numeric: 1000 }),
        deduped({ award_amount_numeric: 500, supplier_name_raw: 'Beta Inc' }),
      ]]]),
      bridge: {
        refToDoc: new Map([['2023.PW1.1', '3524228095']]),
        docToRefs: new Map([['3524228095', ['2023.PW1.1']]]),
      },
      councilByRef: new Map([['2023.PW1.1', item]]),
    });
    expect(buildSolicitationIndex(p)).toEqual([{
      d: '3524228095', t: 'Doc 3524228095 — RFQ, Transportation Services', u: true,
      s: 'Awarded', r: 'RFQ', c: 'Goods and Services', v: 'Transportation Services',
      y: 2023, dl: '2023-05-01', a: 1500, nb: 2, nd: 2,
    }]);
  });

  it('a is null when no deduped awards; not_an_award rows are excluded from a', () => {
    const s1 = sol({ document_number: '1000000001', title: 'Road resurfacing 2024' });
    const s2 = sol({ document_number: '1000000002', title: 'Winter salt supply' });
    const p = prepared({
      doc: exportDoc({ solicitations: [s1, s2] }),
      dedupedAwardsByDoc: new Map([['1000000002', [
        deduped({ award_amount: '$9,050,000,000', award_amount_numeric: 9050000000, award_amount_verdict: 'not_an_award' }),
        deduped({ award_amount_numeric: 100 }),
      ]]]),
    });
    const [r1, r2] = buildSolicitationIndex(p);
    expect(r1.a).toBeNull();
    expect(r1.u).toBe(false);
    expect(r1.t).toBe('Road resurfacing 2024');
    expect(r2.a).toBe(100);
  });
});

describe('buildSupplierIndex', () => {
  it('one row per rollup, sorted by display name; a null when no city awards', () => {
    const acme = rollup({
      slug: 'acme-ltd',
      awards: [{ document_number: '1000000001', sol: null, award: deduped({}) }],
      bids: [{ reference: '2023.PW1.1', document_number: null, bid: bid({}) }],
      totals: { cityAwards: { total: 1000, counted: 1, skipped: 0 }, composite: zero(), noncompetitive: zero() },
    });
    const zeta = rollup({
      slug: 'zeta-corp',
      supplier: {
        supplier_id: 2, supplier_key: 'ZETA CORP', display_name: 'Zeta Corp', variants: [],
        first_seen: '2026-01-01', last_seen: '2026-07-18',
      },
    });
    const p = prepared({ rollupsBySlug: new Map([['zeta-corp', zeta], ['acme-ltd', acme]]) });
    expect(buildSupplierIndex(p)).toEqual([
      { g: 'acme-ltd', n: 'Acme Ltd', na: 1, nb: 1, a: 1000 },
      { g: 'zeta-corp', n: 'Zeta Corp', na: 0, nb: 0, a: null },
    ]);
  });
});

describe('buildNoncompetitiveIndex', () => {
  it('compact rows with URL slug; null year/amount when contract_date/numeric missing', () => {
    const p = prepared({
      doc: exportDoc({
        noncompetitive: [
          nc({}),
          nc({ workspace_number: '2019-0442', supplier_name_raw: null, reason: null, division: null, contract_date: null, contract_amount: 'kj', contract_amount_numeric: null }),
          nc({ workspace_number: 'SR5252910024 / CW2310865' }),
        ],
      }),
    });
    expect(buildNoncompetitiveIndex(p)).toEqual([
      { w: '2021-0001', wl: '2021-0001', n: 'Acme Ltd', r: 'Sole source', v: 'Parks', y: 2021, a: 25000 },
      { w: '2019-0442', wl: '2019-0442', n: null, r: null, v: null, y: null, a: null },
      { w: 'SR5252910024 / CW2310865', wl: 'SR5252910024-CW2310865', n: 'Acme Ltd', r: 'Sole source', v: 'Parks', y: 2021, a: 25000 },
    ]);
  });
});

describe('buildCouncilIndex', () => {
  it('year parsed from the YYYY.CCNN.N reference; nb counts nested bids', () => {
    const p = prepared({
      doc: exportDoc({
        council_items: [
          council({ reference: '2019.GM5.10', title: 'Award of tender', bids: [bid({}), bid({}), bid({})] }),
          council({ reference: '2011.BA1.1', title: null }),
        ],
      }),
    });
    expect(buildCouncilIndex(p)).toEqual([
      { f: '2019.GM5.10', t: 'Award of tender', y: 2019, nb: 3 },
      { f: '2011.BA1.1', t: null, y: 2011, nb: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `npx vitest run tests/prepare/indexes.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/prepare/indexes" from "tests/prepare/indexes.test.ts". Does the file exist?`

- [ ] **Step 3: Write the implementation**

Create `src/prepare/indexes.ts`:

```ts
// Compact browse-index rows for the BrowseTable island (Task 19 serves them as
// /indexes/*.json). Keys are deliberately terse to keep the shipped JSON small;
// every key is documented on its interface.
import type { Prepared } from './types';
import { sumAwardNumeric } from './amounts';
import { wsSlug } from './slugs';
import { displayTitle, normalizeCategory } from './titles';

export interface SolicitationIndexRow { d: string; t: string; u: boolean; s: string; r: string | null; c: string | null; v: string | null; y: number; dl: string | null; a: number | null; nb: number; nd: number }
// d=document_number t=display title u=untitled s=status r=rfx_type c=normalized category
// v=division y=issue year dl=deadline a=deduped award total (null if none) nb=bid count nd=document count

export interface SupplierIndexRow { g: string; n: string; na: number; nb: number; a: number | null }
// g=slug n=display_name na=award-line count nb=bid count a=city award total

export interface NoncompetitiveIndexRow { w: string; wl: string; n: string | null; r: string | null; v: string | null; y: number | null; a: number | null }
// w=workspace_number (raw, displayed) wl=URL slug (wsSlug — links are /noncompetitive/{wl}/)
// n=supplier r=reason v=division y=contract year a=numeric amount

export interface CouncilIndexRow { f: string; t: string | null; y: number; nb: number }
// f=reference t=title y=year nb=bid count

export function buildSolicitationIndex(p: Prepared): SolicitationIndexRow[] {
  return p.doc.solicitations.map((sol) => {
    const d = sol.document_number;
    const title = displayTitle(sol);
    const dedupedRows = p.dedupedAwardsByDoc.get(d) ?? [];
    const total = sumAwardNumeric(
      dedupedRows.map((a) => ({ numeric: a.award_amount_numeric, verdict: a.award_amount_verdict })),
    );
    // Bids reach a solicitation two ways: nested directly (award_summary bids,
    // backend issue #145) and via the council bid-bridge.
    let councilBids = 0;
    for (const ref of p.bridge.docToRefs.get(d) ?? []) {
      const item = p.councilByRef.get(ref);
      if (!item) continue;
      councilBids += item.bids.filter((b) => b.document_number === d).length;
    }
    return {
      d, t: title.text, u: title.untitled, s: sol.status, r: sol.rfx_type,
      c: normalizeCategory(sol.category), v: sol.division,
      y: Number(sol.issue_date.slice(0, 4)), dl: sol.submission_deadline,
      a: dedupedRows.length > 0 ? total.total : null,
      nb: sol.bids.length + councilBids, nd: sol.documents.length,
    };
  });
}

export function buildSupplierIndex(p: Prepared): SupplierIndexRow[] {
  return [...p.rollupsBySlug.values()]
    .map((r) => ({
      g: r.slug, n: r.supplier.display_name, na: r.awards.length, nb: r.bids.length,
      a: r.awards.length > 0 ? r.totals.cityAwards.total : null,
    }))
    .sort((x, y) => x.n.localeCompare(y.n, 'en-CA') || x.g.localeCompare(y.g, 'en-CA'));
}

export function buildNoncompetitiveIndex(p: Prepared): NoncompetitiveIndexRow[] {
  // wl is computed with wsSlug directly (deterministic) — identical to the
  // value prepare() stores in Prepared.wsSlugByNumber, which has already
  // collision-checked every workspace_number before any index is built.
  return p.doc.noncompetitive.map((row) => ({
    w: row.workspace_number, wl: wsSlug(row.workspace_number),
    n: row.supplier_name_raw, r: row.reason, v: row.division,
    y: row.contract_date ? Number(row.contract_date.slice(0, 4)) : null,
    a: row.contract_amount_numeric,
  }));
}

export function buildCouncilIndex(p: Prepared): CouncilIndexRow[] {
  return p.doc.council_items.map((item) => ({
    f: item.reference, t: item.title,
    y: Number(item.reference.slice(0, 4)), nb: item.bids.length,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `npx vitest run tests/prepare/indexes.test.ts`
Expected: PASS — `Test Files  1 passed`, 5 tests passed.

- [ ] **Step 5: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/indexes.ts tests/prepare/indexes.test.ts && git commit -m "feat: compact browse index builders (solicitations, suppliers, noncompetitive, council)"
```

### Task 10: `prepare.ts` — prepare() + getPrepared() + integration test over the fixture

**Files:**
- Create: `src/prepare/prepare.ts`
- Test: `tests/prepare/prepare.test.ts`

**Interfaces:**
- Consumes: `validateExport` (Task 2); `sumAwardNumeric` (Task 4); `dedupeAwards` (Task 5); `buildSupplierSlugs`, `wsSlug` (Task 7); `buildBridge`, `buildSupplierRollups` (Task 8); `tests/fixtures/bids.fixture.json` (Task 3 — requires backend issues #144+#145 landed).
- Produces: `prepare(doc: ExportDoc): Prepared` and `getPrepared(): Promise<Prepared>` — every page task (13–21) calls `getPrepared()` at the top of frontmatter. `Prepared.counts` is computed by a local helper here; Task 11 replaces it with `countsOf` from `guard.ts` (same keys, same values). `prepare()` builds `dedupedAwardsByDoc` over each solicitation's awards AND the `unlinked_awards` bucket (grouped by `document_number`, run through `dedupeAwards`) — so unlinked awards reach Task 8's rollups (`sol: null` branch) and `headline.awardedTotal`; nothing is silently dropped. `prepare()` also builds `Prepared.wsSlugByNumber` (noncompetitive `workspace_number` → `wsSlug` URL slug) with a collision check that throws an `Error` naming BOTH colliding workspace_numbers — the same build-fails-loudly failure class as supplier slug collisions; consumed by Task 15's `getStaticPaths` and every `/noncompetitive/{slug}/` link.

- [ ] **Step 1: Write the failing integration test**

Create `tests/prepare/prepare.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ExportDoc, Prepared } from '../../src/prepare/types';
import { validateExport } from '../../src/prepare/validate';
import { wsSlug } from '../../src/prepare/slugs';
import { getPrepared, prepare } from '../../src/prepare/prepare';

const FIXTURE = 'tests/fixtures/bids.fixture.json';

describe('prepare() over the committed fixture', () => {
  let doc: ExportDoc;
  let p: Prepared;

  beforeAll(() => {
    doc = validateExport(JSON.parse(readFileSync(FIXTURE, 'utf8')));
    p = prepare(doc);
  });

  it('carries generatedAt from meta', () => {
    expect(p.generatedAt).toBe(doc.meta.generated_at);
  });

  it('lookup map sizes match the export arrays', () => {
    expect(p.solByDoc.size).toBe(doc.solicitations.length);
    expect(p.councilByRef.size).toBe(doc.council_items.length);
    // One (possibly empty) deduped-awards entry per solicitation, PLUS one
    // per distinct unlinked-award document_number — the unlinked_awards
    // bucket is never silently dropped (the fixture ships it empty, so the
    // two terms are equal there; the formula holds for real data too).
    expect(p.dedupedAwardsByDoc.size).toBe(
      doc.solicitations.length + new Set(doc.unlinked_awards.map((a) => a.document_number)).size,
    );
    expect(p.supplierSlugById.size).toBe(doc.suppliers.length);
    expect(p.wsSlugByNumber.size).toBe(new Set(doc.noncompetitive.map((n) => n.workspace_number)).size);
    // One rollup per supplier — supplier pages exist for every supplier.
    expect(p.rollupsBySlug.size).toBe(doc.suppliers.length);
  });

  it('dedupe never increases row counts and collapses dual-source groups', () => {
    for (const sol of doc.solicitations) {
      const rows = p.dedupedAwardsByDoc.get(sol.document_number)!;
      expect(rows.length).toBeLessThanOrEqual(sol.awards.length);
    }
    // The fixture is required to contain a dual-source (odata + ckan_awarded) award.
    const collapsed = [...p.dedupedAwardsByDoc.values()].flat().filter((a) => a.sources.length > 1);
    expect(collapsed.length).toBeGreaterThan(0);
  });

  it('compositeCalls group every line exactly once, sorted by call_number', () => {
    const lineTotal = p.compositeCalls.reduce((n, c) => n + c.lines.length, 0);
    expect(lineTotal).toBe(doc.composite_awards.length);
    const callNumbers = p.compositeCalls.map((c) => c.call_number);
    expect(callNumbers).toEqual([...callNumbers].sort((a, b) => a.localeCompare(b, 'en-CA')));
    expect(new Set(callNumbers).size).toBe(callNumbers.length);
  });

  it('headline is consistent with the document', () => {
    expect(p.headline.solicitations).toBe(doc.solicitations.length);
    expect(p.headline.supplierCount).toBe(doc.suppliers.length);
    expect(p.headline.openCount).toBe(doc.solicitations.filter((s) => s.status === 'Open').length);
    const solBids = doc.solicitations.reduce((n, s) => n + s.bids.length, 0);
    const councilBids = doc.council_items.reduce((n, c) => n + c.bids.length, 0);
    expect(p.headline.bidCount).toBe(solBids + councilBids + doc.unlinked_bids.length);
    const dedupedRows = [...p.dedupedAwardsByDoc.values()].flat();
    expect(dedupedRows.length).toBeGreaterThan(0);
    expect(p.headline.awardedTotal.counted + p.headline.awardedTotal.skipped).toBe(dedupedRows.length);
    expect(p.headline.awardedTotal.total).toBeGreaterThanOrEqual(0);
    expect(p.headline.noncompetitiveTotal.counted + p.headline.noncompetitiveTotal.skipped)
      .toBe(doc.noncompetitive.length);
  });

  it('counts agree with headline and export arrays', () => {
    expect(p.counts.solicitations).toBe(doc.solicitations.length);
    expect(p.counts.bids).toBe(p.headline.bidCount);
    expect(p.counts.suppliers).toBe(doc.suppliers.length);
    expect(p.counts.council_items).toBe(doc.council_items.length);
    expect(p.counts.composite_awards).toBe(doc.composite_awards.length);
    expect(p.counts.noncompetitive).toBe(doc.noncompetitive.length);
  });

  it('maps every workspace_number to its wsSlug URL slug', () => {
    expect(doc.noncompetitive.length).toBeGreaterThan(0); // fixture guarantee (Task 3)
    for (const row of doc.noncompetitive) {
      expect(p.wsSlugByNumber.get(row.workspace_number)).toBe(wsSlug(row.workspace_number));
    }
  });

  it('throws on a workspace slug collision, naming BOTH workspace_numbers', () => {
    const ncRow = (workspace_number: string): ExportDoc['noncompetitive'][number] => ({
      workspace_number, supplier_name_raw: 'Acme Ltd', supplier_id: null, reason: 'Sole source',
      contract_amount: '$1.00', contract_amount_numeric: 1, contract_amount_labelled: null,
      contract_amount_verdict: null, contract_date: '2021-01-01', division: null,
      council_authority_link: null, source: 'ckan', first_seen: '2026-01-01', last_seen: '2026-07-18',
    });
    const clone = structuredClone(doc);
    clone.noncompetitive.push(ncRow('WS 100'), ncRow('WS  100')); // both slug to "WS-100"
    expect(() => prepare(clone)).toThrowError(
      'Workspace slug collision: "WS-100" from workspace_number "WS 100" and workspace_number "WS  100"',
    );
  });

  it('routes unlinked_awards through dedupeAwards into dedupedAwardsByDoc', () => {
    const clone = structuredClone(doc);
    const unlinked: ExportDoc['unlinked_awards'][number] = {
      document_number: '8888888888', supplier_name_raw: 'Orphan Paving Ltd', supplier_id: null,
      award_amount: '$500.00', award_amount_numeric: 500, award_amount_labelled: null,
      award_amount_verdict: null, award_date: '2024-01-01', source: 'ckan_awarded',
      first_seen: '2026-01-01', last_seen: '2026-07-18',
    };
    clone.unlinked_awards.push(unlinked, { ...unlinked, source: 'odata' });
    const p2 = prepare(clone);
    const rows = p2.dedupedAwardsByDoc.get('8888888888')!;
    expect(rows).toHaveLength(1); // the dual-source pair collapses like any linked award group
    expect(rows[0]!.sources).toEqual(['odata', 'ckan_awarded']); // odata-first ordering (Task 5)
    expect(p2.dedupedAwardsByDoc.size).toBe(
      clone.solicitations.length + new Set(clone.unlinked_awards.map((a) => a.document_number)).size,
    );
  });
});

describe('getPrepared()', () => {
  it('loads TB_DATA_FILE, validates, prepares, and caches', async () => {
    process.env.TB_DATA_FILE = FIXTURE;
    const a = await getPrepared();
    const b = await getPrepared();
    expect(b).toBe(a); // cached: same object, no re-read
    expect(a.generatedAt).toBeTruthy();
    expect(a.solByDoc.size).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `npx vitest run tests/prepare/prepare.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/prepare/prepare" from "tests/prepare/prepare.test.ts". Does the file exist?`

- [ ] **Step 3: Write the implementation**

Create `src/prepare/prepare.ts`:

```ts
// The prepare step: turns a validated ExportDoc into everything the pages need.
// Pure except getPrepared(), which reads the export file once and caches.
import { readFile } from 'node:fs/promises';
import type { AwardRow, CompositeCall, DedupedAward, ExportDoc, Headline, Prepared } from './types';
import { validateExport } from './validate';
import { sumAwardNumeric } from './amounts';
import { dedupeAwards } from './awards';
import { buildSupplierSlugs, wsSlug } from './slugs';
import { buildBridge, buildSupplierRollups } from './links';

function buildCompositeCalls(doc: ExportDoc): CompositeCall[] {
  const byCall = new Map<string, CompositeCall>();
  for (const line of doc.composite_awards) {
    let call = byCall.get(line.call_number);
    if (!call) {
      call = { call_number: line.call_number, reference: null, title: null, lines: [], total: { total: 0, counted: 0, skipped: 0 } };
      byCall.set(line.call_number, call);
    }
    call.lines.push(line);
    call.reference ??= line.reference; // first non-null wins
    call.title ??= line.title;
  }
  const calls = [...byCall.values()].sort((a, b) => a.call_number.localeCompare(b.call_number, 'en-CA'));
  for (const call of calls) {
    call.total = sumAwardNumeric(call.lines.map((l) => ({ numeric: l.award_value_numeric, verdict: null })));
  }
  return calls;
}

// Entity counts (bids = council-nested + solicitation-nested + unlinked).
// Task 11 extracts this contract into guard.ts countsOf and replaces this
// helper with an import; keys and values are identical.
function localCounts(doc: ExportDoc): Record<string, number> {
  return {
    solicitations: doc.solicitations.length,
    awards: doc.solicitations.reduce((n, s) => n + s.awards.length, 0) + doc.unlinked_awards.length,
    bids: doc.council_items.reduce((n, c) => n + c.bids.length, 0)
      + doc.solicitations.reduce((n, s) => n + s.bids.length, 0)
      + doc.unlinked_bids.length,
    noncompetitive: doc.noncompetitive.length,
    suppliers: doc.suppliers.length,
    council_items: doc.council_items.length,
    composite_awards: doc.composite_awards.length,
  };
}

export function prepare(doc: ExportDoc): Prepared {
  const dedupedAwardsByDoc = new Map<string, DedupedAward[]>();
  for (const sol of doc.solicitations) {
    dedupedAwardsByDoc.set(sol.document_number, dedupeAwards(sol.awards));
  }
  // Unlinked awards (document_number matching no exported solicitation) are
  // never silently dropped: group by document_number and dedupe exactly like
  // linked awards, so supplier rollups (sol: null branch, Task 8) and
  // headline.awardedTotal include them. By definition of "unlinked" these
  // keys cannot collide with a solicitation's document_number.
  const unlinkedAwardsByDoc = new Map<string, AwardRow[]>();
  for (const award of doc.unlinked_awards) {
    const group = unlinkedAwardsByDoc.get(award.document_number);
    if (group) group.push(award);
    else unlinkedAwardsByDoc.set(award.document_number, [award]);
  }
  for (const [documentNumber, group] of unlinkedAwardsByDoc) {
    dedupedAwardsByDoc.set(documentNumber, dedupeAwards(group));
  }
  const bridge = buildBridge(doc.council_items);
  const supplierSlugById = buildSupplierSlugs(doc.suppliers);
  // Workspace-number slugs for /noncompetitive/ URLs (wsSlug, Task 7). Two
  // distinct workspace_numbers slugging identically would merge two records'
  // permalinks, so a collision throws naming both — the same fails-loudly
  // class as supplier slug collisions. Duplicate rows of the SAME
  // workspace_number are fine and share a slug.
  const wsSlugByNumber = new Map<string, string>();
  const wsNumberBySlug = new Map<string, string>();
  for (const row of doc.noncompetitive) {
    const slug = wsSlug(row.workspace_number);
    const existing = wsNumberBySlug.get(slug);
    if (existing !== undefined && existing !== row.workspace_number) {
      throw new Error(
        `Workspace slug collision: "${slug}" from workspace_number "${existing}" and workspace_number "${row.workspace_number}"`,
      );
    }
    wsNumberBySlug.set(slug, row.workspace_number);
    wsSlugByNumber.set(row.workspace_number, slug);
  }
  const rollupsBySlug = buildSupplierRollups(doc, supplierSlugById, dedupedAwardsByDoc);
  const councilByRef = new Map(doc.council_items.map((c) => [c.reference, c] as const));
  const solByDoc = new Map(doc.solicitations.map((s) => [s.document_number, s] as const));
  const allDeduped = [...dedupedAwardsByDoc.values()].flat();
  const counts = localCounts(doc);
  const headline: Headline = {
    solicitations: doc.solicitations.length,
    // City-only, deduped, *_numeric only, not_an_award excluded — a machine-parseable undercount.
    awardedTotal: sumAwardNumeric(allDeduped.map((a) => ({ numeric: a.award_amount_numeric, verdict: a.award_amount_verdict }))),
    noncompetitiveTotal: sumAwardNumeric(doc.noncompetitive.map((n) => ({ numeric: n.contract_amount_numeric, verdict: n.contract_amount_verdict }))),
    openCount: doc.solicitations.filter((s) => s.status === 'Open').length,
    bidCount: counts.bids,
    supplierCount: doc.suppliers.length,
  };
  return {
    doc, generatedAt: doc.meta.generated_at, dedupedAwardsByDoc, bridge,
    supplierSlugById, wsSlugByNumber, rollupsBySlug, compositeCalls: buildCompositeCalls(doc),
    councilByRef, solByDoc, headline, counts,
  };
}

let cached: Promise<Prepared> | null = null;

export function getPrepared(): Promise<Prepared> {
  cached ??= (async () => {
    const path = process.env.TB_DATA_FILE ?? '.data/bids.json';
    const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
    return prepare(validateExport(raw));
  })();
  return cached;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `npx vitest run tests/prepare/prepare.test.ts`
Expected: PASS — `Test Files  1 passed`, 10 tests passed.

- [ ] **Step 5: Run the whole unit suite (regression)**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `npx vitest run`
Expected: PASS — all test files pass, none skipped unexpectedly.

- [ ] **Step 6: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/prepare.ts tests/prepare/prepare.test.ts && git commit -m "feat: prepare() orchestrator and cached getPrepared() loader with fixture integration test"
```

### Task 11: `guard.ts` — countsOf + checkShrink + `scripts/check-shrink.ts`

**Files:**
- Create: `src/prepare/guard.ts`
- Create: `scripts/check-shrink.ts`
- Modify: `src/prepare/prepare.ts` (replace `localCounts` with `countsOf`)
- Test: `tests/prepare/guard.test.ts`

**Interfaces:**
- Consumes: `ExportDoc` and row types (Task 2); `validateExport` (Task 2); `src/prepare/prepare.ts` (Task 10 — its inline `localCounts` is replaced here).
- Produces: `countsOf(doc: ExportDoc): Record<string, number>` (keys: `solicitations, awards, bids, noncompetitive, suppliers, council_items, composite_awards`) and `checkShrink(previous, current): string[]`; `scripts/check-shrink.ts` is the deploy gate wired into `deploy.yml` in Task 22 (reads `.data/bids.json` and optional `.data/previous-counts.json`, exits 1 printing violations).

- [ ] **Step 1: Write the failing test**

Create `tests/prepare/guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AwardRow, BidRow, CompositeAward, CouncilItem, ExportDoc, Solicitation } from '../../src/prepare/types';
import { checkShrink, countsOf } from '../../src/prepare/guard';

function award(over: Partial<AwardRow>): AwardRow {
  return {
    supplier_name_raw: 'Acme Ltd', supplier_id: 1, award_amount: '$1,000.00',
    award_amount_numeric: 1000, award_amount_labelled: null, award_amount_verdict: null,
    award_date: '2023-06-01', source: 'odata', first_seen: '2026-01-01', last_seen: '2026-07-18',
    ...over,
  };
}

function bid(over: Partial<BidRow>): BidRow {
  return {
    reference: null, document_number: null, bidder_name_raw: 'Acme Ltd', supplier_id: 1,
    bid_price: '$10.00', bid_price_numeric: 10, hst_basis: 'including', price_header: null,
    source: 'council', first_seen: '2026-01-01', last_seen: '2026-07-18', ...over,
  };
}

function sol(over: Partial<Solicitation>): Solicitation {
  return {
    document_number: '1000000001', status: 'Awarded', rfx_type: 'RFQ', noip_type: null,
    form_type: null, title: null, description: null, issue_date: '2023-04-01',
    submission_deadline: null, category: null, division: null, buyer_name: null,
    buyer_email: null, buyer_phone: null, wards: null, ariba_posting_link: null,
    source: 'ckan', title_source: null, first_seen: '2026-01-01', last_seen: '2026-07-18',
    awards: [], ariba_postings: [], documents: [], bids: [], ...over,
  };
}

function council(over: Partial<CouncilItem>): CouncilItem {
  return {
    reference: '2023.PW1.1', title: 'Award of contract', decision_text: null,
    first_seen: '2026-01-01', last_seen: '2026-07-18', background_pdfs: [], bids: [], ...over,
  };
}

function comp(id: number): CompositeAward {
  return {
    id, call_number: '3405-09-3197', call_number_raw: null, reference: null, title: null,
    supplier_name_raw: 'Acme Ltd', supplier_id: 1, award_value: '$10.00', award_value_numeric: 10,
    source: 'council_composite', first_seen: '2026-01-01', last_seen: '2026-07-18',
  };
}

function exportDoc(over: Partial<ExportDoc>): ExportDoc {
  return {
    meta: { generated_at: '2026-07-18T05:30:00Z', counts: {}, sources: [] },
    solicitations: [], noncompetitive: [], suspended_firms: [], suppliers: [],
    capital_projects: [], composite_awards: [], council_items: [],
    unlinked_ariba_postings: [], unlinked_awards: [], unlinked_bids: [], buyers: [], ...over,
  };
}

describe('countsOf', () => {
  it('bids = council-nested + solicitation-nested + unlinked; awards include unlinked', () => {
    const d = exportDoc({
      solicitations: [
        sol({ document_number: '1000000001', awards: [award({}), award({ source: 'ckan_awarded' })], bids: [bid({ document_number: '1000000001', source: 'award_summary' })] }),
        sol({ document_number: '1000000002', awards: [award({})] }),
      ],
      council_items: [council({ bids: [bid({ reference: '2023.PW1.1' }), bid({ reference: '2023.PW1.1' })] })],
      unlinked_awards: [{ ...award({}), document_number: '9999999999' }],
      unlinked_bids: [bid({ document_number: '9999999999', source: 'award_summary' })],
      noncompetitive: [{
        workspace_number: '2021-0001', supplier_name_raw: 'Acme Ltd', supplier_id: 1,
        reason: 'Sole source', contract_amount: '$25,000.00', contract_amount_numeric: 25000,
        contract_amount_labelled: null, contract_amount_verdict: null, contract_date: '2021-03-15',
        division: 'Parks', council_authority_link: null, source: 'ckan',
        first_seen: '2026-01-01', last_seen: '2026-07-18',
      }],
      suppliers: [
        { supplier_id: 1, supplier_key: 'ACME LTD', display_name: 'Acme Ltd', variants: [], first_seen: '2026-01-01', last_seen: '2026-07-18' },
        { supplier_id: 2, supplier_key: 'ZETA CORP', display_name: 'Zeta Corp', variants: [], first_seen: '2026-01-01', last_seen: '2026-07-18' },
      ],
      composite_awards: [comp(1), comp(2), comp(3)],
    });
    expect(countsOf(d)).toEqual({
      solicitations: 2,
      awards: 4,        // 2 + 1 nested + 1 unlinked
      bids: 4,          // 2 council + 1 solicitation + 1 unlinked
      noncompetitive: 1,
      suppliers: 2,
      council_items: 1,
      composite_awards: 3,
    });
  });
});

describe('checkShrink', () => {
  it('returns [] when previous is null (first deploy)', () => {
    expect(checkShrink(null, { solicitations: 10 })).toEqual([]);
  });

  it('allows a drop of exactly 20%', () => {
    expect(checkShrink({ solicitations: 100 }, { solicitations: 80 })).toEqual([]);
  });

  it('flags a drop just over 20%', () => {
    const v = checkShrink({ solicitations: 100 }, { solicitations: 79 });
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('solicitations');
    expect(v[0]).toContain('79');
    expect(v[0]).toContain('100');
  });

  it('allows growth and equal counts', () => {
    expect(checkShrink({ bids: 50, suppliers: 7 }, { bids: 51, suppliers: 7 })).toEqual([]);
  });

  it('treats a key missing from current as 0', () => {
    const v = checkShrink({ bids: 10 }, {});
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('bids');
  });

  it('reports every violated key', () => {
    expect(checkShrink({ bids: 100, awards: 100 }, { bids: 1, awards: 1 })).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `npx vitest run tests/prepare/guard.test.ts`
Expected: FAIL with `Failed to resolve import "../../src/prepare/guard" from "tests/prepare/guard.test.ts". Does the file exist?`

- [ ] **Step 3: Write the implementation**

Create `src/prepare/guard.ts` (type-only imports so Node can run the script chain with type stripping):

```ts
// Deploy shrink guard. countsOf() is published as counts.json after each
// deploy; the next build fetches it and refuses to deploy if any entity
// count shrank by more than 20% — the archive never silently shrinks.
import type { ExportDoc } from './types';

// Keys: solicitations, awards, bids, noncompetitive, suppliers, council_items,
// composite_awards. bids = council-nested + solicitation-nested + unlinked.
export function countsOf(doc: ExportDoc): Record<string, number> {
  return {
    solicitations: doc.solicitations.length,
    awards: doc.solicitations.reduce((n, s) => n + s.awards.length, 0) + doc.unlinked_awards.length,
    bids: doc.council_items.reduce((n, c) => n + c.bids.length, 0)
      + doc.solicitations.reduce((n, s) => n + s.bids.length, 0)
      + doc.unlinked_bids.length,
    noncompetitive: doc.noncompetitive.length,
    suppliers: doc.suppliers.length,
    council_items: doc.council_items.length,
    composite_awards: doc.composite_awards.length,
  };
}

// Violation when current < 80% of previous on any key previous knows about.
// Exactly 20% is allowed. previous === null (first deploy) never violates.
// Integer comparison (cur*5 < prev*4) avoids float rounding at the boundary.
export function checkShrink(
  previous: Record<string, number> | null,
  current: Record<string, number>,
): string[] {
  if (previous === null) return [];
  const violations: string[] = [];
  for (const [key, prev] of Object.entries(previous)) {
    const cur = current[key] ?? 0;
    if (cur * 5 < prev * 4) {
      violations.push(`${key}: count dropped from ${prev} to ${cur} — more than the 20% guard allows`);
    }
  }
  return violations;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `npx vitest run tests/prepare/guard.test.ts`
Expected: PASS — `Test Files  1 passed`, 7 tests passed.

- [ ] **Step 5: Point `prepare.ts` at `countsOf` (delete the inline copy)**

Apply exactly three edits to `src/prepare/prepare.ts`.

Edit 1 — add the import. Replace:

```ts
import { buildBridge, buildSupplierRollups } from './links';
```

with:

```ts
import { buildBridge, buildSupplierRollups } from './links';
import { countsOf } from './guard';
```

Edit 2 — delete the entire `localCounts` helper (the comment lines starting `// Entity counts (bids = council-nested ...` through the closing `}` of `function localCounts`).

Edit 3 — in `prepare()`, replace:

```ts
  const counts = localCounts(doc);
```

with:

```ts
  const counts = countsOf(doc);
```

- [ ] **Step 6: Run the whole unit suite to confirm the refactor is invisible**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `npx vitest run`
Expected: PASS — all test files pass, including `tests/prepare/prepare.test.ts` (its counts assertions prove `countsOf` matches the old inline values).

- [ ] **Step 7: Commit the guard module**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/prepare/guard.ts tests/prepare/guard.test.ts src/prepare/prepare.ts && git commit -m "feat: shrink guard countsOf/checkShrink; prepare() uses countsOf"
```

- [ ] **Step 8: Write `scripts/check-shrink.ts`**

Create `scripts/check-shrink.ts` (note the explicit `.ts` extensions — required for Node's type stripping):

```ts
// Deploy gate: refuse to build when the fresh export shrank >20% vs the
// previous deploy's published counts. Run by deploy.yml after fetch-data and
// the counts.json download, before `npm run build`.
//   Reads: .data/bids.json                 (required — the fresh export)
//          .data/previous-counts.json      (optional — absent on first deploy)
//   Exit:  0 with counts printed, or 1 listing every violation.
import { existsSync, readFileSync } from 'node:fs';
import { validateExport } from '../src/prepare/validate.ts';
import { checkShrink, countsOf } from '../src/prepare/guard.ts';

const doc = validateExport(JSON.parse(readFileSync('.data/bids.json', 'utf8')));
const current = countsOf(doc);
const previous: Record<string, number> | null = existsSync('.data/previous-counts.json')
  ? (JSON.parse(readFileSync('.data/previous-counts.json', 'utf8')) as Record<string, number>)
  : null;
if (previous === null) {
  console.log('No previous counts found (first deploy?) — shrink guard skipped.');
}
const violations = checkShrink(previous, current);
if (violations.length > 0) {
  console.error('Shrink guard FAILED — refusing to deploy:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`Shrink guard OK. Counts: ${JSON.stringify(current)}`);
```

- [ ] **Step 9: Verify the OK path against the fixture**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
mkdir -p .data && cp tests/fixtures/bids.fixture.json .data/bids.json && rm -f .data/previous-counts.json && node scripts/check-shrink.ts
```

Expected: prints `No previous counts found (first deploy?) — shrink guard skipped.` then `Shrink guard OK. Counts: {"solicitations":...}` (numbers matching the fixture), exit code 0. If it fails with `ERR_MODULE_NOT_FOUND` for `./types`, a src module used a value import for types — change it to `import type` (erasable-syntax rule from the plan header) and re-run.

- [ ] **Step 10: Verify the violation path exits 1**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
node -e 'require("fs").writeFileSync(".data/previous-counts.json", JSON.stringify({ solicitations: 999999 }))' && node scripts/check-shrink.ts; echo "exit=$?"
```

Expected: prints `Shrink guard FAILED — refusing to deploy:` then `  solicitations: count dropped from 999999 to <N> — more than the 20% guard allows`, and `exit=1`. Then clean up:

```bash
rm -f .data/previous-counts.json
```

- [ ] **Step 11: Commit the script**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add scripts/check-shrink.ts && git commit -m "feat: check-shrink deploy gate script"
```

### Task 12: `scripts/fetch-data.ts`

**Files:**
- Create: `scripts/fetch-data.ts`
- Test: `tests/prepare/fetch-data.test.ts`

**Interfaces:**
- Consumes: nothing from `src/` — standalone script. Its `TB_DATA_FILE` skip contract mirrors `getPrepared()` (Task 10): when `TB_DATA_FILE` is set the build reads that file directly, so there is nothing to download.
- Produces: `scripts/fetch-data.ts` run by `deploy.yml` (Task 22) with `TB_DATA_URL` set to the `latest` release asset; exports `fetchDecision`, `DEFAULT_URL`, `DEST` for the unit test. The live download path depends on backend issue #146 (release assets exist); verification below exercises only the skip, `--help`, and HTTP-error paths.

- [ ] **Step 1: Write the failing test for the pure decision logic**

Create `tests/prepare/fetch-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_URL, fetchDecision } from '../../scripts/fetch-data';

describe('fetchDecision', () => {
  it('skips when TB_DATA_FILE is set', () => {
    expect(fetchDecision({ TB_DATA_FILE: 'tests/fixtures/bids.fixture.json' }))
      .toEqual({ mode: 'skip', file: 'tests/fixtures/bids.fixture.json' });
  });

  it('TB_DATA_FILE wins even when TB_DATA_URL is also set', () => {
    expect(fetchDecision({ TB_DATA_FILE: 'x.json', TB_DATA_URL: 'https://example.com/bids.json' }))
      .toEqual({ mode: 'skip', file: 'x.json' });
  });

  it('downloads from TB_DATA_URL when TB_DATA_FILE is unset', () => {
    expect(fetchDecision({ TB_DATA_URL: 'https://example.com/bids.json' }))
      .toEqual({ mode: 'download', url: 'https://example.com/bids.json' });
  });

  it('falls back to the latest-release URL when neither is set', () => {
    expect(fetchDecision({})).toEqual({ mode: 'download', url: DEFAULT_URL });
    expect(DEFAULT_URL).toBe('https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/bids.json');
  });

  it('treats empty strings as unset', () => {
    expect(fetchDecision({ TB_DATA_FILE: '', TB_DATA_URL: '' }))
      .toEqual({ mode: 'download', url: DEFAULT_URL });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `npx vitest run tests/prepare/fetch-data.test.ts`
Expected: FAIL with `Failed to resolve import "../../scripts/fetch-data" from "tests/prepare/fetch-data.test.ts". Does the file exist?`

- [ ] **Step 3: Write the script**

Create `scripts/fetch-data.ts`:

```ts
// Download the nightly export to .data/bids.json (streamed, not buffered —
// the export is ~24 MB). Skipped entirely when TB_DATA_FILE is set: dev and
// CI builds read that file directly via getPrepared(). Fails non-zero on any
// HTTP or network error so deploy.yml stops before building.
// The main body only runs when invoked directly (node scripts/fetch-data.ts),
// so vitest can import fetchDecision without side effects.
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

export const DEFAULT_URL =
  'https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/bids.json';
export const DEST = '.data/bids.json';

export type FetchDecision =
  | { mode: 'skip'; file: string }
  | { mode: 'download'; url: string };

// Pure decision logic — unit-tested in tests/prepare/fetch-data.test.ts.
// Empty-string env vars count as unset.
export function fetchDecision(env: Record<string, string | undefined>): FetchDecision {
  const file = env.TB_DATA_FILE;
  if (file !== undefined && file !== '') return { mode: 'skip', file };
  const url = env.TB_DATA_URL !== undefined && env.TB_DATA_URL !== '' ? env.TB_DATA_URL : DEFAULT_URL;
  return { mode: 'download', url };
}

const USAGE = `Usage: node scripts/fetch-data.ts [--help]

Downloads the nightly export to ${DEST}.
  TB_DATA_FILE  when set, skip the download (the build reads this file instead)
  TB_DATA_URL   source URL (default: ${DEFAULT_URL})
Exits 1 on HTTP or network failure.`;

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    console.log(USAGE);
    return;
  }
  const decision = fetchDecision(process.env);
  if (decision.mode === 'skip') {
    console.log(`TB_DATA_FILE is set (${decision.file}); skipping download.`);
    return;
  }
  console.log(`Fetching ${decision.url} -> ${DEST}`);
  const res = await fetch(decision.url);
  if (!res.ok || res.body === null) {
    console.error(`Download failed: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  await mkdir('.data', { recursive: true });
  await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), createWriteStream(DEST));
  console.log(`Wrote ${DEST}`);
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err: unknown) => {
    console.error(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `npx vitest run tests/prepare/fetch-data.test.ts`
Expected: PASS — `Test Files  1 passed`, 5 tests passed.

- [ ] **Step 5: Verify `--help` and the skip path manually**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
node scripts/fetch-data.ts --help
```

Expected: prints the usage block starting `Usage: node scripts/fetch-data.ts [--help]`, exit 0, no network access, nothing written.

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json node scripts/fetch-data.ts && echo "exit=$?"
```

Expected: prints `TB_DATA_FILE is set (tests/fixtures/bids.fixture.json); skipping download.` then `exit=0`; `.data/bids.json` is not touched.

- [ ] **Step 6: Verify the HTTP-error path exits 1 (network-dependent)**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
TB_DATA_URL=https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/no-such-asset.json node scripts/fetch-data.ts; echo "exit=$?"
```

Expected: prints `Fetching https://github.com/...no-such-asset.json -> .data/bids.json` then `Download failed: HTTP 404 Not Found`, and `exit=1`. (Requires network; any 404-returning URL works if the repo does not exist yet.)

- [ ] **Step 7: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add scripts/fetch-data.ts tests/prepare/fetch-data.test.ts && git commit -m "feat: fetch-data script streams the latest export to .data/bids.json"
```

### Task 13: Base layout, shared components, `lib/url.ts`, global css, home, about, 404, `counts.json` endpoint, site-test harness

All commands in this task run in the frontend repo: `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`.

**Files:**
- Create: `src/lib/url.ts`
- Create: `tests/prepare/url.test.ts`
- Create: `src/styles/global.css` (overwrite if the Task 1 scaffold stubbed it)
- Create: `src/layouts/Base.astro`
- Create: `src/components/AmountCell.astro`
- Create: `src/components/ProvenanceBadge.astro`
- Create: `src/components/DocumentsList.astro`
- Create: `src/components/BidsTable.astro`
- Create: `src/components/StatsStrip.astro`
- Create: `src/pages/index.astro`
- Create: `src/pages/about.astro`
- Create: `src/pages/404.astro`
- Create: `src/pages/counts.json.ts`
- Create: `vitest.site.config.ts` (overwrite if the Task 1 scaffold stubbed it)
- Create: `tests/site/helpers.ts`
- Create: `tests/site/base.test.ts`

**Interfaces:**
- Consumes: `getPrepared(): Promise<Prepared>` (Task 10), `formatCAD` (Task 4), `TITLE_SOURCE_LABELS` (Task 6), types from `src/prepare/types.ts` (Task 2), committed fixture `tests/fixtures/bids.fixture.json` (Task 3), installed deps astro/vitest/cheerio/tailwind (Task 1).
- Produces: `href(path: string, base?: string): string` in `src/lib/url.ts`; `Base.astro` with props `{ title: string; description?: string; pagefind?: boolean; filters?: Record<string, string> }` (renders the `h1`, pagefind body/meta/filter markup, and the `Data as of {generatedAt}` footer on every page); components `AmountCell` (`{ raw: string | null; numeric: number | null }`), `ProvenanceBadge` (`{ titleSource: string | null }`), `DocumentsList` (`{ documents: DocumentEntry[] }`), `BidsTable` (`{ bids: BidRow[]; winners?: string[]; supplierSlugById?: Map<number, string> }` — the Result column renders ONLY when `winners !== undefined && winners.length > 0`, otherwise no Result column and no winner/loser claim; winner matching is `new Set((winners ?? []).map((w) => w.trim().toLowerCase()))` against the trimmed/lowercased bidder name; bidder names link to `/suppliers/{slug}/` only when `supplierSlugById` is provided AND `bid.supplier_id != null` AND the map has that id, else plain text — consumed by Tasks 14 and 16), `StatsStrip` (`{ headline: Headline }`); site-test helpers `loadPage(relPath: string): CheerioAPI`, `loadFile(relPath: string): string`, `loadFixture(): ExportDoc`; the canonical site-test command used by all later page tasks: `TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts`.

- [ ] **Step 1: Write the failing unit test for `href()`**

```ts
// tests/prepare/url.test.ts
import { describe, expect, it } from 'vitest';
import { href } from '../../src/lib/url';

describe('href', () => {
  it('joins a GitHub Pages base path without double slashes', () => {
    expect(href('/solicitations/3524228095/', '/toronto-bids-frontend')).toBe(
      '/toronto-bids-frontend/solicitations/3524228095/',
    );
  });
  it('handles a base with a trailing slash', () => {
    expect(href('/solicitations/3524228095/', '/toronto-bids-frontend/')).toBe(
      '/toronto-bids-frontend/solicitations/3524228095/',
    );
  });
  it("href('/') resolves to the base root", () => {
    expect(href('/', '/toronto-bids-frontend')).toBe('/toronto-bids-frontend/');
    expect(href('/', '/')).toBe('/');
  });
  it('works with root base', () => {
    expect(href('/about/', '/')).toBe('/about/');
  });
  it('prepends a slash to relative paths', () => {
    expect(href('about/', '/')).toBe('/about/');
  });
  it('defaults the base to import.meta.env.BASE_URL (vitest default "/")', () => {
    expect(href('/data/')).toBe('/data/');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (frontend repo): `npx vitest run tests/prepare/url.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/url'` (or `Failed to resolve import`).

- [ ] **Step 3: Write `src/lib/url.ts`**

```ts
// src/lib/url.ts
/**
 * Join the site base path (GitHub Pages project path) with an internal path.
 * ALL internal links go through this. The base parameter exists so unit tests
 * can pass it explicitly; pages rely on the import.meta.env.BASE_URL default.
 */
export function href(path: string, base: string = import.meta.env.BASE_URL): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  const joined = `${b}${p}`;
  return joined === '' ? '/' : joined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (frontend repo): `npx vitest run tests/prepare/url.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/url.ts tests/prepare/url.test.ts && git commit -m "feat: add href() URL helper for GitHub Pages base path"
```

- [ ] **Step 6: Write the site-test harness (config + helpers) and the first failing site tests**

```ts
// vitest.site.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/site/**/*.test.ts'],
  },
});
```

```ts
// tests/site/helpers.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { ExportDoc } from '../../src/prepare/types';

/** Load a built page by its URL path (directory format). Pass '' for the root page. */
export function loadPage(relPath: string): CheerioAPI {
  return cheerio.load(readFileSync(join('dist', relPath, 'index.html'), 'utf-8'));
}

/** Read an exact file under dist/ (e.g. 'counts.json', '404.html'). */
export function loadFile(relPath: string): string {
  return readFileSync(join('dist', relPath), 'utf-8');
}

/** The committed fixture the site was built from (site tests assert against it). */
export function loadFixture(): ExportDoc {
  return JSON.parse(readFileSync('tests/fixtures/bids.fixture.json', 'utf-8')) as ExportDoc;
}
```

```ts
// tests/site/base.test.ts
import { describe, expect, it } from 'vitest';
import { loadFile, loadFixture, loadPage } from './helpers';

describe('home page', () => {
  it('shows headline stats labeled City-only with the undercount caveat', () => {
    const $ = loadPage('');
    expect($('.stats-strip').length).toBe(1);
    expect($('.stats-caveat').text()).toContain('City records only');
    expect($('.stats-caveat').text()).toContain('undercount');
  });
  it('shows the freshness date from meta.generated_at in the footer', () => {
    const $ = loadPage('');
    expect($('footer').text()).toContain(`Data as of ${loadFixture().meta.generated_at}`);
  });
  it('has a search form pointing at /search/', () => {
    const $ = loadPage('');
    expect($('form[role="search"]').attr('action')).toBe('/search/');
  });
  it('links every spec page so none is orphaned', () => {
    const $ = loadPage('');
    for (const path of ['/calls/', '/capital-projects/', '/suspended-firms/', '/buyers/']) {
      expect($(`a[href="${path}"]`).length, `missing home link to ${path}`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('footer on every page', () => {
  for (const page of ['', 'about']) {
    it(`renders "Data as of" and a /data/ link on /${page}`, () => {
      const $ = loadPage(page);
      expect($('footer').text()).toContain('Data as of');
      expect($('footer a[href="/data/"]').length).toBe(1);
    });
  }
  it('renders "Data as of" on the 404 page', () => {
    expect(loadFile('404.html')).toContain('Data as of');
  });
});

describe('404 page', () => {
  it('explains the five keyspaces and offers search', () => {
    const html = loadFile('404.html');
    expect(html).toContain('document number');
    expect(html).toContain('workspace number');
    expect(html).toContain('call number');
    expect(html).toContain('council reference');
    expect(html).toContain('role="search"');
  });
});

describe('counts.json', () => {
  it('parses with the expected count keys', () => {
    const counts = JSON.parse(loadFile('counts.json')) as Record<string, number>;
    for (const key of [
      'solicitations',
      'awards',
      'bids',
      'noncompetitive',
      'suppliers',
      'council_items',
      'composite_awards',
    ]) {
      expect(counts, `missing key ${key}`).toHaveProperty(key);
      expect(typeof counts[key]).toBe('number');
    }
  });
});
```

- [ ] **Step 7: Run the site suite to verify it fails**

Run (frontend repo): `TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts`
Expected: FAIL — `dist/index.html` DOES exist (Task 1's placeholder `index.astro` builds it), so the home-page tests fail on assertions, not ENOENT: `expected 0 to be 1` for `.stats-strip`, the footer and home-link assertions fail against the placeholder markup. Only the tests that open not-yet-built files error with `ENOENT: no such file or directory` — `dist/404.html` and `dist/counts.json`.

- [ ] **Step 8: Write the global stylesheet and `Base.astro`**

```css
/* src/styles/global.css */
@import "tailwindcss";

.spine div { display: flex; gap: 0.5rem; }
.spine dt { font-weight: 600; min-width: 11rem; }
table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
th, td { text-align: left; padding: 0.35rem 0.6rem; border-bottom: 1px solid #ddd; vertical-align: top; }
.amount-raw { font-family: monospace; }
.amount-numeric { margin-left: 0.5rem; color: #555; }
.amount-unparsed { font-style: italic; }
.provenance-badge, .sources-badge { display: inline-block; font-size: 0.8rem; background: #eef; border: 1px solid #99c; border-radius: 4px; padding: 0 0.4rem; }
.untitled-marker, .stats-caveat, .doc-note, .bids-note, .dedupe-note, .initial-term-caveat, .keyspace-note { font-size: 0.9rem; color: #664; background: #fdf6e3; padding: 0.4rem 0.6rem; border-left: 3px solid #cb0; margin: 0.5rem 0; }
.bid-winner td:first-child { font-weight: 700; }
.documents-list li { margin-bottom: 0.4rem; }
.doc-path { font-family: monospace; font-size: 0.85rem; color: #555; margin-left: 0.5rem; }
.stats-strip { display: flex; flex-wrap: wrap; gap: 1.5rem; margin: 1rem 0; }
.stats-strip dt { font-size: 0.85rem; color: #555; }
.stats-strip dd { font-size: 1.4rem; font-weight: 700; margin: 0; }
```

```astro
---
// src/layouts/Base.astro
import { href } from '../lib/url';
import { getPrepared } from '../prepare/prepare';
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
  pagefind?: boolean;
  filters?: Record<string, string>;
}
const { title, description, pagefind = false, filters = {} } = Astro.props;
const p = await getPrepared();
const fullTitle = title === 'Toronto Bids Archive' ? title : `${title} — Toronto Bids Archive`;
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    {description && <meta name="description" content={description} />}
  </head>
  <body class="max-w-4xl mx-auto px-4">
    <header class="py-3 border-b mb-4">
      <a href={href('/')} class="font-bold">Toronto Bids Archive</a>
      <nav class="inline-block ml-4 text-sm">
        <a href={href('/search/')}>Search</a>
        · <a href={href('/solicitations/')}>Solicitations</a>
        · <a href={href('/noncompetitive/')}>Non-competitive</a>
        · <a href={href('/calls/')}>Calls 2009–2012</a>
        · <a href={href('/council/')}>Council</a>
        · <a href={href('/suppliers/')}>Suppliers</a>
        · <a href={href('/buyers/')}>Buyers</a>
        · <a href={href('/data/')}>Data</a>
        · <a href={href('/about/')}>About</a>
      </nav>
    </header>
    <main data-pagefind-body={pagefind ? '' : undefined}>
      <h1 class="text-2xl font-bold mb-2" data-pagefind-meta={pagefind ? 'title' : undefined}>{title}</h1>
      {pagefind &&
        Object.entries(filters).map(([key, value]) => (
          <span hidden data-pagefind-filter={key}>{value}</span>
        ))}
      <slot />
    </main>
    <footer class="mt-8 py-3 border-t text-sm text-gray-600">
      Data as of {p.generatedAt} · <a href={href('/data/')}>Data &amp; downloads</a>
    </footer>
  </body>
</html>
```

- [ ] **Step 9: Write the five shared components**

```astro
---
// src/components/AmountCell.astro — raw TEXT verbatim + machine-parsed numeric side by side.
import { formatCAD } from '../prepare/amounts';

interface Props { raw: string | null; numeric: number | null }
const { raw, numeric } = Astro.props;
---
<span class="amount-cell">
  <span class="amount-raw">{raw ?? '—'}</span>
  {numeric !== null ? (
    <span class="amount-numeric">{formatCAD(numeric)}</span>
  ) : (
    <span class="amount-numeric amount-unparsed">not machine-parseable</span>
  )}
</span>
```

```astro
---
// src/components/ProvenanceBadge.astro — shown when a title was recovered (title_source non-null).
import { TITLE_SOURCE_LABELS } from '../prepare/titles';

interface Props { titleSource: string | null }
const { titleSource } = Astro.props;
const label = titleSource ? (TITLE_SOURCE_LABELS[titleSource] ?? titleSource) : null;
---
{label && (
  <span
    class="provenance-badge"
    title="The City published no title on this record; this title was recovered from another source."
  >Title recovered from: {label}</span>
)}
```

```astro
---
// src/components/DocumentsList.astro — documents index. City-hosted PDFs link out;
// ariba_attachment entries NEVER get an anchor (indexed, not downloadable).
import type { DocumentEntry } from '../prepare/types';

interface Props { documents: DocumentEntry[] }
const { documents } = Astro.props;
const sizeLabel = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`);
---
{documents.length === 0 ? (
  <p>No documents indexed for this record.</p>
) : (
  <ul class="documents-list">
    {documents.map((d) => (
      <li class={`doc doc-${d.source}`}>
        {d.url && d.source !== 'ariba_attachment' ? (
          <a href={d.url}>{d.name}</a>
        ) : (
          <span class="doc-name">{d.name}</span>
        )}
        <span class="doc-path">{d.path}</span>
        {d.type && <span class="doc-type">{d.type}</span>}
        {d.size_bytes !== null && <span class="doc-size">{sizeLabel(d.size_bytes)}</span>}
        {d.source === 'ariba_attachment' && (
          <span class="doc-note">indexed, not downloadable — the file bytes are archived but not served here</span>
        )}
      </li>
    ))}
  </ul>
)}
```

```astro
---
// src/components/BidsTable.astro — bids with hst_basis ALWAYS displayed. The Result
// column exists ONLY when the caller passes a non-empty winners list (i.e. an award
// record exists); with no winners prop (or an empty one) the table makes NO
// winner/loser claim at all. Bidder names link to supplier profiles when
// supplierSlugById is provided and resolves the bid's supplier_id.
import type { BidRow } from '../prepare/types';
import AmountCell from './AmountCell.astro';
import { href } from '../lib/url';

interface Props {
  bids: BidRow[];
  winners?: string[];
  supplierSlugById?: Map<number, string>;
}
const { bids, winners, supplierSlugById } = Astro.props;
const winnerSet = new Set((winners ?? []).map((w) => w.trim().toLowerCase()));
const showResult = winners !== undefined && winners.length > 0;
const isWinner = (b: BidRow) => winnerSet.has(b.bidder_name_raw.trim().toLowerCase());
const slugFor = (b: BidRow) =>
  supplierSlugById !== undefined && b.supplier_id != null
    ? supplierSlugById.get(b.supplier_id)
    : undefined;
const basisLabel = (b: BidRow['hst_basis']) =>
  b === 'including' ? 'incl. HST' : b === 'excluding' ? 'excl. HST' : 'basis unknown';
---
<table class="bids-table">
  <thead>
    <tr>
      <th>Bidder</th>
      <th>Bid price (raw / parsed)</th>
      <th>HST basis</th>
      {showResult && <th>Result</th>}
    </tr>
  </thead>
  <tbody>
    {bids.map((b) => (
      <tr class={showResult ? (isWinner(b) ? 'bid-winner' : 'bid-loser') : undefined}>
        <td>
          {slugFor(b) !== undefined ? (
            <a href={href(`/suppliers/${slugFor(b)}/`)}>{b.bidder_name_raw}</a>
          ) : (
            b.bidder_name_raw
          )}
        </td>
        <td><AmountCell raw={b.bid_price} numeric={b.bid_price_numeric} /></td>
        <td>{basisLabel(b.hst_basis)}</td>
        {showResult && <td>{isWinner(b) ? 'Winner' : ''}</td>}
      </tr>
    ))}
  </tbody>
</table>
<p class="bids-note">Bid prices are shown with their HST basis and are never compared across bases.</p>
```

```astro
---
// src/components/StatsStrip.astro — labeled headline stats (City-only, numeric-tier sums).
import type { Headline } from '../prepare/types';
import { formatCAD } from '../prepare/amounts';

interface Props { headline: Headline }
const { headline } = Astro.props;
---
<dl class="stats-strip">
  <div><dt>Solicitations</dt><dd>{headline.solicitations.toLocaleString('en-CA')}</dd></div>
  <div><dt>Awarded (machine-parseable)</dt><dd>{formatCAD(headline.awardedTotal.total)}</dd></div>
  <div><dt>Non-competitive (machine-parseable)</dt><dd>{formatCAD(headline.noncompetitiveTotal.total)}</dd></div>
  <div><dt>Open solicitations</dt><dd>{headline.openCount.toLocaleString('en-CA')}</dd></div>
  <div><dt>Bids on record</dt><dd>{headline.bidCount.toLocaleString('en-CA')}</dd></div>
  <div><dt>Suppliers</dt><dd>{headline.supplierCount.toLocaleString('en-CA')}</dd></div>
</dl>
<p class="stats-caveat">
  City records only — agency (buyer) data is listed separately per buyer. Dollar totals sum
  machine-parseable amounts only and therefore undercount the true totals; a few
  City-published amounts are implausibly large and are summed as published.
</p>
```

- [ ] **Step 10: Write the home, about, and 404 pages plus the `counts.json` endpoint**

```astro
---
// src/pages/index.astro
import Base from '../layouts/Base.astro';
import StatsStrip from '../components/StatsStrip.astro';
import { getPrepared } from '../prepare/prepare';
import { href } from '../lib/url';

const p = await getPrepared();
---
<Base
  title="Toronto Bids Archive"
  description="A citable public archive of City of Toronto procurement: solicitations, awards, bids, non-competitive contracts, council decisions, and suppliers."
>
  <p class="lede">
    A research archive of City of Toronto procurement — solicitations, awards, bids
    (including losing bidders), non-competitive contracts, council decisions, and
    suppliers — with stable citable URLs and honest presentation of the data's limits.
    Documents are indexed thoroughly; where the City hosts a file publicly, we link out to it.
  </p>
  <form action={href('/search/')} method="get" role="search" class="my-4">
    <input
      type="search"
      name="q"
      placeholder="Search titles, suppliers, document numbers, filenames…"
      class="border px-2 py-1 w-96 max-w-full"
    />
    <button type="submit" class="border px-3 py-1">Search</button>
  </form>
  <StatsStrip headline={p.headline} />
  <nav class="my-4">
    <ul>
      <li><a href={href('/solicitations/')}>Browse solicitations</a></li>
      <li><a href={href('/noncompetitive/')}>Non-competitive contracts</a></li>
      <li><a href={href('/calls/')}>Composite award calls (2009–2012)</a></li>
      <li><a href={href('/council/')}>Council items</a></li>
      <li><a href={href('/suppliers/')}>Suppliers</a></li>
      <li><a href={href('/buyers/')}>Buyers (agencies &amp; corporations)</a></li>
      <li><a href={href('/capital-projects/')}>Upcoming capital projects</a></li>
      <li><a href={href('/suspended-firms/')}>Suspended firms</a></li>
      <li><a href={href('/data/')}>Downloads &amp; in-browser SQL</a></li>
    </ul>
  </nav>
</Base>
```

```astro
---
// src/pages/about.astro
import Base from '../layouts/Base.astro';
import { href } from '../lib/url';
---
<Base title="About & methodology">
  <section>
    <h2>What this is</h2>
    <p>
      The Toronto Bids Archive surfaces everything the archive knows is genuinely public
      about City of Toronto procurement, for journalists and data scientists. Data is
      collected nightly from City sources by the
      <a href="https://github.com/CivicTechTO/toronto-bids">CivicTechTO toronto-bids</a>
      backend and republished here as static, citable pages.
    </p>
  </section>
  <section>
    <h2>Coverage and known gaps</h2>
    <ul>
      <li>2009–2012 exists only as composite award lines grouped per call — for 2009–2011 those lines ARE the award record.</li>
      <li>Exhibition Place's published record stops dead at 2019-08-27.</li>
      <li>Toronto Hydro — the City's largest procuring body — publishes no procurement record at all.</li>
      <li>The Bid Award Panel corpus ended 2025-10-01; Award Summary Forms (awards over $500K only) took over, so the bid record thins for small awards after that date.</li>
      <li>46.5% of solicitations were published by the City with no title; we construct a heading from record fields and mark it explicitly. Recovered titles carry a provenance badge.</li>
    </ul>
  </section>
  <section>
    <h2>How to read amounts</h2>
    <p>
      Every amount has up to three tiers: the raw text exactly as the City published it
      (which can be things like "31.65/MT" or "Non-Compliant"), a machine-parsed numeric
      value, and a human-labelled value. Only the numeric tier is ever aggregated, so all
      totals on this site are machine-parseable undercounts. Award rows arrive from two
      City feeds and are deduplicated before display. Bid prices always show their HST
      basis and are never compared across bases.
    </p>
  </section>
  <section>
    <h2>Identifiers</h2>
    <p>
      Five identifier keyspaces never join: 10-digit document numbers (competitive
      solicitations), workspace numbers (non-competitive), call numbers (2009–2012
      composite awards), council references (YYYY.CCNN.N), and per-agency references.
      Cross-keyspace totals are never presented as one number. See
      <a href={href('/data/')}>the data page</a> for the full schema and gotchas.
    </p>
  </section>
</Base>
```

```astro
---
// src/pages/404.astro
import Base from '../layouts/Base.astro';
import { href } from '../lib/url';
---
<Base title="Page not found">
  <p>That page does not exist. Try searching — every identifier is searchable verbatim.</p>
  <form action={href('/search/')} method="get" role="search" class="my-4">
    <input type="search" name="q" placeholder="Paste any identifier or search term…" class="border px-2 py-1 w-96 max-w-full" />
    <button type="submit" class="border px-3 py-1">Search</button>
  </form>
  <section>
    <h2>Which kind of identifier do you have?</h2>
    <ul>
      <li>A 10-digit <strong>document number</strong> (e.g. 3524228095) → <a href={href('/solicitations/')}>solicitations</a></li>
      <li>A <strong>workspace number</strong> → <a href={href('/noncompetitive/')}>non-competitive contracts</a></li>
      <li>A <strong>call number</strong> (2009–2012) → <a href={href('/calls/')}>composite award calls</a></li>
      <li>A <strong>council reference</strong> like 2019.GL6.24 → <a href={href('/council/')}>council items</a></li>
      <li>A <strong>supplier name</strong> → <a href={href('/suppliers/')}>suppliers</a></li>
    </ul>
    <p>These five keyspaces are separate on purpose — they never join.</p>
  </section>
</Base>
```

```ts
// src/pages/counts.json.ts — entity counts of THIS deploy; the next deploy's
// shrink-guard fetches this from the live site.
import { getPrepared } from '../prepare/prepare';

export async function GET(): Promise<Response> {
  const p = await getPrepared();
  return new Response(JSON.stringify(p.counts), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 11: Run the site suite to verify it passes**

Run (frontend repo): `TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts`
Expected: build succeeds, then PASS — all tests in `tests/site/base.test.ts` pass (home stats, home links to /calls/, /capital-projects/, /suspended-firms/, /buyers/, footers, 404 keyspaces, counts.json keys).

- [ ] **Step 12: Run the unit suite to confirm nothing regressed**

Run (frontend repo): `npx vitest run`
Expected: PASS — all unit tests including `tests/prepare/url.test.ts`; `tests/site/**` is excluded by `vitest.config.ts`.

- [ ] **Step 13: Commit**

```bash
git add vitest.site.config.ts src/styles/global.css src/layouts/Base.astro src/components src/pages/index.astro src/pages/about.astro src/pages/404.astro src/pages/counts.json.ts tests/site && git commit -m "feat: base layout, shared components, core pages, counts.json, site-test harness"
```

### Task 14: Solicitation record pages (`/solicitations/{doc}/`)

All commands in this task run in the frontend repo: `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`.

**Files:**
- Create: `src/pages/solicitations/[doc].astro`
- Test: `tests/site/solicitation.test.ts`

**Interfaces:**
- Consumes: `getPrepared()` (Task 10) — uses `p.doc.solicitations`, `p.dedupedAwardsByDoc`, `p.bridge.docToRefs`, `p.councilByRef`, `p.supplierSlugById`; `displayTitle`, `normalizeCategory` (Task 6); `dedupeAwards` (Task 5, in tests); `sumAwardNumeric`, `formatCAD` (Task 4); `href` and components `Base`, `AmountCell`, `ProvenanceBadge`, `DocumentsList`, `BidsTable` (Task 13 — final contract `{ bids: BidRow[]; winners?: string[]; supplierSlugById?: Map<number, string> }`; this page passes `winners` only when named deduped award winners exist, so the Result column and winner claims appear only with an award record); fixture (Task 3, requires backend issues #144+#145 landed so the fixture carries solicitation-nested `bids`).
- Produces: the `/solicitations/{document_number}/` pages that Tasks 16–17 and 19–20 link to; pagefind filters `type: 'Solicitation'`, `status`, `year`, `buyer: 'City of Toronto'`.

- [ ] **Step 1: Write the failing site tests**

```ts
// tests/site/solicitation.test.ts
import { describe, expect, it } from 'vitest';
import { loadFixture, loadPage } from './helpers';
import { dedupeAwards } from '../../src/prepare/awards';
import { formatCAD } from '../../src/prepare/amounts';
import { TITLE_SOURCE_LABELS } from '../../src/prepare/titles';

const fixture = loadFixture();

describe('untitled solicitation', () => {
  const sol = fixture.solicitations.find((s) => s.title === null)!;
  it('is present in the fixture', () => {
    expect(sol).toBeDefined();
  });
  it('constructs a "Doc <n>" heading and shows the no-title-published marker', () => {
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect($('h1').text()).toContain(`Doc ${sol.document_number}`);
    expect($('.untitled-marker').text().toLowerCase()).toContain('no title published');
  });
});

describe('recovered-title provenance badge', () => {
  const sol = fixture.solicitations.find((s) => s.title !== null && s.title_source !== null)!;
  it('shows the title_source label', () => {
    const $ = loadPage(`solicitations/${sol.document_number}`);
    const expected = TITLE_SOURCE_LABELS[sol.title_source!] ?? sol.title_source!;
    expect($('.provenance-badge').text()).toContain(expected);
  });
});

describe('deduped awards with raw AND numeric amounts', () => {
  const sol = fixture.solicitations.find(
    (s) => s.awards.some((a) => a.source === 'odata') && s.awards.some((a) => a.source === 'ckan_awarded'),
  )!;
  const deduped = dedupeAwards(sol.awards);
  it('renders exactly one row per deduped award line (not one per source row)', () => {
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect(deduped.length).toBeLessThan(sol.awards.length);
    expect($('.awards-table tbody tr').length).toBe(deduped.length);
  });
  it('shows raw verbatim and formatted numeric side by side', () => {
    const $ = loadPage(`solicitations/${sol.document_number}`);
    const withNumeric = deduped.find((a) => a.award_amount_numeric !== null);
    if (withNumeric) {
      expect($('.awards-table').text()).toContain(withNumeric.award_amount ?? '');
      expect($('.awards-table').text()).toContain(formatCAD(withNumeric.award_amount_numeric!));
    }
    expect($('.awards-table .amount-raw').length).toBe(deduped.length);
  });
  it('shows a sources badge listing both feeds, odata first', () => {
    const $ = loadPage(`solicitations/${sol.document_number}`);
    const badges = $('.sources-badge')
      .map((_, el) => $(el).text())
      .get();
    expect(badges).toContain('odata + ckan_awarded');
  });
});

describe('bids table', () => {
  it('renders council-bridged bids with an HST basis column', () => {
    const council = fixture.council_items.find((c) =>
      c.bids.some(
        (b) =>
          b.document_number !== null &&
          fixture.solicitations.some((s) => s.document_number === b.document_number),
      ),
    )!;
    const bid = council.bids.find(
      (b) =>
        b.document_number !== null &&
        fixture.solicitations.some((s) => s.document_number === b.document_number),
    )!;
    const $ = loadPage(`solicitations/${bid.document_number}`);
    expect($('.bids-table thead').text()).toContain('HST basis');
    expect($('.bids-table tbody').text()).toContain(bid.bidder_name_raw);
  });
  it('renders solicitation-nested (award_summary) bids', () => {
    const sol = fixture.solicitations.find((s) => s.bids.length > 0)!;
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect($('.bids-table tbody').text()).toContain(sol.bids[0].bidder_name_raw);
  });
  it('renders a Result column only when the record has named award winners', () => {
    // Fixture-safe: each branch runs only if the fixture has a matching record.
    const withWinners = fixture.solicitations.find(
      (s) => s.bids.length > 0 && dedupeAwards(s.awards).some((a) => a.supplier_name_raw !== null),
    );
    if (withWinners) {
      const $ = loadPage(`solicitations/${withWinners.document_number}`);
      expect($('.bids-table thead').text()).toContain('Result');
    }
    const withoutAwards = fixture.solicitations.find((s) => s.bids.length > 0 && s.awards.length === 0);
    if (withoutAwards) {
      const $ = loadPage(`solicitations/${withoutAwards.document_number}`);
      expect($('.bids-table thead').text()).not.toContain('Result');
      expect($('.bids-table').text()).not.toContain('Winner');
    }
    expect(withWinners ?? withoutAwards, 'fixture has no solicitation with bids').toBeDefined();
  });
});

describe('documents list', () => {
  const solWithAriba = fixture.solicitations.find((s) =>
    s.documents.some((d) => d.source === 'ariba_attachment'),
  )!;
  const solWithUrl = fixture.solicitations.find((s) =>
    s.documents.some((d) => d.source === 'award_summary' || d.source === 'staff_report'),
  )!;
  it('renders ariba_attachment entries with NO anchor and an indexed-not-downloadable note', () => {
    const $ = loadPage(`solicitations/${solWithAriba.document_number}`);
    expect($('.doc-ariba_attachment').length).toBeGreaterThan(0);
    $('.doc-ariba_attachment').each((_, el) => {
      expect($(el).find('a').length).toBe(0);
      expect($(el).text()).toContain('indexed, not downloadable');
    });
  });
  it('links staff_report / award_summary entries to their City URL', () => {
    const doc = solWithUrl.documents.find(
      (d) => d.source === 'award_summary' || d.source === 'staff_report',
    )!;
    const $ = loadPage(`solicitations/${solWithUrl.document_number}`);
    expect($(`.doc-${doc.source} a[href="${doc.url}"]`).length).toBeGreaterThan(0);
  });
  it('renders nested zip-in-zip paths verbatim', () => {
    const nested = fixture.solicitations
      .flatMap((s) => s.documents.map((d) => ({ s, d })))
      .find(({ d }) => d.source === 'ariba_attachment' && d.path.includes('/'))!;
    const $ = loadPage(`solicitations/${nested.s.document_number}`);
    const paths = $('.doc-path').map((_, el) => $(el).text()).get();
    expect(paths).toContain(nested.d.path);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (frontend repo): `TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts`
Expected: FAIL — `tests/site/solicitation.test.ts` errors with `ENOENT: no such file or directory, open 'dist/solicitations/<doc>/index.html'`; `tests/site/base.test.ts` still passes.

- [ ] **Step 3: Write the page**

```astro
---
// src/pages/solicitations/[doc].astro
import Base from '../../layouts/Base.astro';
import AmountCell from '../../components/AmountCell.astro';
import BidsTable from '../../components/BidsTable.astro';
import DocumentsList from '../../components/DocumentsList.astro';
import ProvenanceBadge from '../../components/ProvenanceBadge.astro';
import { formatCAD, sumAwardNumeric } from '../../prepare/amounts';
import { getPrepared } from '../../prepare/prepare';
import { displayTitle, normalizeCategory } from '../../prepare/titles';
import type { Solicitation } from '../../prepare/types';
import { href } from '../../lib/url';

export async function getStaticPaths() {
  const p = await getPrepared();
  return p.doc.solicitations.map((sol) => ({
    params: { doc: sol.document_number },
    props: { sol },
  }));
}

interface Props { sol: Solicitation }
const { sol } = Astro.props;
const p = await getPrepared();

const title = displayTitle(sol);
const awards = p.dedupedAwardsByDoc.get(sol.document_number) ?? [];
const refs = p.bridge.docToRefs.get(sol.document_number) ?? [];
const bridgedBids = refs.flatMap((ref) =>
  (p.councilByRef.get(ref)?.bids ?? []).filter((b) => b.document_number === sol.document_number),
);
// Direct bids are reference-null award_summary rows (backend issue #145); bridged bids
// carry a council reference — the two sets are disjoint by construction.
const allBids = [...sol.bids, ...bridgedBids];
const awardNames = awards.map((a) => a.supplier_name_raw).filter((n): n is string => n !== null);
// BidsTable renders its Result column only when winners is a non-empty array —
// pass undefined when there is no named award record so no winner claim is made.
const winners = awardNames.length > 0 ? awardNames : undefined;
const awardTotal = sumAwardNumeric(
  awards.map((a) => ({ numeric: a.award_amount_numeric, verdict: a.award_amount_verdict })),
);
const year = sol.issue_date.slice(0, 4);
const category = normalizeCategory(sol.category);
---
<Base
  title={title.text}
  description={sol.description ?? undefined}
  pagefind={true}
  filters={{ type: 'Solicitation', status: sol.status, year, buyer: 'City of Toronto' }}
>
  {title.untitled && (
    <p class="untitled-marker">
      No title published — the City released this record without a title; the heading above
      is constructed from its document number, type, and division.
    </p>
  )}
  <ProvenanceBadge titleSource={sol.title_source} />

  <dl class="spine">
    <div><dt>Document number</dt><dd>{sol.document_number}</dd></div>
    <div><dt>Status</dt><dd>{sol.status}</dd></div>
    {sol.rfx_type && <div><dt>Type</dt><dd>{sol.rfx_type}</dd></div>}
    <div><dt>Issued</dt><dd>{sol.issue_date}</dd></div>
    {sol.submission_deadline && <div><dt>Submission deadline</dt><dd>{sol.submission_deadline}</dd></div>}
    {category && (
      <div>
        <dt>Category</dt>
        <dd>
          {category}
          {category !== sol.category && <span class="raw-note"> (published as “{sol.category}”)</span>}
        </dd>
      </div>
    )}
    {sol.division && <div><dt>Division</dt><dd>{sol.division}</dd></div>}
    {sol.buyer_name && <div><dt>Buyer</dt><dd>{sol.buyer_name}</dd></div>}
    {sol.wards && <div><dt>Wards</dt><dd>{sol.wards}</dd></div>}
  </dl>

  {sol.description && (
    <section>
      <h2>Description</h2>
      <p>{sol.description}</p>
    </section>
  )}

  <section>
    <h2>Awards</h2>
    {awards.length === 0 ? (
      <p>No awards on record.</p>
    ) : (
      <>
        <table class="awards-table">
          <thead>
            <tr><th>Supplier</th><th>Amount (raw / parsed)</th><th>Award date</th><th>Sources</th></tr>
          </thead>
          <tbody>
            {awards.map((a) => (
              <tr>
                <td>
                  {a.supplier_name_raw ?? '—'}
                  {a.supplier_id !== null && p.supplierSlugById.has(a.supplier_id) && (
                    <a href={href(`/suppliers/${p.supplierSlugById.get(a.supplier_id)}/`)}> (profile)</a>
                  )}
                </td>
                <td><AmountCell raw={a.award_amount} numeric={a.award_amount_numeric} /></td>
                <td>{a.award_date ?? '—'}</td>
                <td><span class="sources-badge">{a.sources.join(' + ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Machine-parseable award total: {formatCAD(awardTotal.total)}
          ({awardTotal.counted} of {awards.length} lines parseable — an undercount).
        </p>
        <p class="dedupe-note">
          Award lines are deduplicated across the City's two feeds (odata and CKAN); the
          Sources column shows which feeds carried each line. One row is one award line —
          repeated suppliers can be legitimate standing-offer call-ups.
        </p>
      </>
    )}
  </section>

  <section>
    <h2>Bids</h2>
    {allBids.length === 0 ? (
      <p>No bids on record for this solicitation.</p>
    ) : (
      <BidsTable bids={allBids} winners={winners} supplierSlugById={p.supplierSlugById} />
    )}
  </section>

  <section>
    <h2>Documents</h2>
    <DocumentsList documents={sol.documents} />
  </section>

  {sol.ariba_postings.length > 0 && (
    <section>
      <h2>Ariba postings</h2>
      <ul>
        {sol.ariba_postings.map((ap) => (
          <li>
            {ap.rfx_id}
            {ap.title && ` — ${ap.title}`}
            {ap.status && ` (${ap.status})`}
            {ap.posted_date && ` posted ${ap.posted_date}`}
            {ap.close_date && `, closes ${ap.close_date}`}
            {ap.public_posting_url && <a href={ap.public_posting_url}> posting</a>}
          </li>
        ))}
      </ul>
    </section>
  )}

  {refs.length > 0 && (
    <section>
      <h2>Related council decisions</h2>
      <ul>
        {refs.map((ref) => (
          <li><a href={href(`/council/${ref}/`)}>{ref}</a></li>
        ))}
      </ul>
    </section>
  )}
</Base>
```

- [ ] **Step 4: Run to verify it passes**

Run (frontend repo): `TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts`
Expected: build succeeds (one page per fixture solicitation under `dist/solicitations/`), then PASS — all tests in `tests/site/solicitation.test.ts` and `tests/site/base.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/solicitations/[doc].astro tests/site/solicitation.test.ts && git commit -m "feat: solicitation record pages with awards, bids, documents, provenance"
```

### Task 15: Non-competitive record pages + composite call pages (`/noncompetitive/{ws}/`, `/calls/`, `/calls/{call}/`)

All commands in this task run in the frontend repo: `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`.

**Files:**
- Create: `src/pages/noncompetitive/[ws].astro`
- Create: `src/pages/calls/index.astro`
- Create: `src/pages/calls/[call].astro`
- Test: `tests/site/noncompetitive.test.ts`
- Test: `tests/site/calls.test.ts`

**Interfaces:**
- Consumes: `getPrepared()` (Task 10) — uses `p.doc.noncompetitive`, `p.wsSlugByNumber` (`Map<string, string>`, workspace_number → URL-safe slug, built in `prepare()` with a loud collision check), `p.compositeCalls` (`CompositeCall { call_number, reference, title, lines, total }`), `p.supplierSlugById`; `wsSlug` (Task 7 `src/prepare/slugs.ts`, used in the site tests to compute expected paths); `formatCAD` (Task 4); `href`, `Base`, `AmountCell` (Task 13); fixture (Task 3: one noncompetitive record, one composite call with ≥2 winners). Note `/noncompetitive/` (browse index) is Task 19, not this task.
- Produces: `/noncompetitive/{ws-slug}/` pages routed by `p.wsSlugByNumber.get(workspace_number)` (77 real workspace_number values contain spaces/parens/commas/slashes — the raw value is never used in a URL; the page displays the raw `workspace_number` verbatim), plus `/calls/` and `/calls/{call_number}/` pages, all linked by Tasks 16–17 and 19–20 (which must also build noncompetitive links from the slug); pagefind filters `type: 'Non-competitive contract'` and `type: 'Composite award'`, each with `buyer: 'City of Toronto'`.

- [ ] **Step 1: Write the failing site tests for non-competitive pages**

```ts
// tests/site/noncompetitive.test.ts
import { describe, expect, it } from 'vitest';
import { loadFixture, loadPage } from './helpers';
import { formatCAD } from '../../src/prepare/amounts';
import { wsSlug } from '../../src/prepare/slugs';

const fixture = loadFixture();

describe('non-competitive record page', () => {
  const nc = fixture.noncompetitive.find((n) => n.reason !== null) ?? fixture.noncompetitive[0];
  // Pages are routed by the URL-safe slug, never the raw workspace_number (which can
  // contain spaces, parens, commas, ampersands, slashes in real data). Computing the
  // path through wsSlug keeps this fixture-safe whether or not the fixture's value is clean.
  const ncPath = `noncompetitive/${wsSlug(nc.workspace_number)}`;
  it('has a fixture record', () => {
    expect(nc).toBeDefined();
  });
  it('is routed at the wsSlug path and displays the raw workspace number verbatim', () => {
    const $ = loadPage(ncPath);
    expect($('body').text()).toContain(nc.workspace_number);
  });
  it('shows the stated reason', () => {
    const $ = loadPage(ncPath);
    if (nc.reason !== null) {
      expect($('.nc-reason').text()).toContain(nc.reason);
    } else {
      expect($('.nc-reason').text()).toContain('No reason recorded');
    }
  });
  it('shows the amount tiers: raw verbatim and parsed numeric side by side', () => {
    const $ = loadPage(ncPath);
    if (nc.contract_amount !== null) {
      expect($('.amount-raw').text()).toContain(nc.contract_amount);
    }
    if (nc.contract_amount_numeric !== null) {
      expect($('.amount-numeric').text()).toContain(formatCAD(nc.contract_amount_numeric));
    } else {
      expect($('.amount-unparsed').text()).toContain('not machine-parseable');
    }
  });
  it('notes that workspace numbers never join to document numbers', () => {
    const $ = loadPage(ncPath);
    expect($('.keyspace-note').text()).toContain('never join');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (frontend repo): `TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts`
Expected: FAIL — `tests/site/noncompetitive.test.ts` errors with `ENOENT: no such file or directory, open 'dist/noncompetitive/<ws-slug>/index.html'`; earlier site tests still pass.

- [ ] **Step 3: Write the non-competitive record page**

```astro
---
// src/pages/noncompetitive/[ws].astro
import Base from '../../layouts/Base.astro';
import AmountCell from '../../components/AmountCell.astro';
import { getPrepared } from '../../prepare/prepare';
import type { NonCompetitive } from '../../prepare/types';
import { href } from '../../lib/url';

export async function getStaticPaths() {
  const p = await getPrepared();
  // Route by the URL-safe slug (p.wsSlugByNumber, Task 10) — raw workspace_number
  // values can contain spaces, parens, commas, ampersands, and slashes, which are not
  // routable as a single [ws] segment. The raw value is displayed verbatim below.
  return p.doc.noncompetitive.map((nc) => ({
    params: { ws: p.wsSlugByNumber.get(nc.workspace_number)! },
    props: { nc },
  }));
}

interface Props { nc: NonCompetitive }
const { nc } = Astro.props;
const p = await getPrepared();

const year = nc.contract_date ? nc.contract_date.slice(0, 4) : null;
const slug = nc.supplier_id !== null ? p.supplierSlugById.get(nc.supplier_id) : undefined;
const title = `Non-competitive ${nc.workspace_number}${nc.supplier_name_raw ? ` — ${nc.supplier_name_raw}` : ''}`;
const filters: Record<string, string> = { type: 'Non-competitive contract', buyer: 'City of Toronto' };
if (year) filters.year = year;
---
<Base title={title} pagefind={true} filters={filters}>
  <dl class="spine">
    <div><dt>Workspace number</dt><dd>{nc.workspace_number}</dd></div>
    <div>
      <dt>Supplier</dt>
      <dd>
        {nc.supplier_name_raw ?? '—'}
        {slug && <a href={href(`/suppliers/${slug}/`)}> (profile)</a>}
      </dd>
    </div>
    <div>
      <dt>Contract amount (raw / parsed)</dt>
      <dd><AmountCell raw={nc.contract_amount} numeric={nc.contract_amount_numeric} /></dd>
    </div>
    {nc.contract_date && <div><dt>Contract date</dt><dd>{nc.contract_date}</dd></div>}
    {nc.division && <div><dt>Division</dt><dd>{nc.division}</dd></div>}
  </dl>

  <section>
    <h2>Stated reason</h2>
    {nc.reason ? (
      <p class="nc-reason">{nc.reason}</p>
    ) : (
      <p class="nc-reason nc-reason-missing">No reason recorded in the City's published data.</p>
    )}
  </section>

  {nc.council_authority_link && (
    <section>
      <h2>Council authority</h2>
      <p><a href={nc.council_authority_link}>{nc.council_authority_link}</a></p>
    </section>
  )}

  <p class="keyspace-note">
    Workspace numbers identify non-competitive contracts only; they never join to
    competitive document numbers or any other identifier keyspace.
  </p>
</Base>
```

- [ ] **Step 4: Run to verify the non-competitive tests pass**

Run (frontend repo): `TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts`
Expected: build succeeds, then PASS — all tests in `tests/site/noncompetitive.test.ts` pass alongside the earlier site tests.

- [ ] **Step 5: Commit**

```bash
git add src/pages/noncompetitive/[ws].astro tests/site/noncompetitive.test.ts && git commit -m "feat: non-competitive record pages with stated reason and amount tiers"
```

- [ ] **Step 6: Write the failing site tests for composite call pages**

```ts
// tests/site/calls.test.ts
import { describe, expect, it } from 'vitest';
import { loadFixture, loadPage } from './helpers';

const fixture = loadFixture();

// Group fixture composite award lines by call_number, mirroring p.compositeCalls.
const byCall = new Map<string, typeof fixture.composite_awards>();
for (const line of fixture.composite_awards) {
  const list = byCall.get(line.call_number) ?? [];
  list.push(line);
  byCall.set(line.call_number, list);
}
const multiWinner = [...byCall.entries()].find(([, lines]) => lines.length >= 2)!;

describe('/calls/ index', () => {
  it('lists every fixture call with a link to its page', () => {
    const $ = loadPage('calls');
    for (const call of byCall.keys()) {
      expect($(`a[href="/calls/${call}/"]`).length, `missing link for call ${call}`).toBe(1);
      expect($('body').text()).toContain(call);
    }
  });
});

describe('/calls/{call}/ record page', () => {
  const [call, lines] = multiWinner;
  it('the fixture has a call with at least two winners', () => {
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
  it('shows every winner line', () => {
    const $ = loadPage(`calls/${call}`);
    expect($('.composite-lines tbody tr').length).toBe(lines.length);
    for (const line of lines) {
      if (line.supplier_name_raw !== null) {
        expect($('.composite-lines').text()).toContain(line.supplier_name_raw);
      }
    }
  });
  it('shows the initial-term-only caveat', () => {
    const $ = loadPage(`calls/${call}`);
    expect($('.initial-term-caveat').text()).toContain('initial contract term only');
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run (frontend repo): `TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts`
Expected: FAIL — `tests/site/calls.test.ts` errors with `ENOENT: no such file or directory, open 'dist/calls/index.html'`; all earlier site tests still pass.

- [ ] **Step 8: Write the calls index and call record pages**

```astro
---
// src/pages/calls/index.astro
import Base from '../../layouts/Base.astro';
import { formatCAD } from '../../prepare/amounts';
import { getPrepared } from '../../prepare/prepare';
import { href } from '../../lib/url';

const p = await getPrepared();
---
<Base title="Composite award calls (2009–2012)">
  <p class="lede">
    For 2009–2011 the City published no solicitation records; these composite award lines
    ARE the award record for those years. Values reflect the initial contract term only.
  </p>
  <table class="calls-index">
    <thead>
      <tr><th>Call</th><th>Title</th><th>Winner lines</th><th>Machine-parseable total</th></tr>
    </thead>
    <tbody>
      {p.compositeCalls.map((call) => (
        <tr>
          <td><a href={href(`/calls/${call.call_number}/`)}>{call.call_number}</a></td>
          <td>{call.title ?? '—'}</td>
          <td>{call.lines.length}</td>
          <td>{call.total.counted > 0 ? formatCAD(call.total.total) : '—'}</td>
        </tr>
      ))}
    </tbody>
  </table>
  <p class="stats-caveat">
    Totals sum machine-parseable amounts only and undercount the true totals. Call numbers
    are their own identifier keyspace — they never join to document or workspace numbers.
  </p>
</Base>
```

```astro
---
// src/pages/calls/[call].astro
import Base from '../../layouts/Base.astro';
import AmountCell from '../../components/AmountCell.astro';
import { formatCAD } from '../../prepare/amounts';
import { getPrepared } from '../../prepare/prepare';
import type { CompositeCall } from '../../prepare/types';
import { href } from '../../lib/url';

export async function getStaticPaths() {
  const p = await getPrepared();
  return p.compositeCalls.map((call) => ({
    params: { call: call.call_number },
    props: { call },
  }));
}

interface Props { call: CompositeCall }
const { call } = Astro.props;
const p = await getPrepared();
const title = `Call ${call.call_number}${call.title ? ` — ${call.title}` : ''}`;
---
<Base title={title} pagefind={true} filters={{ type: 'Composite award', buyer: 'City of Toronto' }}>
  {call.reference && (
    <p>Council reference: <a href={href(`/council/${call.reference}/`)}>{call.reference}</a></p>
  )}

  <section>
    <h2>Winners</h2>
    <table class="composite-lines">
      <thead>
        <tr><th>Supplier</th><th>Award value (raw / parsed)</th></tr>
      </thead>
      <tbody>
        {call.lines.map((line) => (
          <tr>
            <td>
              {line.supplier_name_raw ?? '—'}
              {line.supplier_id !== null && p.supplierSlugById.has(line.supplier_id) && (
                <a href={href(`/suppliers/${p.supplierSlugById.get(line.supplier_id)}/`)}> (profile)</a>
              )}
            </td>
            <td><AmountCell raw={line.award_value} numeric={line.award_value_numeric} /></td>
          </tr>
        ))}
      </tbody>
    </table>
    <p>
      Machine-parseable total: {formatCAD(call.total.total)}
      ({call.total.counted} of {call.lines.length} lines parseable — an undercount).
    </p>
  </section>

  <p class="initial-term-caveat">
    Award values in the 2009–2012 composite corpus reflect the initial contract term only —
    options and renewals are not included. For 2009–2011 this composite line is the only
    award record the City published; there is no underlying solicitation page to link to.
  </p>
</Base>
```

- [ ] **Step 9: Run to verify the calls tests pass**

Run (frontend repo): `TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts`
Expected: build succeeds (`dist/calls/index.html` plus one page per fixture call), then PASS — all site tests pass, including `tests/site/calls.test.ts`.

- [ ] **Step 10: Run the unit suite to confirm nothing regressed**

Run (frontend repo): `npx vitest run`
Expected: PASS — all unit tests still green.

- [ ] **Step 11: Commit**

```bash
git add src/pages/calls tests/site/calls.test.ts && git commit -m "feat: composite call index and record pages with initial-term caveat"
```

### Task 16: Council item pages (`/council/{ref}/`, `/council/`)

**Files:**
- Create: `src/pages/council/[ref].astro`
- Create: `src/pages/council/index.astro`
- Test: `tests/site/council.test.ts`

**Interfaces:**
- Consumes: `getPrepared(): Promise<Prepared>` (Task 10) — uses `p.doc.council_items`, `p.bridge.refToDoc`, `p.dedupedAwardsByDoc`, `p.solByDoc`, `p.supplierSlugById`; `href(path)` from `src/lib/url.ts` (Task 13); `Base.astro` props `{ title, description?, pagefind?, filters? }` (Task 13) — Base renders the page's ONLY `<h1>` from `title`; slot content on these pages adds no `<h1>` of its own; `BidsTable.astro` (Task 13) with props `{ bids: BidRow[]; winners?: string[]; supplierSlugById?: Map<number, string> }` — winner matching is by trimmed, lowercased bidder name inside the component; the Result column renders ONLY when `winners !== undefined && winners.length > 0` (otherwise no Result column and no winner claim); bidder names render as links to `/suppliers/{slug}/` when `supplierSlugById` is provided and maps the bid's `supplier_id`, else plain text; `displayTitle` (Task 6); `prepare` + `validateExport` (Tasks 10/2 — the site test derives expected bridge/winners through the SAME code path the page uses); `supplierSlug` (Task 7, in the site test); types from Task 2; fixture from Task 3; site-test harness `loadPage` from `tests/site/helpers.ts` (Task 13).
- Produces: routes `/council/` and `/council/{reference}/` that Tasks 17, 18, and 19 link to. This task's `/council/` is an interim plain prerendered year-grouped table (no island); Task 19 REPLACES `src/pages/council/index.astro` with the BrowseTable-island version and rewrites the index-page assertions in `tests/site/council.test.ts`. The record page passes `buyer: 'City of Toronto'` in Base's `filters` (the search buyer facet for City record pages).

- [ ] **Step 1: Write the failing site test**

Create `tests/site/council.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadPage } from './helpers';
import { prepare } from '../../src/prepare/prepare';
import { validateExport } from '../../src/prepare/validate';
import { supplierSlug } from '../../src/prepare/slugs';

// Expectations are derived through the SAME code path the page uses
// (prepare()'s bridge + dedupedAwardsByDoc) — never a re-derivation with
// different first-match rules.
const fx = validateExport(
  JSON.parse(readFileSync('tests/fixtures/bids.fixture.json', 'utf8')),
);
const p = prepare(fx);

// Fixture guarantees (Task 3 criteria): a council item whose bridge target is
// an included solicitation with mixed hst_basis bids, and a pre-2019 item
// whose bids all have document_number: null.
const bridged = fx.council_items.find((ci) => {
  const doc = p.bridge.refToDoc.get(ci.reference);
  return doc !== undefined && p.solByDoc.has(doc);
})!;
const bridgedDoc = p.bridge.refToDoc.get(bridged.reference)!;
const bridgedWinners = (p.dedupedAwardsByDoc.get(bridgedDoc) ?? [])
  .map((a) => a.supplier_name_raw)
  .filter((n): n is string => n !== null);
const unbridged = fx.council_items.find(
  (ci) => ci.bids.length > 0 && ci.bids.every((b) => b.document_number === null),
)!;
const withPdfs = fx.council_items.find((ci) => ci.background_pdfs.length > 0);
// A bridged-item bidder that resolves to an exported supplier — its name must
// link to the supplier profile (BidsTable's supplierSlugById prop).
const profileBidder = bridged.bids
  .map((b) =>
    b.supplier_id === null
      ? undefined
      : fx.suppliers.find((s) => s.supplier_id === b.supplier_id),
  )
  .find((s) => s !== undefined);

describe('/council/ index', () => {
  it('lists every council item, grouped by year, as plain HTML (no island)', () => {
    const $ = loadPage('council');
    for (const ci of fx.council_items) {
      expect($(`a[href$="/council/${ci.reference}/"]`).length).toBe(1);
    }
    const years = $('h2')
      .toArray()
      .map((el) => $(el).text());
    expect(years).toContain(bridged.reference.slice(0, 4));
    expect($('astro-island').length).toBe(0);
  });
});

describe('/council/{reference}/ record page', () => {
  it('renders reference, decision text, and every bidder under a single h1', () => {
    const $ = loadPage(`council/${bridged.reference}`);
    expect($('h1').length).toBe(1);
    const text = $('body').text();
    expect(text).toContain(bridged.reference);
    if (bridged.decision_text) {
      expect(text).toContain(bridged.decision_text.split(/\n+/)[0].trim());
    } else {
      expect(text).toContain('No decision text captured');
    }
    for (const b of bridged.bids) {
      expect(text).toContain(b.bidder_name_raw);
    }
    // hst_basis is load-bearing: the bid table must surface the basis.
    expect(text).toMatch(/hst/i);
  });

  it('links the bridged solicitation and claims winners only from its deduped awards', () => {
    const $ = loadPage(`council/${bridged.reference}`);
    const text = $('body').text();
    expect($(`a[href$="/solicitations/${bridgedDoc}/"]`).length).toBeGreaterThan(0);
    const headers = $('th')
      .toArray()
      .map((el) => $(el).text());
    if (bridgedWinners.length > 0) {
      expect(text).toContain('Winners are marked from the linked solicitation');
      expect(headers).toContain('Result');
    } else {
      expect(text).toContain('winner cannot be determined');
      expect(headers).not.toContain('Result');
    }
  });

  it.runIf(profileBidder !== undefined)(
    'links bidder names to supplier profiles via supplierSlugById',
    () => {
      const $ = loadPage(`council/${bridged.reference}`);
      expect(
        $(`a[href$="/suppliers/${supplierSlug(profileBidder!.supplier_key)}/"]`)
          .length,
      ).toBeGreaterThan(0);
    },
  );

  it('makes no winner claim and renders no Result column on an unbridged pre-2019 item', () => {
    const $ = loadPage(`council/${unbridged.reference}`);
    const text = $('body').text();
    expect(text).toContain('winner cannot be determined');
    expect(text).not.toContain('Winners are marked');
    const headers = $('th')
      .toArray()
      .map((el) => $(el).text());
    expect(headers).not.toContain('Result');
    for (const b of unbridged.bids) {
      expect(text).toContain(b.bidder_name_raw);
    }
  });

  it.runIf(withPdfs !== undefined)(
    'links every background PDF out to its City-hosted URL',
    () => {
      const $ = loadPage(`council/${withPdfs!.reference}`);
      for (const pdf of withPdfs!.background_pdfs) {
        expect($(`a[href="${pdf.url}"]`).length).toBe(1);
      }
    },
  );
});
```

- [ ] **Step 2: Run the site tests to verify they fail**

Run (frontend repo):

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts
```

Expected: build succeeds; vitest FAILS — every test in `tests/site/council.test.ts` errors with `ENOENT: no such file or directory` opening `dist/council/index.html` (and `dist/council/<reference>/index.html`). Site tests from earlier tasks stay green.

- [ ] **Step 3: Write the council record page**

Create `src/pages/council/[ref].astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import BidsTable from '../../components/BidsTable.astro';
import { getPrepared } from '../../prepare/prepare';
import { href } from '../../lib/url';
import { displayTitle } from '../../prepare/titles';
import type { CouncilItem } from '../../prepare/types';

export async function getStaticPaths() {
  const p = await getPrepared();
  return p.doc.council_items.map((item) => ({
    params: { ref: item.reference },
    props: { item },
  }));
}

const { item } = Astro.props as { item: CouncilItem };
const p = await getPrepared();

const yearMatch = item.reference.match(/^(\d{4})\./);
const year = yearMatch ? yearMatch[1] : null;

// Bridge: council reference -> solicitation document_number (from bids
// carrying both identifiers).
const linkedDoc = p.bridge.refToDoc.get(item.reference) ?? null;
const linkedSol = linkedDoc ? (p.solByDoc.get(linkedDoc) ?? null) : null;

// Winner marking is only determinable when the linked document has deduped
// award suppliers. BidsTable renders a Result column ONLY when winners is a
// non-empty string[]; passing undefined makes no winner claim at all.
const awardNames = linkedDoc
  ? (p.dedupedAwardsByDoc.get(linkedDoc) ?? [])
      .map((a) => a.supplier_name_raw)
      .filter((n): n is string => n !== null)
  : [];

const heading = item.title ?? `Council item ${item.reference}`;
const decisionParas = (item.decision_text ?? '')
  .split(/\n+/)
  .map((s) => s.trim())
  .filter(Boolean);
---
<Base
  title={`${item.reference} — ${heading}`}
  pagefind={true}
  filters={{
    type: 'Council item',
    buyer: 'City of Toronto',
    ...(year ? { year } : {}),
  }}
>
  <p><strong>Council reference:</strong> {item.reference}</p>

  {linkedSol && (
    <p>
      Linked solicitation:
      <a href={href(`/solicitations/${linkedSol.document_number}/`)}>
        {displayTitle(linkedSol).text}
      </a>
    </p>
  )}

  <section>
    <h2>Decision</h2>
    {decisionParas.length > 0 ? (
      decisionParas.map((para) => <p>{para}</p>)
    ) : (
      <p>No decision text captured for this item.</p>
    )}
  </section>

  <section>
    <h2>Bids ({item.bids.length})</h2>
    {item.bids.length > 0 ? (
      <>
        {awardNames.length > 0 ? (
          <p>
            Winners are marked from the linked solicitation's deduped award
            record.
          </p>
        ) : (
          <p>
            No linked award record — winner cannot be determined from this
            data.
          </p>
        )}
        <BidsTable
          bids={item.bids}
          winners={awardNames.length > 0 ? awardNames : undefined}
          supplierSlugById={p.supplierSlugById}
        />
      </>
    ) : (
      <p>No bids captured for this item.</p>
    )}
  </section>

  <section>
    <h2>Background documents ({item.background_pdfs.length})</h2>
    {item.background_pdfs.length > 0 ? (
      <ul>
        {item.background_pdfs.map((pdf) => (
          <li>
            <a href={pdf.url} rel="noopener">
              {pdf.kind}: {pdf.url.split('/').pop()}
            </a>
            {pdf.document_number && p.solByDoc.has(pdf.document_number) && (
              <>
                {' — relates to '}
                <a href={href(`/solicitations/${pdf.document_number}/`)}>
                  Doc {pdf.document_number}
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    ) : (
      <p>No background documents captured.</p>
    )}
  </section>
</Base>
```

Note: the page renders no `<h1>` in the slot — `Base.astro` renders the single `<h1>` from the `title` prop (`{reference} — {heading}`).

- [ ] **Step 4: Write the council index page (plain prerendered, no island)**

Create `src/pages/council/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import { getPrepared } from '../../prepare/prepare';
import { href } from '../../lib/url';
import type { CouncilItem } from '../../prepare/types';

const p = await getPrepared();

const byYear = new Map<string, CouncilItem[]>();
for (const item of p.doc.council_items) {
  const m = item.reference.match(/^(\d{4})\./);
  const year = m ? m[1] : 'Unknown';
  if (!byYear.has(year)) byYear.set(year, []);
  byYear.get(year)!.push(item);
}
const years = [...byYear.keys()].sort((a, b) => b.localeCompare(a));
for (const y of years) {
  byYear.get(y)!.sort((a, b) => a.reference.localeCompare(b.reference));
}
---
<Base
  title="Council items"
  description="City of Toronto council decisions on procurement, with bid tables including losing bidders."
>
  <p>
    {p.doc.council_items.length} council items with procurement decisions,
    grouped by year. Bid tables (including losing bidders) live on each item
    page.
  </p>
  {years.map((year) => (
    <section>
      <h2>{year}</h2>
      <table>
        <thead>
          <tr><th>Reference</th><th>Title</th><th>Bids</th></tr>
        </thead>
        <tbody>
          {byYear.get(year)!.map((item) => (
            <tr>
              <td>
                <a href={href(`/council/${item.reference}/`)}>
                  {item.reference}
                </a>
              </td>
              <td>{item.title ?? '(no title)'}</td>
              <td>{item.bids.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  ))}
</Base>
```

(No slot `<h1>` here either — Base's `title="Council items"` renders it. Task 19 later replaces this whole file with the island version.)

- [ ] **Step 5: Rebuild and run the site tests to verify they pass**

Run (frontend repo):

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts
```

Expected: PASS — all tests in `tests/site/council.test.ts` green (the supplier-profile-link and background-PDF tests are `runIf`-guarded and skip if the fixture lacks the triggering shape), all previously passing site tests still green. The `/suppliers/{slug}/` anchors asserted here are markup only — the target pages arrive in Task 17.

- [ ] **Step 6: Commit**

```bash
git add src/pages/council tests/site/council.test.ts && git commit -m "feat: council item record pages with bid tables and year-grouped index"
```

### Task 17: Supplier pages (`/suppliers/`, `/suppliers/{slug}/`)

**Files:**
- Create: `src/pages/suppliers/[slug].astro`
- Create: `src/pages/suppliers/index.astro`
- Test: `tests/site/suppliers.test.ts`

**Interfaces:**
- Consumes: `getPrepared()` (Task 10) — uses `p.rollupsBySlug: Map<string, SupplierRollup>`, `p.councilByRef`, `p.solByDoc`, `p.dedupedAwardsByDoc`, `p.bridge.refToDoc`, and `p.wsSlugByNumber` (workspace_number → routable slug from Task 7's `wsSlug`; noncompetitive links use the slug, the visible cell text stays the raw `workspace_number`); `SupplierRollup` / `SumResult` types (Task 2); `formatCAD` (Task 4); `dedupeAwards` (Task 5, used in tests to mirror the page's Won/Lost derivation); `displayTitle` (Task 6); `supplierSlug` (Task 7, used in tests to compute expected slugs from `supplier_key`); `href` and `Base.astro` (Task 13) — Base renders each page's ONLY `<h1>` from `title`; the slot adds none; `AmountCell.astro` with props `{ raw: string | null; numeric: number | null }` (Task 13); `loadPage` (Task 13); fixture (Task 3, requires backend #144 so suppliers carry `supplier_key`).
- Produces: routes `/suppliers/` and `/suppliers/{slug}/`. Won/Lost and single-bidder appearances are computed IN THE PAGE from existing `Prepared` data — no contract change: a bid is **Won** when its resolved document (`document_number`, else `bridge.refToDoc.get(reference)`) is among the documents where this supplier holds a deduped award, **Lost** when that document's deduped awards belong only to others, and **—** when no award record exists to decide; a **single-bidder appearance** is a bid whose containing bid table has exactly one bid (`reference ? p.councilByRef.get(reference)?.bids.length === 1 : p.solByDoc.get(document_number)?.bids.length === 1`). Unlinked bids and awards (document matching no solicitation) render as plain text with an explicit "not linked" note — never a dead link. Task 18's suspended-firms table and Task 19's browse island link to `/suppliers/{slug}/`. Task 19 REPLACES `src/pages/suppliers/index.astro` with the BrowseTable-island version and rewrites the index-page assertions in `tests/site/suppliers.test.ts`; this task's `/suppliers/` is an interim plain top-by-award-total table with a link note.

- [ ] **Step 1: Write the failing site test**

Create `tests/site/suppliers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadPage } from './helpers';
import { supplierSlug } from '../../src/prepare/slugs';
import { dedupeAwards } from '../../src/prepare/awards';
import type { ExportDoc } from '../../src/prepare/types';

const fx = JSON.parse(
  readFileSync('tests/fixtures/bids.fixture.json', 'utf8'),
) as ExportDoc;

const awarded = fx.suppliers.find((s) =>
  fx.solicitations.some((sol) =>
    sol.awards.some((a) => a.supplier_id === s.supplier_id),
  ),
)!;
const councilBidder = fx.suppliers.find((s) =>
  fx.council_items.some((ci) =>
    ci.bids.some((b) => b.supplier_id === s.supplier_id),
  ),
);
const councilBidderRef = councilBidder
  ? fx.council_items.find((ci) =>
      ci.bids.some((b) => b.supplier_id === councilBidder.supplier_id),
    )!.reference
  : null;
const suspendedWithId = fx.suspended_firms.filter(
  (f) =>
    f.supplier_id !== null &&
    fx.suppliers.some((s) => s.supplier_id === f.supplier_id),
);
const withVariants = fx.suppliers.find((s) => s.variants.length > 0);

// Won/Lost mirror of the page's derivation: a bid is Won when the supplier
// holds a deduped award on the bid's document, Lost when that document's
// deduped awards belong only to others.
const wonBidder = fx.suppliers.find((s) =>
  fx.solicitations.some(
    (sol) =>
      sol.bids.some((b) => b.supplier_id === s.supplier_id) &&
      dedupeAwards(sol.awards).some((a) => a.supplier_id === s.supplier_id),
  ),
);
const lostBidder = fx.suppliers.find((s) =>
  fx.solicitations.some((sol) => {
    const deduped = dedupeAwards(sol.awards);
    return (
      sol.bids.some((b) => b.supplier_id === s.supplier_id) &&
      deduped.length > 0 &&
      deduped.every((a) => a.supplier_id !== s.supplier_id)
    );
  }),
);

// Single-bidder mirror: this supplier's bids whose containing bid table has
// exactly one bid (the same rule the page applies).
function soleBidCount(supplierId: number): number {
  const all = [
    ...fx.council_items.flatMap((ci) => ci.bids),
    ...fx.solicitations.flatMap((sol) => sol.bids),
    ...fx.unlinked_bids,
  ];
  return all.filter((b) => {
    if (b.supplier_id !== supplierId) return false;
    if (b.reference !== null) {
      return (
        fx.council_items.find((ci) => ci.reference === b.reference)?.bids
          .length === 1
      );
    }
    if (b.document_number !== null) {
      return (
        fx.solicitations.find(
          (sol) => sol.document_number === b.document_number,
        )?.bids.length === 1
      );
    }
    return false;
  }).length;
}
const soleBidder = fx.suppliers.find((s) => soleBidCount(s.supplier_id) > 0);

// Unlinked records must render as text with a not-linked note, never a link.
const unlinkedBid = fx.unlinked_bids.find(
  (b) =>
    b.supplier_id !== null &&
    b.document_number !== null &&
    !fx.solicitations.some((s) => s.document_number === b.document_number) &&
    fx.suppliers.some((s) => s.supplier_id === b.supplier_id),
);
const unlinkedBidder = unlinkedBid
  ? fx.suppliers.find((s) => s.supplier_id === unlinkedBid.supplier_id)!
  : undefined;
const unlinkedAwardSupplier = fx.suppliers.find((s) =>
  fx.unlinked_awards.some((a) => a.supplier_id === s.supplier_id),
);

describe('/suppliers/ index', () => {
  it('renders a plain top-by-award-total table with a search note, no island', () => {
    const $ = loadPage('suppliers');
    expect($('h1').first().text()).toBe('Suppliers');
    expect($('body').text()).toContain(
      `${fx.suppliers.length} supplier profiles`,
    );
    expect($('body').text()).toContain('undercount');
    expect($('astro-island').length).toBe(0);
    expect($('a[href$="/search/"]').length).toBeGreaterThan(0);
  });
});

describe('/suppliers/{slug}/ profile page', () => {
  it('builds a page for every supplier, slugged from supplier_key, with a single h1', () => {
    for (const s of fx.suppliers.slice(0, 3)) {
      const $ = loadPage(`suppliers/${supplierSlug(s.supplier_key)}`);
      expect($('h1').length).toBe(1);
      expect($('h1').first().text()).toBe(s.display_name);
    }
  });

  it('separates award totals by keyspace and labels sums as undercounts', () => {
    const $ = loadPage(`suppliers/${supplierSlug(awarded.supplier_key)}`);
    const text = $('body').text();
    expect(text).toContain('City awards');
    expect(text).toContain('Composite awards');
    expect(text).toContain('Non-competitive contracts');
    expect(text).toContain('per keyspace and never merged');
    expect(text).toContain('undercount');
  });

  it.runIf(withVariants !== undefined)('lists raw name variants', () => {
    const $ = loadPage(
      `suppliers/${supplierSlug(withVariants!.supplier_key)}`,
    );
    const text = $('body').text();
    for (const v of withVariants!.variants) {
      expect(text).toContain(v);
    }
  });

  it.runIf(councilBidder !== undefined)(
    'links bids to their council item and shows the HST basis',
    () => {
      const $ = loadPage(
        `suppliers/${supplierSlug(councilBidder!.supplier_key)}`,
      );
      expect(
        $(`a[href$="/council/${councilBidderRef}/"]`).length,
      ).toBeGreaterThan(0);
      expect($('body').text()).toMatch(/hst/i);
    },
  );

  it.runIf(wonBidder !== undefined)(
    'marks a winning bid Won in the Result column',
    () => {
      const $ = loadPage(`suppliers/${supplierSlug(wonBidder!.supplier_key)}`);
      const results = $('td.bid-result')
        .toArray()
        .map((el) => $(el).text().trim());
      expect(results).toContain('Won');
    },
  );

  it.runIf(lostBidder !== undefined)(
    'marks a losing bid Lost in the Result column',
    () => {
      const $ = loadPage(`suppliers/${supplierSlug(lostBidder!.supplier_key)}`);
      const results = $('td.bid-result')
        .toArray()
        .map((el) => $(el).text().trim());
      expect(results).toContain('Lost');
    },
  );

  it('renders a Single-bidder appearances section with a count on every profile', () => {
    const $ = loadPage(`suppliers/${supplierSlug(awarded.supplier_key)}`);
    expect($('body').text()).toMatch(/Single-bidder appearances \(\d+\)/);
  });

  it.runIf(soleBidder !== undefined)(
    'counts single-bidder appearances from the containing bid tables',
    () => {
      const $ = loadPage(`suppliers/${supplierSlug(soleBidder!.supplier_key)}`);
      expect($('body').text()).toContain(
        `Single-bidder appearances (${soleBidCount(soleBidder!.supplier_id)})`,
      );
    },
  );

  it.runIf(unlinkedBidder !== undefined)(
    'renders unlinked bids as text with an explicit not-linked note, never a dead link',
    () => {
      const $ = loadPage(
        `suppliers/${supplierSlug(unlinkedBidder!.supplier_key)}`,
      );
      expect($('body').text()).toContain(
        'not linked — no matching solicitation record',
      );
      expect(
        $(`a[href$="/solicitations/${unlinkedBid!.document_number}/"]`).length,
      ).toBe(0);
    },
  );

  it.runIf(unlinkedAwardSupplier !== undefined)(
    'renders unlinked award rows without a solicitation link',
    () => {
      const $ = loadPage(
        `suppliers/${supplierSlug(unlinkedAwardSupplier!.supplier_key)}`,
      );
      expect($('body').text()).toContain(
        'not linked — no matching solicitation record',
      );
    },
  );

  it.runIf(suspendedWithId.length > 0)(
    'shows a suspended banner on suspended suppliers',
    () => {
      for (const firm of suspendedWithId) {
        const sup = fx.suppliers.find(
          (s) => s.supplier_id === firm.supplier_id,
        )!;
        const $ = loadPage(`suppliers/${supplierSlug(sup.supplier_key)}`);
        expect($('body').text()).toContain('Suspended firm');
      }
    },
  );
});
```

- [ ] **Step 2: Run the site tests to verify they fail**

Run (frontend repo):

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts
```

Expected: build succeeds; vitest FAILS — every non-skipped test in `tests/site/suppliers.test.ts` errors with `ENOENT: no such file or directory` opening `dist/suppliers/index.html` (and the profile paths). Other site test files stay green.

- [ ] **Step 3: Write the supplier profile page**

Create `src/pages/suppliers/[slug].astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import AmountCell from '../../components/AmountCell.astro';
import { getPrepared } from '../../prepare/prepare';
import { href } from '../../lib/url';
import { formatCAD } from '../../prepare/amounts';
import { displayTitle } from '../../prepare/titles';
import type { SupplierRollup, SumResult } from '../../prepare/types';

export async function getStaticPaths() {
  const p = await getPrepared();
  return [...p.rollupsBySlug.values()].map((rollup) => ({
    params: { slug: rollup.slug },
    props: { rollup },
  }));
}

const { rollup } = Astro.props as { rollup: SupplierRollup };
const p = await getPrepared();
const s = rollup.supplier;

function totalLine(t: SumResult): string {
  return `${formatCAD(t.total)} from ${t.counted} machine-parseable rows (${t.skipped} rows unparseable or excluded — an undercount)`;
}

/** Noncompetitive links use the routable slug; displayed text stays raw. */
function ncHref(workspaceNumber: string): string {
  return href(`/noncompetitive/${p.wsSlugByNumber.get(workspaceNumber)!}/`);
}

// Won/Lost and single-bidder appearances are computed here from Prepared
// data — no contract change.
type RollupBid = SupplierRollup['bids'][number];

const awardDocs = new Set(rollup.awards.map((a) => a.document_number));

function bidDoc(entry: RollupBid): string | null {
  if (entry.document_number !== null) return entry.document_number;
  if (entry.reference !== null) {
    return p.bridge.refToDoc.get(entry.reference) ?? null;
  }
  return null;
}

/** Won/Lost is claimed only when the resolved document has a deduped award record. */
function bidResult(entry: RollupBid): 'Won' | 'Lost' | '—' {
  const doc = bidDoc(entry);
  if (doc === null) return '—';
  if (awardDocs.has(doc)) return 'Won';
  return (p.dedupedAwardsByDoc.get(doc) ?? []).length > 0 ? 'Lost' : '—';
}

/** A single-bidder appearance: the containing bid table has exactly one bid. */
function isSoleBidder(entry: RollupBid): boolean {
  if (entry.reference !== null) {
    return p.councilByRef.get(entry.reference)?.bids.length === 1;
  }
  if (entry.document_number !== null) {
    return p.solByDoc.get(entry.document_number)?.bids.length === 1;
  }
  return false;
}

const soleBids = rollup.bids.filter(isSoleBidder);
---
<Base title={s.display_name} pagefind={true} filters={{ type: 'Supplier' }}>
  {rollup.suspended.length > 0 && (
    <aside role="alert">
      <strong>Suspended firm.</strong>
      <ul>
        {rollup.suspended.map((f) => (
          <li>
            {f.suspension_type ?? 'Suspension'} — status {f.status ?? 'unknown'}
            {f.start_date && ` from ${f.start_date}`}
            {f.end_date && ` to ${f.end_date}`}
            {f.council_authority && (
              <>
                {' (authority: '}
                {p.councilByRef.has(f.council_authority) ? (
                  <a href={href(`/council/${f.council_authority}/`)}>
                    {f.council_authority}
                  </a>
                ) : (
                  f.council_authority
                )}
                {')'}
              </>
            )}
          </li>
        ))}
      </ul>
    </aside>
  )}

  <section>
    <h2>Name variants ({s.variants.length})</h2>
    {s.variants.length > 0 ? (
      <ul>{s.variants.map((v) => <li>{v}</li>)}</ul>
    ) : (
      <p>No raw name variants recorded beyond the display name.</p>
    )}
  </section>

  <section>
    <h2>Awards won</h2>
    <p>
      Totals are per keyspace and never merged; each sums only
      machine-parseable amounts.
    </p>

    <h3>City awards ({rollup.awards.length})</h3>
    {rollup.awards.length > 0 ? (
      <>
        <p>Total: {totalLine(rollup.totals.cityAwards)}</p>
        <table>
          <thead>
            <tr><th>Solicitation</th><th>Amount</th><th>Date</th></tr>
          </thead>
          <tbody>
            {rollup.awards.map(({ document_number, sol, award }) => (
              <tr>
                <td>
                  {sol ? (
                    <a href={href(`/solicitations/${document_number}/`)}>
                      {displayTitle(sol).text}
                    </a>
                  ) : (
                    // Kept on one line: site tests assert this exact phrase.
                    <span>Doc {document_number} (not linked — no matching solicitation record)</span>
                  )}
                </td>
                <td>
                  <AmountCell
                    raw={award.award_amount}
                    numeric={award.award_amount_numeric}
                  />
                </td>
                <td>{award.award_date ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ) : (
      <p>No City award lines recorded.</p>
    )}

    <h3>Composite awards 2009–2012 ({rollup.compositeAwards.length})</h3>
    {rollup.compositeAwards.length > 0 ? (
      <>
        <p>Total: {totalLine(rollup.totals.composite)}</p>
        <table>
          <thead>
            <tr><th>Call</th><th>Title</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {rollup.compositeAwards.map((ca) => (
              <tr>
                <td>
                  <a href={href(`/calls/${ca.call_number}/`)}>
                    Call {ca.call_number}
                  </a>
                </td>
                <td>{ca.title ?? '—'}</td>
                <td>
                  <AmountCell
                    raw={ca.award_value}
                    numeric={ca.award_value_numeric}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ) : (
      <p>No composite award lines (the 2009–2012 keyspace).</p>
    )}

    <h3>Non-competitive contracts ({rollup.noncompetitive.length})</h3>
    {rollup.noncompetitive.length > 0 ? (
      <>
        <p>Total: {totalLine(rollup.totals.noncompetitive)}</p>
        <table>
          <thead>
            <tr><th>Workspace</th><th>Reason</th><th>Amount</th><th>Date</th></tr>
          </thead>
          <tbody>
            {rollup.noncompetitive.map((nc) => (
              <tr>
                <td>
                  <a href={ncHref(nc.workspace_number)}>
                    {nc.workspace_number}
                  </a>
                </td>
                <td>{nc.reason ?? '—'}</td>
                <td>
                  <AmountCell
                    raw={nc.contract_amount}
                    numeric={nc.contract_amount_numeric}
                  />
                </td>
                <td>{nc.contract_date ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ) : (
      <p>No non-competitive contracts recorded.</p>
    )}
  </section>

  <section>
    <h2>Bids ({rollup.bids.length})</h2>
    {rollup.bids.length > 0 ? (
      <>
        <table class="supplier-bids">
          <thead>
            <tr>
              <th>Record</th>
              <th>Bid price</th>
              <th>HST basis</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rollup.bids.map((entry) => (
              <tr>
                <td>
                  {entry.reference && p.councilByRef.has(entry.reference) ? (
                    <a href={href(`/council/${entry.reference}/`)}>
                      Council {entry.reference}
                    </a>
                  ) : entry.document_number &&
                    p.solByDoc.has(entry.document_number) ? (
                    <a href={href(`/solicitations/${entry.document_number}/`)}>
                      Doc {entry.document_number}
                    </a>
                  ) : entry.document_number ? (
                    // Kept on one line: site tests assert this exact phrase.
                    <span>Doc {entry.document_number} (not linked — no matching solicitation record)</span>
                  ) : entry.reference ? (
                    <span>Council {entry.reference} (not linked — no matching council item)</span>
                  ) : (
                    'not linked'
                  )}
                </td>
                <td>
                  <AmountCell
                    raw={entry.bid.bid_price}
                    numeric={entry.bid.bid_price_numeric}
                  />
                </td>
                <td>
                  {entry.bid.hst_basis === 'including'
                    ? 'incl. HST'
                    : entry.bid.hst_basis === 'excluding'
                      ? 'excl. HST'
                      : 'basis unknown'}
                </td>
                <td class="bid-result">{bidResult(entry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Won/Lost is determined from the linked record's deduped awards; "—"
          means no award record exists to determine an outcome.
        </p>
      </>
    ) : (
      <p>No bids recorded for this supplier.</p>
    )}
  </section>

  <section>
    <h2>Single-bidder appearances ({soleBids.length})</h2>
    {soleBids.length > 0 ? (
      <>
        <p>Records where this supplier's bid was the only bid received.</p>
        <ul>
          {soleBids.map((entry) => (
            <li>
              {entry.reference ? (
                <a href={href(`/council/${entry.reference}/`)}>
                  Council {entry.reference}
                </a>
              ) : (
                <a href={href(`/solicitations/${entry.document_number}/`)}>
                  Doc {entry.document_number}
                </a>
              )}
            </li>
          ))}
        </ul>
      </>
    ) : (
      <p>No single-bidder appearances in the captured bid record.</p>
    )}
  </section>
</Base>
```

Notes: the page renders no `<h1>` in the slot — Base's `title={s.display_name}` is the single `<h1>`. Every entry in `soleBids` resolves by construction (the sole-bidder rule only matches bids whose container exists in `councilByRef` / `solByDoc`), so its links are never dead.

- [ ] **Step 4: Write the suppliers index page**

Create `src/pages/suppliers/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import { getPrepared } from '../../prepare/prepare';
import { href } from '../../lib/url';
import { formatCAD } from '../../prepare/amounts';

const p = await getPrepared();
const rollups = [...p.rollupsBySlug.values()];
const top = rollups
  .filter((r) => r.totals.cityAwards.counted > 0)
  .sort((a, b) => b.totals.cityAwards.total - a.totals.cityAwards.total)
  .slice(0, 100);
---
<Base
  title="Suppliers"
  description="Supplier profiles: awards won, bids lost, name variants, suspensions."
>
  <p>
    {rollups.length} supplier profiles. Below: the top {top.length} by City
    award total (machine-parseable amounts only — an undercount). Every
    supplier has a profile page; use
    <a href={href('/search/')}>search</a> to find any supplier by name or raw
    variant. A filterable browse table over all suppliers follows in the
    browse section.
  </p>
  <table>
    <thead>
      <tr>
        <th>Supplier</th>
        <th>City award lines</th>
        <th>Bids</th>
        <th>City award total (parseable only)</th>
      </tr>
    </thead>
    <tbody>
      {top.map((r) => (
        <tr>
          <td>
            <a href={href(`/suppliers/${r.slug}/`)}>
              {r.supplier.display_name}
            </a>
          </td>
          <td>{r.awards.length}</td>
          <td>{r.bids.length}</td>
          <td>{formatCAD(r.totals.cityAwards.total)}</td>
        </tr>
      ))}
    </tbody>
  </table>
</Base>
```

(No slot `<h1>` — Base's `title="Suppliers"` renders it, so the index test's `$('h1').first().text()` assertion sees exactly one heading. Task 19 later replaces this whole file with the island version.)

- [ ] **Step 5: Rebuild and run the site tests to verify they pass**

Run (frontend repo):

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts
```

Expected: PASS — all tests in `tests/site/suppliers.test.ts` green; the Won/Lost, single-bidder-count, unlinked-bid, and unlinked-award tests are `runIf`-guarded and skip when the fixture lacks the triggering shape (the fixture's `unlinked_bids`/`unlinked_awards` are empty, so those two skip; the always-on test still asserts the Single-bidder appearances section renders with a count). All previously passing site tests stay green.

- [ ] **Step 6: Commit**

```bash
git add src/pages/suppliers tests/site/suppliers.test.ts && git commit -m "feat: supplier profile pages with won/lost, single-bidder appearances, per-keyspace totals"
```

### Task 18: Buyer pages + capital-projects + suspended-firms tables

**Files:**
- Create: `src/pages/buyers/index.astro`
- Create: `src/pages/buyers/[slug].astro`
- Create: `src/pages/capital-projects/index.astro`
- Create: `src/pages/suspended-firms/index.astro`
- Test: `tests/site/buyers.test.ts`
- Test: `tests/site/tables.test.ts`

**Interfaces:**
- Consumes: `getPrepared()` (Task 10) — uses `p.doc.buyers`, `p.doc.capital_projects`, `p.doc.suspended_firms`, `p.supplierSlugById`, `p.councilByRef`; `Buyer` type (Task 2); `href` and `Base.astro` (Task 13); `AmountCell.astro` props `{ raw: string | null; numeric: number | null }` (Task 13); `supplierSlug` (Task 7, in tests); `loadPage` (Task 13); fixture (Task 3) — the tests key off the fixture's SYNTHETIC buyers: slug `toronto-zoo-test` (partnered 0) and the partnered TRCA-like buyer (funding_share 0.626, one award with `value_confidential: 1`). Supplier profile routes from Task 17 and council routes from Task 16 are link targets.
- Produces: routes `/buyers/`, `/buyers/{slug}/`, `/capital-projects/`, `/suspended-firms/`. `estimated_range` is rendered verbatim text, never parsed or summed. `value_confidential === 1` renders exactly `value withheld (confidential attachment)`. Buyer record pages pass `filters={{ type: 'Buyer', buyer: buyer.name }}` to Base — the search buyer facet for agency records (City record pages pass `buyer: 'City of Toronto'`; see Tasks 14–16). `Base.astro` renders each page's ONLY `<h1>` from its `title` prop; none of these four pages renders an `<h1>` in the slot.

- [ ] **Step 1: Write the failing buyer site test**

Create `tests/site/buyers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadPage } from './helpers';
import type { ExportDoc } from '../../src/prepare/types';

const fx = JSON.parse(
  readFileSync('tests/fixtures/bids.fixture.json', 'utf8'),
) as ExportDoc;

// Fixture guarantees (Task 3 criteria): synthetic buyers exist.
const zoo = fx.buyers.find((b) => b.slug === 'toronto-zoo-test')!;
const partnered = fx.buyers.find((b) => b.partnered === 1)!;
const confidentialAward = partnered.awards.find(
  (a) => a.value_confidential === 1,
)!;

describe('/buyers/ index', () => {
  it('lists every buyer with a partnered marker and keyspace separation note', () => {
    const $ = loadPage('buyers');
    for (const b of fx.buyers) {
      expect($(`a[href$="/buyers/${b.slug}/"]`).length).toBe(1);
    }
    const text = $('body').text();
    expect(text).toContain('Partnered');
    expect(text).toContain('never merged into City headline numbers');
  });
});

describe('/buyers/{slug}/ pages', () => {
  it('renders honest empty states for sections with no records', () => {
    const $ = loadPage(`buyers/${zoo.slug}`);
    const text = $('body').text();
    expect($('h1').length).toBe(1);
    expect($('h1').first().text()).toBe(zoo.name);
    expect(text).toContain('Portal captured since');
    const sections: Array<[number, string]> = [
      [zoo.solicitations.length, 'no solicitations posted yet'],
      [zoo.awards.length, 'no awards published yet'],
      [zoo.bids.length, 'no bids posted yet'],
    ];
    for (const [count, msg] of sections) {
      if (count === 0) expect(text).toContain(msg);
    }
  });

  it('shows the partnered badge and funding share on a partnered buyer', () => {
    const $ = loadPage(`buyers/${partnered.slug}`);
    const text = $('body').text();
    expect(text).toContain('Partnered');
    expect(text).toContain(
      `${(partnered.funding_share! * 100).toFixed(1)}%`,
    );
  });

  it('renders confidential award values as withheld, not as amounts', () => {
    const $ = loadPage(`buyers/${partnered.slug}`);
    const text = $('body').text();
    expect(text).toContain('value withheld (confidential attachment)');
    expect(text).toContain(confidentialAward.native_ref);
  });
});
```

- [ ] **Step 2: Write the failing capital-projects and suspended-firms site test**

Create `tests/site/tables.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadPage } from './helpers';
import { supplierSlug } from '../../src/prepare/slugs';
import type { ExportDoc } from '../../src/prepare/types';

const fx = JSON.parse(
  readFileSync('tests/fixtures/bids.fixture.json', 'utf8'),
) as ExportDoc;

describe('/capital-projects/', () => {
  it('lists every project with estimated_range shown verbatim as text', () => {
    const $ = loadPage('capital-projects');
    const text = $('body').text();
    expect(text).toContain(`${fx.capital_projects.length} upcoming`);
    for (const cp of fx.capital_projects) {
      expect(text).toContain(cp.name);
      if (cp.estimated_range) expect(text).toContain(cp.estimated_range);
    }
    expect(text).toContain('never parsed');
  });
});

describe('/suspended-firms/', () => {
  it('lists every firm, linking supplier profiles and council authority', () => {
    const $ = loadPage('suspended-firms');
    const text = $('body').text();
    for (const f of fx.suspended_firms) {
      expect(text).toContain(f.supplier_name_raw);
    }
    for (const f of fx.suspended_firms) {
      if (f.supplier_id === null) continue;
      const sup = fx.suppliers.find((s) => s.supplier_id === f.supplier_id);
      if (!sup) continue;
      expect(
        $(`a[href$="/suppliers/${supplierSlug(sup.supplier_key)}/"]`).length,
      ).toBeGreaterThan(0);
    }
    for (const f of fx.suspended_firms) {
      if (
        f.council_authority &&
        fx.council_items.some((ci) => ci.reference === f.council_authority)
      ) {
        expect(
          $(`a[href$="/council/${f.council_authority}/"]`).length,
        ).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 3: Run the site tests to verify they fail**

Run (frontend repo):

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts
```

Expected: build succeeds; vitest FAILS — every test in `tests/site/buyers.test.ts` and `tests/site/tables.test.ts` errors with `ENOENT: no such file or directory` opening `dist/buyers/index.html`, `dist/capital-projects/index.html`, and `dist/suspended-firms/index.html`. Other site test files stay green.

- [ ] **Step 4: Write the buyers index page**

Create `src/pages/buyers/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import { getPrepared } from '../../prepare/prepare';
import { href } from '../../lib/url';

const p = await getPrepared();
const buyers = [...p.doc.buyers].sort((a, b) => a.name.localeCompare(b.name));
---
<Base
  title="Agencies and boards"
  description="Procurement records from partner agency (buyer) portals, kept separate from City headline numbers."
>
  <p>
    Records captured from agency procurement portals. Agency data lives in its
    own keyspace and is never merged into City headline numbers.
  </p>
  {buyers.length === 0 ? (
    <p>
      No agency portals captured yet. The agency expansion (TTC, Police, TCHC,
      Waterfront Toronto, Exhibition Place, TPL) is in progress; buyer pages
      appear here as portals come online.
    </p>
  ) : (
    <table>
      <thead>
        <tr>
          <th>Buyer</th>
          <th>Kind</th>
          <th>Partnered</th>
          <th>Solicitations</th>
          <th>Awards</th>
          <th>Bids</th>
        </tr>
      </thead>
      <tbody>
        {buyers.map((b) => (
          <tr>
            <td><a href={href(`/buyers/${b.slug}/`)}>{b.name}</a></td>
            <td>{b.kind}</td>
            <td>{b.partnered === 1 ? 'Partnered' : '—'}</td>
            <td>{b.solicitations.length}</td>
            <td>{b.awards.length}</td>
            <td>{b.bids.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</Base>
```

- [ ] **Step 5: Write the buyer record page**

Create `src/pages/buyers/[slug].astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import AmountCell from '../../components/AmountCell.astro';
import { getPrepared } from '../../prepare/prepare';
import type { Buyer } from '../../prepare/types';

export async function getStaticPaths() {
  const p = await getPrepared();
  return p.doc.buyers.map((buyer) => ({
    params: { slug: buyer.slug },
    props: { buyer },
  }));
}

const { buyer } = Astro.props as { buyer: Buyer };
const capturedSince = buyer.first_seen.slice(0, 10);
---
<Base
  title={buyer.name}
  pagefind={true}
  filters={{ type: 'Buyer', buyer: buyer.name }}
>
  <p>
    {buyer.kind}
    {buyer.partnered === 1 && <strong> · Partnered</strong>}
    {buyer.funding_share !== null && (
      <span> · City funding share: {(buyer.funding_share * 100).toFixed(1)}%</span>
    )}
    {buyer.platform && <span> · Platform: {buyer.platform}</span>}
  </p>
  {buyer.notes && <p>{buyer.notes}</p>}
  <p>Portal captured since {capturedSince}.</p>

  <section>
    <h2>Solicitations ({buyer.solicitations.length})</h2>
    {buyer.solicitations.length === 0 ? (
      <p>Portal captured since {capturedSince}; no solicitations posted yet.</p>
    ) : (
      <table>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Title</th>
            <th>Status</th>
            <th>Posted</th>
            <th>Closing</th>
            <th>Portal</th>
          </tr>
        </thead>
        <tbody>
          {buyer.solicitations.map((s) => (
            <tr>
              <td>{s.native_ref}</td>
              <td>{s.title ?? '(no title published)'}</td>
              <td>{s.status ?? '—'}</td>
              <td>{s.posted_date ?? '—'}</td>
              <td>{s.closing_date ?? '—'}</td>
              <td>
                {s.portal_url ? (
                  <a href={s.portal_url} rel="noopener">portal</a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </section>

  <section>
    <h2>Awards ({buyer.awards.length})</h2>
    {buyer.awards.length === 0 ? (
      <p>Portal captured since {capturedSince}; no awards published yet.</p>
    ) : (
      <table>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Supplier</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Report</th>
          </tr>
        </thead>
        <tbody>
          {buyer.awards.map((a) => (
            <tr>
              <td>{a.native_ref}</td>
              <td>{a.supplier_name_raw ?? '—'}</td>
              <td>
                {a.value_confidential === 1 ? (
                  'value withheld (confidential attachment)'
                ) : (
                  <AmountCell
                    raw={a.award_amount}
                    numeric={a.award_amount_numeric}
                  />
                )}
              </td>
              <td>{a.award_date ?? '—'}</td>
              <td>
                {a.report_url ? (
                  <a href={a.report_url} rel="noopener">report</a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </section>

  <section>
    <h2>Bids ({buyer.bids.length})</h2>
    {buyer.bids.length === 0 ? (
      <p>Portal captured since {capturedSince}; no bids posted yet.</p>
    ) : (
      <table>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Bidder</th>
            <th>Bid price</th>
            <th>Report</th>
          </tr>
        </thead>
        <tbody>
          {buyer.bids.map((b) => (
            <tr>
              <td>{b.native_ref}</td>
              <td>{b.bidder_name_raw}</td>
              <td>
                <AmountCell raw={b.bid_price} numeric={b.bid_price_numeric} />
              </td>
              <td>
                {b.report_url ? (
                  <a href={b.report_url} rel="noopener">report</a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </section>
</Base>
```

- [ ] **Step 6: Write the capital-projects table page**

Create `src/pages/capital-projects/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import { getPrepared } from '../../prepare/prepare';

const p = await getPrepared();
const projects = [...p.doc.capital_projects].sort((a, b) =>
  a.name.localeCompare(b.name),
);
---
<Base
  title="Capital project pipeline"
  description="City-published pipeline of upcoming capital procurements."
>
  <p>
    {projects.length} upcoming capital procurements as published by the City.
    Estimated ranges are the City's published text and are shown verbatim —
    they are never parsed into numbers or summed.
  </p>
  <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>Project</th>
          <th>Contract #</th>
          <th>Type of work</th>
          <th>Delivery division</th>
          <th>Sourcing year</th>
          <th>Award year</th>
          <th>Sourcing type</th>
          <th>Estimated range</th>
          <th>Term (months)</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((cp) => (
          <tr>
            <td>{cp.name}</td>
            <td>{cp.contract_number ?? '—'}</td>
            <td>{cp.type_of_work ?? '—'}</td>
            <td>{cp.delivery_division ?? '—'}</td>
            <td>{cp.target_sourcing_year ?? '—'}</td>
            <td>{cp.target_award_year ?? '—'}</td>
            <td>{cp.sourcing_type ?? '—'}</td>
            <td>{cp.estimated_range ?? '—'}</td>
            <td>{cp.estimated_term_months ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</Base>
```

- [ ] **Step 7: Write the suspended-firms table page**

Create `src/pages/suspended-firms/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import { getPrepared } from '../../prepare/prepare';
import { href } from '../../lib/url';

const p = await getPrepared();
const firms = p.doc.suspended_firms;
---
<Base
  title="Suspended firms"
  description="Firms suspended from City procurement, with council authority."
>
  <p>{firms.length} firms suspended from bidding on City procurement.</p>
  <table>
    <thead>
      <tr>
        <th>Firm</th>
        <th>Status</th>
        <th>Type</th>
        <th>Start</th>
        <th>End</th>
        <th>Council authority</th>
      </tr>
    </thead>
    <tbody>
      {firms.map((f) => {
        const slug =
          f.supplier_id !== null
            ? (p.supplierSlugById.get(f.supplier_id) ?? null)
            : null;
        return (
          <tr>
            <td>
              {slug ? (
                <a href={href(`/suppliers/${slug}/`)}>{f.supplier_name_raw}</a>
              ) : (
                f.supplier_name_raw
              )}
            </td>
            <td>{f.status ?? '—'}</td>
            <td>{f.suspension_type ?? '—'}</td>
            <td>{f.start_date ?? '—'}</td>
            <td>{f.end_date ?? '—'}</td>
            <td>
              {f.council_authority ? (
                p.councilByRef.has(f.council_authority) ? (
                  <a href={href(`/council/${f.council_authority}/`)}>
                    {f.council_authority}
                  </a>
                ) : (
                  f.council_authority
                )
              ) : (
                '—'
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</Base>
```

- [ ] **Step 8: Rebuild and run the site tests to verify they pass**

Run (frontend repo):

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build && npx vitest run -c vitest.site.config.ts
```

Expected: PASS — all tests in `tests/site/buyers.test.ts` and `tests/site/tables.test.ts` green, all previously passing site tests still green.

- [ ] **Step 9: Commit**

```bash
git add src/pages/buyers src/pages/capital-projects src/pages/suspended-firms tests/site/buyers.test.ts tests/site/tables.test.ts && git commit -m "feat: buyer pages with empty states, capital-projects and suspended-firms tables"
```

### Task 19: BrowseTable island + JSON index endpoints + browse pages with noscript fallback

**Files:**
- Create: `src/islands/BrowseTable.tsx`
- Create: `src/pages/indexes/solicitations.json.ts`
- Create: `src/pages/indexes/suppliers.json.ts`
- Create: `src/pages/indexes/noncompetitive.json.ts`
- Create: `src/pages/indexes/council.json.ts`
- Create: `src/pages/solicitations/index.astro`
- Create: `src/pages/noncompetitive/index.astro`
- Modify: `src/pages/council/index.astro` (full replacement of Task 16's placeholder list page)
- Modify: `src/pages/suppliers/index.astro` (full replacement of Task 17's placeholder list page)
- Modify: `tests/site/council.test.ts` (replace the `/council/ index` describe block — its no-island/year-h2/per-item-link assertions target the page this task replaces)
- Modify: `tests/site/suppliers.test.ts` (replace the `/suppliers/ index` describe block — its no-island/"supplier profiles"/search-link assertions target the page this task replaces)
- Test: `tests/site/browse.test.ts`

**Interfaces:**
- Consumes: `getPrepared(): Promise<Prepared>` (Task 10); `buildSolicitationIndex`, `buildSupplierIndex`, `buildNoncompetitiveIndex`, `buildCouncilIndex` and the `SolicitationIndexRow`/`SupplierIndexRow`/`NoncompetitiveIndexRow`/`CouncilIndexRow` interfaces (Task 9) — `NoncompetitiveIndexRow` carries `wl` (the URL-safe workspace slug from `wsSlug`, Tasks 7/9/10): every `/noncompetitive/{...}/` link is built from `wl`, never from the raw `w`, which is display-only; `formatCAD(n: number): string` (Task 4); `href(path: string): string` and `Base.astro` (Task 13); `loadPage(relPath: string): CheerioAPI` (Task 13). Depends on `astro`, `@astrojs/react`, `react`, `@tanstack/react-table` from Task 1.
- Produces: `BrowseTable` (default export) with props `{ entity: 'solicitations' | 'suppliers' | 'noncompetitive' | 'council'; indexUrl: string; base: string }` — the solicitations table carries all six spec facets: status, rfx type, category, division, year (selects) and has-documents (checkbox); static JSON endpoints at `/indexes/solicitations.json`, `/indexes/suppliers.json`, `/indexes/noncompetitive.json`, `/indexes/council.json` (Task 20's tests read these from `dist/` to discover record slugs); browse pages at `/solicitations/`, `/noncompetitive/`, `/council/`, `/suppliers/`, each with a `<noscript>` first-50-rows static table and NO slot `<h1>` (Base renders the only h1 from `title`). This task replaces the Task 16/17 index pages AND their index-page site-test describe blocks (the record-page tests in those files are untouched).

- [ ] **Step 1: Write the failing site test**

Create `tests/site/browse.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPage } from './helpers';

const ENDPOINTS: { file: string; keys: string[] }[] = [
  { file: 'indexes/solicitations.json', keys: ['d', 't', 'u', 's', 'r', 'c', 'v', 'y', 'dl', 'a', 'nb', 'nd'] },
  { file: 'indexes/suppliers.json', keys: ['g', 'n', 'na', 'nb', 'a'] },
  { file: 'indexes/noncompetitive.json', keys: ['w', 'wl', 'n', 'r', 'v', 'y', 'a'] },
  { file: 'indexes/council.json', keys: ['f', 't', 'y', 'nb'] },
];

describe('JSON index endpoints', () => {
  for (const { file, keys } of ENDPOINTS) {
    it(`${file} is parseable JSON whose rows carry the compact keys`, () => {
      const raw = readFileSync(join('dist', file), 'utf8');
      const rows = JSON.parse(raw);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(Object.keys(rows[0]), `${file} row missing key "${key}"`).toContain(key);
      }
    });
  }
});

const BROWSE_PAGES = [
  { path: 'solicitations', index: 'indexes/solicitations.json' },
  { path: 'suppliers', index: 'indexes/suppliers.json' },
  { path: 'noncompetitive', index: 'indexes/noncompetitive.json' },
  { path: 'council', index: 'indexes/council.json' },
];

describe('browse pages', () => {
  for (const { path, index } of BROWSE_PAGES) {
    it(`/${path}/ mounts the BrowseTable island pointing at ${index}`, () => {
      const $ = loadPage(path);
      const island = $('astro-island[client="load"]');
      expect(island.length).toBeGreaterThanOrEqual(1);
      expect(island.attr('props') ?? '').toContain(index);
    });

    it(`/${path}/ contains a noscript static fallback table`, () => {
      const raw = readFileSync(join('dist', path, 'index.html'), 'utf8');
      expect(raw).toMatch(/<noscript>[\s\S]*?<table[\s\S]*?<\/noscript>/);
    });
  }
});

describe('solicitations facets', () => {
  it('/solicitations/ prerenders all six facet controls in the island', () => {
    const $ = loadPage('solicitations');
    const labels = $('astro-island label').text();
    for (const facet of ['Status', 'Type', 'Category', 'Division', 'Year', 'Has documents']) {
      expect(labels, `missing facet control "${facet}"`).toContain(facet);
    }
    expect($('astro-island input[type="checkbox"]').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build
npx vitest run -c vitest.site.config.ts tests/site/browse.test.ts
```

Expected: build succeeds (pages from Tasks 13-18 unchanged), then FAIL — the four endpoint tests error with `ENOENT: no such file or directory, open 'dist/indexes/solicitations.json'` (etc.), the solicitations/noncompetitive page tests and the facets test error with `ENOENT ... 'dist/solicitations/index.html'` / `'dist/noncompetitive/index.html'`, the council/suppliers island tests fail with `expected 0 to be greater than or equal to 1`, and the council/suppliers noscript tests fail (the Task 16/17 index pages have no `<noscript>` table).

- [ ] **Step 3: Create the four JSON index endpoints**

Create `src/pages/indexes/solicitations.json.ts`:

```ts
import { getPrepared } from '../../prepare/prepare';
import { buildSolicitationIndex } from '../../prepare/indexes';

export async function GET() {
  const p = await getPrepared();
  return new Response(JSON.stringify(buildSolicitationIndex(p)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Create `src/pages/indexes/suppliers.json.ts`:

```ts
import { getPrepared } from '../../prepare/prepare';
import { buildSupplierIndex } from '../../prepare/indexes';

export async function GET() {
  const p = await getPrepared();
  return new Response(JSON.stringify(buildSupplierIndex(p)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Create `src/pages/indexes/noncompetitive.json.ts`:

```ts
import { getPrepared } from '../../prepare/prepare';
import { buildNoncompetitiveIndex } from '../../prepare/indexes';

export async function GET() {
  const p = await getPrepared();
  return new Response(JSON.stringify(buildNoncompetitiveIndex(p)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Create `src/pages/indexes/council.json.ts`:

```ts
import { getPrepared } from '../../prepare/prepare';
import { buildCouncilIndex } from '../../prepare/indexes';

export async function GET() {
  const p = await getPrepared();
  return new Response(JSON.stringify(buildCouncilIndex(p)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 4: Create the BrowseTable island**

Create `src/islands/BrowseTable.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { formatCAD } from '../prepare/amounts';

// Rows are the compact index rows emitted by src/prepare/indexes.ts:
//   solicitations: { d, t, u, s, r, c, v, y, dl, a, nb, nd }
//   suppliers:     { g, n, na, nb, a }
//   noncompetitive:{ w, wl, n, r, v, y, a }  (wl = URL-safe workspace slug; links use it)
//   council:       { f, t, y, nb }
type Row = Record<string, any>;

export type BrowseEntity = 'solicitations' | 'suppliers' | 'noncompetitive' | 'council';

export interface BrowseTableProps {
  entity: BrowseEntity;
  indexUrl: string;
  /** import.meta.env.BASE_URL, passed by the page; used to build record links. */
  base: string;
}

interface SelectFilter {
  id: string; // compact column key in the index row
  param: string; // query-string parameter name
  label: string;
}

// All six spec facets for solicitations: status, rfx type, category, division,
// and year are selects; has-documents is a checkbox (CHECKS below).
const SELECTS: Record<BrowseEntity, SelectFilter[]> = {
  solicitations: [
    { id: 's', param: 'status', label: 'Status' },
    { id: 'r', param: 'type', label: 'Type' },
    { id: 'c', param: 'category', label: 'Category' },
    { id: 'v', param: 'division', label: 'Division' },
    { id: 'y', param: 'year', label: 'Year' },
  ],
  suppliers: [],
  noncompetitive: [{ id: 'y', param: 'year', label: 'Year' }],
  council: [{ id: 'y', param: 'year', label: 'Year' }],
};

interface CheckFilter {
  id: string; // column whose filterFn implements the boolean facet
  param: string; // query-string parameter name (serialized as `<param>=yes`)
  label: string;
}

const CHECKS: Record<BrowseEntity, CheckFilter[]> = {
  solicitations: [{ id: 'nd', param: 'docs', label: 'Has documents' }],
  suppliers: [],
  noncompetitive: [],
  council: [],
};

const exactText: FilterFn<Row> = (row, columnId, filterValue) =>
  String(row.getValue(columnId)) === String(filterValue);

// Checkbox facet: keep only rows with a positive count (nd > 0 = has documents).
const positiveCount: FilterFn<Row> = (row, columnId) => Number(row.getValue(columnId)) > 0;

function money(v: unknown): string {
  return typeof v === 'number' ? formatCAD(v) : '—';
}

function buildColumns(entity: BrowseEntity, link: (path: string) => string): ColumnDef<Row, any>[] {
  switch (entity) {
    case 'solicitations':
      return [
        { accessorKey: 'd', header: 'Document #' },
        {
          accessorKey: 't',
          header: 'Title',
          cell: (c) => (
            <a
              href={link(`solicitations/${c.row.original.d}/`)}
              className={c.row.original.u ? 'italic' : undefined}
            >
              {c.getValue<string>()}
            </a>
          ),
        },
        { accessorKey: 's', header: 'Status', filterFn: exactText },
        { accessorKey: 'r', header: 'Type', filterFn: exactText },
        { accessorKey: 'c', header: 'Category', filterFn: exactText },
        { accessorKey: 'v', header: 'Division', filterFn: exactText },
        { accessorKey: 'y', header: 'Year', filterFn: exactText },
        { accessorKey: 'dl', header: 'Deadline' },
        { accessorKey: 'a', header: 'Awarded (parsed)', cell: (c) => money(c.getValue()) },
        { accessorKey: 'nb', header: 'Bids' },
        { accessorKey: 'nd', header: 'Docs', filterFn: positiveCount },
      ];
    case 'suppliers':
      return [
        {
          accessorKey: 'n',
          header: 'Supplier',
          cell: (c) => <a href={link(`suppliers/${c.row.original.g}/`)}>{c.getValue<string>()}</a>,
        },
        { accessorKey: 'na', header: 'Award lines' },
        { accessorKey: 'nb', header: 'Bids' },
        { accessorKey: 'a', header: 'City awards (parsed)', cell: (c) => money(c.getValue()) },
      ];
    case 'noncompetitive':
      return [
        {
          accessorKey: 'w',
          header: 'Workspace #',
          // Link from the URL-safe slug (wl); display the raw workspace_number.
          cell: (c) => (
            <a href={link(`noncompetitive/${c.row.original.wl}/`)}>{c.getValue<string>()}</a>
          ),
        },
        { accessorKey: 'n', header: 'Supplier' },
        { accessorKey: 'r', header: 'Reason' },
        { accessorKey: 'v', header: 'Division' },
        { accessorKey: 'y', header: 'Year', filterFn: exactText },
        { accessorKey: 'a', header: 'Amount (parsed)', cell: (c) => money(c.getValue()) },
      ];
    case 'council':
      return [
        {
          accessorKey: 'f',
          header: 'Reference',
          cell: (c) => <a href={link(`council/${c.getValue<string>()}/`)}>{c.getValue<string>()}</a>,
        },
        { accessorKey: 't', header: 'Title' },
        { accessorKey: 'y', header: 'Year', filterFn: exactText },
        { accessorKey: 'nb', header: 'Bids' },
      ];
    default:
      return [];
  }
}

export default function BrowseTable({ entity, indexUrl, base }: BrowseTableProps) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [ready, setReady] = useState(false); // true once the URL query string has been read

  const selects = SELECTS[entity];
  const checks = CHECKS[entity];
  const link = useMemo(() => {
    const b = base.endsWith('/') ? base : `${base}/`;
    return (path: string) => b + path;
  }, [base]);
  const columns = useMemo(() => buildColumns(entity, link), [entity, link]);

  // 1. Fetch the prebuilt compact index.
  useEffect(() => {
    let cancelled = false;
    fetch(indexUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${indexUrl}`);
        return r.json();
      })
      .then((rows: Row[]) => {
        if (!cancelled) {
          setData(rows);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [indexUrl]);

  // 2. Read initial state from the query string (client only, once).
  //    Kept out of useState initializers so build-time SSR (client:load still
  //    prerenders) never touches `window` and hydration cannot mismatch.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setGlobalFilter(q);
    const cf: ColumnFiltersState = [];
    for (const s of selects) {
      const v = params.get(s.param);
      if (v) cf.push({ id: s.id, value: v });
    }
    for (const cb of checks) {
      if (params.get(cb.param) === 'yes') cf.push({ id: cb.id, value: true });
    }
    if (cf.length > 0) setColumnFilters(cf);
    const sort = params.get('sort');
    if (sort) {
      const [id, dir] = sort.split('.');
      if (id) setSorting([{ id, desc: dir === 'desc' }]);
    }
    const page = Number(params.get('page') ?? '1');
    if (Number.isInteger(page) && page > 1) {
      setPagination((prev) => ({ ...prev, pageIndex: page - 1 }));
    }
    setReady(true);
    // Runs once on mount; `selects`/`checks` are module-level constants per entity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Serialize state back to the query string so filtered views are citable URLs.
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    if (globalFilter) params.set('q', globalFilter);
    for (const s of selects) {
      const f = columnFilters.find((c) => c.id === s.id);
      if (f && f.value != null && f.value !== '') params.set(s.param, String(f.value));
    }
    for (const cb of checks) {
      if (columnFilters.some((f) => f.id === cb.id)) params.set(cb.param, 'yes');
    }
    if (sorting.length > 0) {
      params.set('sort', `${sorting[0].id}.${sorting[0].desc ? 'desc' : 'asc'}`);
    }
    if (pagination.pageIndex > 0) params.set('page', String(pagination.pageIndex + 1));
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [ready, globalFilter, columnFilters, sorting, pagination, selects, checks]);

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, columnFilters, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  // Distinct values for the select filters, derived from the loaded data.
  const options = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const s of selects) {
      const values = new Set<string>();
      for (const row of data) {
        const v = row[s.id];
        if (v !== null && v !== undefined && v !== '') values.add(String(v));
      }
      out[s.id] = Array.from(values).sort((a, b) =>
        s.id === 'y' ? Number(b) - Number(a) : a.localeCompare(b),
      );
    }
    return out;
  }, [data, selects]);

  const setSelect = (id: string, value: string) => {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== id);
      return value === '' ? rest : [...rest, { id, value }];
    });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const setCheck = (id: string, on: boolean) => {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== id);
      return on ? [...rest, { id, value: true }] : rest;
    });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  if (error) {
    return <p role="alert">Failed to load the browse index ({error}). Reload to retry.</p>;
  }

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div>
      <div className="my-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Filter
          <input
            type="search"
            value={globalFilter}
            placeholder="Any text or identifier"
            className="rounded border px-2 py-1"
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          />
        </label>
        {selects.map((s) => {
          const current = columnFilters.find((f) => f.id === s.id);
          return (
            <label key={s.id} className="flex flex-col text-sm">
              {s.label}
              <select
                value={current ? String(current.value) : ''}
                className="rounded border px-2 py-1"
                onChange={(e) => setSelect(s.id, e.target.value)}
              >
                <option value="">All</option>
                {(options[s.id] ?? []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        {checks.map((cb) => (
          <label key={cb.id} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={columnFilters.some((f) => f.id === cb.id)}
              onChange={(e) => setCheck(cb.id, e.target.checked)}
            />
            {cb.label}
          </label>
        ))}
      </div>
      {loading ? (
        <p>Loading table…</p>
      ) : (
        <>
          <p className="text-sm">
            {filteredCount.toLocaleString('en-CA')} of {data.length.toLocaleString('en-CA')} rows
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="cursor-pointer select-none border-b px-2 py-1 text-left"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {({ asc: ' ▲', desc: ' ▼' } as Record<string, string>)[
                          h.column.getIsSorted() as string
                        ] ?? ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b align-top">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-2 py-1">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="my-4 flex items-center gap-2">
            <button
              type="button"
              className="rounded border px-2 py-1 disabled:opacity-50"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </button>
            <span className="text-sm">
              Page {pagination.pageIndex + 1} of {pageCount}
            </span>
            <button
              type="button"
              className="rounded border px-2 py-1 disabled:opacity-50"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create the solicitations and noncompetitive browse pages**

All four browse pages render NO slot `<h1>` — `Base.astro` renders the only h1 from the `title` prop (single-h1 rule).

Create `src/pages/solicitations/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import BrowseTable from '../../islands/BrowseTable';
import { getPrepared } from '../../prepare/prepare';
import { buildSolicitationIndex } from '../../prepare/indexes';
import { href } from '../../lib/url';

const p = await getPrepared();
const rows = buildSolicitationIndex(p);
const first = rows.slice(0, 50);
---

<Base
  title="Solicitations"
  description="Browse all competitive City of Toronto solicitations; filter by status, type, category, division, year, and has-documents."
>
  <p>
    {rows.length.toLocaleString('en-CA')} competitive solicitations (the
    <code>document_number</code> keyspace). Filters and sorting are reflected in the
    URL, so a filtered view is a citable link. Award totals sum machine-parseable
    amounts only and are undercounts.
  </p>
  <BrowseTable
    client:load
    entity="solicitations"
    indexUrl={href('/indexes/solicitations.json')}
    base={import.meta.env.BASE_URL}
  />
  <noscript>
    <p>
      JavaScript is off — showing the first 50 of {rows.length.toLocaleString('en-CA')}
      rows. Sorting and filtering need JavaScript.
    </p>
    <table>
      <thead>
        <tr><th>Document #</th><th>Title</th><th>Status</th><th>Type</th><th>Year</th></tr>
      </thead>
      <tbody>
        {first.map((r) => (
          <tr>
            <td>{r.d}</td>
            <td><a href={href(`/solicitations/${r.d}/`)}>{r.t}</a></td>
            <td>{r.s}</td>
            <td>{r.r ?? '—'}</td>
            <td>{r.y}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </noscript>
</Base>
```

Create `src/pages/noncompetitive/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import BrowseTable from '../../islands/BrowseTable';
import { getPrepared } from '../../prepare/prepare';
import { buildNoncompetitiveIndex } from '../../prepare/indexes';
import { formatCAD } from '../../prepare/amounts';
import { href } from '../../lib/url';

const p = await getPrepared();
const rows = buildNoncompetitiveIndex(p);
const first = rows.slice(0, 50);
---

<Base
  title="Non-competitive contracts"
  description="Browse sole-source City of Toronto contracts with the City's stated reason."
>
  <p>
    {rows.length.toLocaleString('en-CA')} sole-source contracts with the City's stated
    reason (the <code>workspace_number</code> keyspace — never joined with document
    numbers). Amounts shown are the machine-parseable tier only. Filters and sorting
    are reflected in the URL.
  </p>
  <BrowseTable
    client:load
    entity="noncompetitive"
    indexUrl={href('/indexes/noncompetitive.json')}
    base={import.meta.env.BASE_URL}
  />
  <noscript>
    <p>
      JavaScript is off — showing the first 50 of {rows.length.toLocaleString('en-CA')}
      rows. Sorting and filtering need JavaScript.
    </p>
    <table>
      <thead>
        <tr>
          <th>Workspace #</th><th>Supplier</th><th>Division</th><th>Year</th>
          <th>Amount (parsed)</th>
        </tr>
      </thead>
      <tbody>
        {first.map((r) => (
          <tr>
            <td><a href={href(`/noncompetitive/${r.wl}/`)}>{r.w}</a></td>
            <td>{r.n ?? '—'}</td>
            <td>{r.v ?? '—'}</td>
            <td>{r.y ?? '—'}</td>
            <td>{r.a === null ? '—' : formatCAD(r.a)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </noscript>
</Base>
```

- [ ] **Step 6: Replace the council and suppliers index pages with island versions**

Replace the full contents of `src/pages/council/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import BrowseTable from '../../islands/BrowseTable';
import { getPrepared } from '../../prepare/prepare';
import { buildCouncilIndex } from '../../prepare/indexes';
import { href } from '../../lib/url';

const p = await getPrepared();
const rows = buildCouncilIndex(p);
const first = rows.slice(0, 50);
---

<Base
  title="Council items"
  description="Browse council items with procurement decisions: decision text, bid tables, staff reports."
>
  <p>
    {rows.length.toLocaleString('en-CA')} council items (the <code>reference</code>
    keyspace, <code>YYYY.CCNN.N</code>), including bid tables with winning and losing
    bidders. Filters and sorting are reflected in the URL, so filtered views are
    citable.
  </p>
  <BrowseTable
    client:load
    entity="council"
    indexUrl={href('/indexes/council.json')}
    base={import.meta.env.BASE_URL}
  />
  <noscript>
    <p>
      JavaScript is off — showing the first 50 of {rows.length.toLocaleString('en-CA')}
      rows. Sorting and filtering need JavaScript.
    </p>
    <table>
      <thead>
        <tr><th>Reference</th><th>Title</th><th>Year</th><th>Bids</th></tr>
      </thead>
      <tbody>
        {first.map((r) => (
          <tr>
            <td><a href={href(`/council/${r.f}/`)}>{r.f}</a></td>
            <td>{r.t ?? '—'}</td>
            <td>{r.y}</td>
            <td>{r.nb}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </noscript>
</Base>
```

Replace the full contents of `src/pages/suppliers/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import BrowseTable from '../../islands/BrowseTable';
import { getPrepared } from '../../prepare/prepare';
import { buildSupplierIndex } from '../../prepare/indexes';
import { formatCAD } from '../../prepare/amounts';
import { href } from '../../lib/url';

const p = await getPrepared();
const rows = buildSupplierIndex(p);
const first = rows.slice(0, 50);
---

<Base
  title="Suppliers"
  description="Browse all suppliers: awards won, bids lost, suspensions, name variants."
>
  <p>
    {rows.length.toLocaleString('en-CA')} suppliers. Award totals sum machine-parseable
    City award amounts only (undercounts) and never merge keyspaces. Filters and
    sorting are reflected in the URL.
  </p>
  <BrowseTable
    client:load
    entity="suppliers"
    indexUrl={href('/indexes/suppliers.json')}
    base={import.meta.env.BASE_URL}
  />
  <noscript>
    <p>
      JavaScript is off — showing the first 50 of {rows.length.toLocaleString('en-CA')}
      rows. Sorting and filtering need JavaScript.
    </p>
    <table>
      <thead>
        <tr><th>Supplier</th><th>Award lines</th><th>Bids</th><th>City awards (parsed)</th></tr>
      </thead>
      <tbody>
        {first.map((r) => (
          <tr>
            <td><a href={href(`/suppliers/${r.g}/`)}>{r.n}</a></td>
            <td>{r.na}</td>
            <td>{r.nb}</td>
            <td>{r.a === null ? '—' : formatCAD(r.a)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </noscript>
</Base>
```

- [ ] **Step 7: Replace the index-page describe blocks in the council and suppliers site tests**

The Task 16/17 index pages no longer exist, so their index-page tests (no-island, year-`h2`s, per-item visible links, the `"N supplier profiles"` literal, the `/search/` link) must be replaced. The record-page describes in both files are untouched.

In `tests/site/council.test.ts`, replace the entire `describe('/council/ index', ...)` block with:

```ts
describe('/council/ index (island browse page)', () => {
  it('mounts the BrowseTable island pointing at the council index', () => {
    const $ = loadPage('council');
    const island = $('astro-island[client="load"]');
    expect(island.length).toBeGreaterThanOrEqual(1);
    expect(island.attr('props') ?? '').toContain('indexes/council.json');
    expect($('h1').length).toBe(1); // Base renders the only h1
    expect($('body').text()).toContain(
      `${fx.council_items.length.toLocaleString('en-CA')} council items`,
    );
  });

  it('renders a noscript first-50 static table linking council items', () => {
    const raw = readFileSync('dist/council/index.html', 'utf8');
    const noscripts = raw.match(/<noscript>[\s\S]*?<\/noscript>/g)?.join('') ?? '';
    expect(noscripts).toContain('<table');
    // buildCouncilIndex preserves doc order, so the noscript table shows the
    // first 50 council items; the fixture has fewer than 50.
    for (const ci of fx.council_items.slice(0, 50)) {
      expect(noscripts).toContain(`/council/${ci.reference}/`);
    }
  });
});
```

In `tests/site/suppliers.test.ts`, replace the entire `describe('/suppliers/ index', ...)` block with:

```ts
describe('/suppliers/ index (island browse page)', () => {
  it('mounts the BrowseTable island pointing at the suppliers index', () => {
    const $ = loadPage('suppliers');
    const island = $('astro-island[client="load"]');
    expect(island.length).toBeGreaterThanOrEqual(1);
    expect(island.attr('props') ?? '').toContain('indexes/suppliers.json');
    expect($('h1').length).toBe(1); // Base renders the only h1
    expect($('body').text()).toContain(
      `${fx.suppliers.length.toLocaleString('en-CA')} suppliers`,
    );
    expect($('body').text()).toContain('undercount');
  });

  it('renders a noscript first-50 static table linking supplier profiles', () => {
    const raw = readFileSync('dist/suppliers/index.html', 'utf8');
    const noscripts = raw.match(/<noscript>[\s\S]*?<\/noscript>/g)?.join('') ?? '';
    expect(noscripts).toContain('<table');
    // buildSupplierIndex sorts by display_name (en-CA), tiebreak slug — mirror it.
    const first = fx.suppliers
      .map((s) => ({ n: s.display_name, g: supplierSlug(s.supplier_key) }))
      .sort((a, b) => a.n.localeCompare(b.n, 'en-CA') || a.g.localeCompare(b.g, 'en-CA'))
      .slice(0, 50);
    for (const s of first) {
      expect(noscripts).toContain(`/suppliers/${s.g}/`);
    }
  });
});
```

Both replacements use only imports/fixtures already present at the top of each file (`loadPage`, `readFileSync`, `fx`, and — in suppliers — `supplierSlug`).

- [ ] **Step 8: Rebuild and run the browse tests to verify they pass**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build
npx vitest run -c vitest.site.config.ts tests/site/browse.test.ts
```

Expected: build succeeds (the build output lists `/indexes/solicitations.json` etc. among generated routes), then PASS — `Test Files  1 passed (1)`, 13 tests passed.

- [ ] **Step 9: Run the full suites to catch regressions**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
npx vitest run
npx vitest run -c vitest.site.config.ts
```

Expected: PASS on both — all unit tests, and all site tests including Tasks 13-18's files against the dist built in Step 8 (`council.test.ts` and `suppliers.test.ts` now assert the island index pages via the Step 7 replacements).

- [ ] **Step 10: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/islands/BrowseTable.tsx src/pages/indexes src/pages/solicitations/index.astro src/pages/noncompetitive/index.astro src/pages/council/index.astro src/pages/suppliers/index.astro tests/site/browse.test.ts tests/site/council.test.ts tests/site/suppliers.test.ts
git commit -m "feat: BrowseTable island, JSON browse indexes, browse pages with noscript fallback"
```

### Task 20: Pagefind search page (`/search/`) with `?q=` carry-over

Note: the build script has been the chained `astro build && pagefind --site dist` since Task 1 Step 1 (Task 1 Step 6 verified Pagefind logging `Indexed 1 page`). This task does NOT touch `package.json` — it creates the search page, carries `?q=` from the home/404 search forms into PagefindUI, and verifies the indexing attributes on the built output.

**Files:**
- Create: `src/pages/search.astro`
- Test: `tests/site/search.test.ts`

**Interfaces:**
- Consumes: `Base.astro` pagefind props `{ pagefind?: boolean; filters?: Record<string, string> }` (Task 13 — record pages from Tasks 14-18 already set `pagefind: true` and pass filters from the key set `type`/`status`/`year`/`buyer`; this task only verifies the built output); the chained build script `astro build && pagefind --site dist` (in place since Task 1 — verified, not modified, here); `/indexes/solicitations.json` and `/indexes/suppliers.json` in `dist/` (Task 19, used by the tests to discover a record slug); `href(path: string): string` (Task 13); `pagefind ^1` devDependency (Task 1).
- Produces: `/search/` page with PagefindUI, `?q=` carry-over from the home and 404 search forms, a dev fallback note, and a noscript pointer to the browse pages. The page documents the search filter keys `type`, `status`, `year`, `buyer`. (No slot `<h1>` — Base renders the only h1 from `title`.)

- [ ] **Step 1: Write the failing test**

Create `tests/site/search.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPage } from './helpers';

function firstIndexRow(file: string): Record<string, any> {
  return JSON.parse(readFileSync(join('dist', 'indexes', file), 'utf8'))[0];
}

describe('build chaining (created in Task 1, verified here)', () => {
  it('pagefind ran after astro build and emitted its UI bundle', () => {
    expect(existsSync(join('dist', 'pagefind', 'pagefind-ui.js'))).toBe(true);
    expect(existsSync(join('dist', 'pagefind', 'pagefind-ui.css'))).toBe(true);
  });
});

describe('search page', () => {
  it('has the PagefindUI mount, a hidden dev fallback, and a noscript pointer to browse pages', () => {
    const $ = loadPage('search');
    expect($('#search').length).toBe(1);
    expect($('#search-fallback[hidden]').length).toBe(1);
    const raw = readFileSync(join('dist', 'search', 'index.html'), 'utf8');
    expect(raw).toContain('<noscript>');
    expect(raw).toContain('solicitations/');
  });

  it('carries ?q= from the home/404 search forms into the Pagefind input', () => {
    // The page script (inlined or bundled to a file by Astro) must read ?q=
    // and feed it to PagefindUI's input. Both markers survive esbuild
    // minification: one is a global identifier, the other a string literal.
    const $ = loadPage('search');
    let scriptText = $('script:not([src])').text();
    $('script[src]').each((_, el) => {
      const src = ($(el).attr('src') ?? '').replace(/^\//, '');
      const file = join('dist', src);
      if (existsSync(file)) scriptText += readFileSync(file, 'utf8');
    });
    expect(scriptText).toContain('URLSearchParams');
    expect(scriptText).toContain('pagefind-ui__search-input');
  });
});

describe('pagefind indexing attributes', () => {
  it('solicitation record pages carry data-pagefind-body, meta title, and a type filter', () => {
    const d = firstIndexRow('solicitations.json').d as string;
    const $ = loadPage(`solicitations/${d}`);
    expect($('[data-pagefind-body]').length).toBe(1);
    expect($('[data-pagefind-meta="title"]').length).toBe(1);
    expect($('[data-pagefind-filter="type"]').text()).toBe('Solicitation');
  });

  it('supplier record pages carry data-pagefind-body', () => {
    const g = firstIndexRow('suppliers.json').g as string;
    const $ = loadPage(`suppliers/${g}`);
    expect($('[data-pagefind-body]').length).toBe(1);
  });

  it('browse and utility pages do not carry data-pagefind-body', () => {
    for (const p of ['', 'search', 'solicitations', 'suppliers', 'noncompetitive', 'council']) {
      const $ = loadPage(p);
      expect($('[data-pagefind-body]').length, `/${p}/ should not be indexed`).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build
npx vitest run -c vitest.site.config.ts tests/site/search.test.ts
```

Expected: build succeeds (including the Pagefind pass — the bundle already exists because Task 1 chained `pagefind --site dist` into `npm run build`), then a PARTIAL fail. Passing already: the build-chaining test and the two record-page attribute tests (Tasks 14/17 set `pagefind: true`). Failing: the two search-page tests error with `ENOENT: no such file or directory, open 'dist/search/index.html'`, and the browse/utility indexing test errors with the same ENOENT (its page loop includes `'search'`).

- [ ] **Step 3: Verify the build chain (no edit — Task 1 owns it)**

Do NOT modify `package.json`. Confirm the chain is already in place — run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
node -p "require('./package.json').scripts.build"
```

Expected output: `astro build && pagefind --site dist`

If it prints anything else, stop and fix Task 1's `package.json` first — Task 22's deploy workflow relies on the chained script.

- [ ] **Step 4: Create the search page**

Create `src/pages/search.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import { href } from '../lib/url';
---

<Base
  title="Search"
  description="Full-text search over every record in the Toronto Bids Archive."
>
  <p>
    Searches titles, descriptions, supplier names and variants, council decision text,
    and every document filename. Identifiers (document numbers, workspace numbers,
    call numbers, council references) match verbatim. Filter results by record type,
    status, year, and buyer.
  </p>
  <div id="search"></div>
  <p id="search-fallback" hidden>
    The search index is missing from this build (it is generated by the production
    build step, not by <code>astro dev</code>). Use the browse pages instead:
    <a href={href('/solicitations/')}>solicitations</a>,
    <a href={href('/noncompetitive/')}>non-competitive contracts</a>,
    <a href={href('/council/')}>council items</a>,
    <a href={href('/suppliers/')}>suppliers</a>.
  </p>
  <noscript>
    <p>
      Search requires JavaScript. With JavaScript off, use the browse pages instead:
      <a href={href('/solicitations/')}>solicitations</a>,
      <a href={href('/noncompetitive/')}>non-competitive contracts</a>,
      <a href={href('/council/')}>council items</a>,
      <a href={href('/suppliers/')}>suppliers</a>.
    </p>
  </noscript>
  <link rel="stylesheet" href={href('/pagefind/pagefind-ui.css')} />
  <script>
    // The pagefind bundle exists only after `pagefind --site dist` has run
    // (production build — chained since Task 1). In `astro dev` it 404s: show
    // the fallback note.
    type PagefindUIConstructor = new (opts: { element: string; showSubResults: boolean }) => unknown;
    const base = import.meta.env.BASE_URL;
    const join = (p: string) => (base.endsWith('/') ? base : base + '/') + p.replace(/^\//, '');
    const script = document.createElement('script');
    script.src = join('pagefind/pagefind-ui.js');
    script.onload = () => {
      const { PagefindUI } = window as unknown as { PagefindUI: PagefindUIConstructor };
      new PagefindUI({ element: '#search', showSubResults: true });
      // Carry ?q= from the home/404 search forms into the Pagefind input.
      // PagefindUI builds its DOM asynchronously, so retry briefly until the
      // input exists.
      const q = new URLSearchParams(location.search).get('q');
      if (q) {
        let tries = 0;
        const fill = () => {
          const input = document.querySelector('.pagefind-ui__search-input');
          if (input instanceof HTMLInputElement) {
            input.value = q;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (tries++ < 50) {
            requestAnimationFrame(fill);
          }
        };
        fill();
      }
    };
    script.onerror = () => {
      document.getElementById('search-fallback')?.removeAttribute('hidden');
    };
    document.head.append(script);
  </script>
</Base>
```

- [ ] **Step 5: Rebuild and verify the tests pass**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build
npx vitest run -c vitest.site.config.ts tests/site/search.test.ts
```

Expected: the build output ends with a Pagefind summary (`Running Pagefind v1.x`, `Indexed <n> pages` where n > 0 — the fixture's record pages, and only those, carry `data-pagefind-body`), then PASS — `Test Files  1 passed (1)`, 6 tests passed.

- [ ] **Step 6: Run the full site suite to catch regressions**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
npx vitest run -c vitest.site.config.ts
```

Expected: PASS — all site test files, including Task 19's browse tests, against the build from Step 5.

- [ ] **Step 7: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/pages/search.astro tests/site/search.test.ts
git commit -m "feat: Pagefind search page with ?q= carry-over"
```

### Task 21: `/data/` page + internal-link crawl / page-count site test

**Files:**
- Create: `src/pages/data.astro`
- Create: `tests/site/links.test.ts`
- Test: `tests/site/data.test.ts`

**Interfaces:**
- Consumes: `getPrepared(): Promise<Prepared>` (Task 10) — uses `p.generatedAt`, `p.doc.meta.sources: SyncSource[]`, and the `p.doc.unlinked_ariba_postings` / `p.doc.unlinked_awards` / `p.doc.unlinked_bids` buckets (types from Task 2); `Base.astro` (Task 13, whose footer on every page already links to `/data/` — this task creates that link's target; Base renders the only `<h1>`); `loadPage`, `loadFile`, `loadFixture` (Task 13); `dist/counts.json` (Task 13 — `links.test.ts` derives its page-count expectations from it); `cheerio` (already a dependency via the site-test harness). Download URLs and the Datasette-Lite URL point at the `toronto-bids-data` releases created by backend issue #146 (links render regardless; they 404 until #146 lands).
- Produces: `/data/` page with download links, Datasette-Lite link, the seven documented schema gotchas, sync-status table, an **Unlinked records** section (every `unlinked_*` bucket rendered with explicit "not linked to any solicitation" copy — nothing silently dropped), and citation guidance. Also `tests/site/links.test.ts` — the zero-broken-internal-links crawl plus page-count assertions, satisfying the spec's "zero broken internal links" and page-count testing requirements. It is deliberately data-independent (expectations derive from `dist/` and `dist/counts.json`, never from the fixture) so Task 22 runs exactly this file against the full-data build: `npx vitest run -c vitest.site.config.ts tests/site/links.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/site/data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadFixture, loadPage } from './helpers';

const DATASETTE =
  'https://lite.datasette.io/?url=https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/bids.sqlite';
const LATEST = 'https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest';

describe('/data/ page', () => {
  it('links the latest release assets and Datasette-Lite', () => {
    const $ = loadPage('data');
    expect($(`a[href="${DATASETTE}"]`).length).toBe(1);
    for (const asset of ['bids.json', 'bids.json.gz', 'bids.sqlite']) {
      expect($(`a[href="${LATEST}/${asset}"]`).length, asset).toBe(1);
    }
  });

  it('documents every schema gotcha as a heading', () => {
    const $ = loadPage('data');
    const headings = $('h2, h3')
      .map((_, el) => $(el).text())
      .get()
      .join(' | ');
    expect(headings).toContain('Five disjoint keyspaces');
    expect(headings).toContain('Three amount tiers');
    expect(headings).toContain('dedupe');
    expect(headings).toContain('HST basis');
    expect(headings).toContain('no title');
    expect(headings).toContain('$15');
    expect(headings).toContain('supplier_id');
  });

  it('renders the sync-status table from meta.sources', () => {
    const $ = loadPage('data');
    const headers = $('table thead th')
      .map((_, el) => $(el).text())
      .get();
    expect(headers).toContain('Source');
    expect(headers).toContain('Rows fetched');
    expect($('table tbody tr').length).toBeGreaterThan(0);
  });

  it('renders every unlinked bucket in the Unlinked records section', () => {
    const $ = loadPage('data');
    const fx = loadFixture();
    const text = $('body').text();
    expect(text).toContain('not linked to any solicitation');
    // Counts derive from the fixture, so this test also holds if the fixture
    // gains unlinked awards/bids later.
    expect(text).toContain(
      `Unlinked Ariba postings (${fx.unlinked_ariba_postings.length})`,
    );
    expect(text).toContain(`Unlinked award lines (${fx.unlinked_awards.length})`);
    expect(text).toContain(`Unlinked bids (${fx.unlinked_bids.length})`);
    for (const posting of fx.unlinked_ariba_postings) {
      expect(text, `missing unlinked posting ${posting.rfx_id}`).toContain(
        posting.rfx_id,
      );
    }
  });

  it('gives citation guidance and stays out of the search index', () => {
    const $ = loadPage('data');
    expect($('h2:contains("Citing")').length).toBe(1);
    expect($('body').text()).toContain('snapshot-YYYY-MM-DD');
    expect($('[data-pagefind-body]').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build
npx vitest run -c vitest.site.config.ts tests/site/data.test.ts
```

Expected: build succeeds, then FAIL — every test errors with `ENOENT: no such file or directory, open 'dist/data/index.html'`.

- [ ] **Step 3: Create the data page**

Create `src/pages/data.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import { getPrepared } from '../prepare/prepare';

const p = await getPrepared();
const RELEASES = 'https://github.com/CivicTechTO/toronto-bids-data/releases';
const LATEST = `${RELEASES}/download/latest`;
const DATASETTE =
  'https://lite.datasette.io/?url=https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/bids.sqlite';
---

<Base
  title="Data"
  description="Download the Toronto Bids Archive dataset, query it in the browser, and read the schema rules before aggregating."
>
  <p>
    Everything on this site is built from one nightly export of the
    <a href="https://github.com/CivicTechTO/toronto-bids">Toronto Bids Archive</a>.
    Data as of {p.generatedAt}.
  </p>

  <h2>Downloads</h2>
  <ul>
    <li>
      <a href={`${LATEST}/bids.json`}>bids.json</a> — the full export, compact JSON
      (~24&nbsp;MB; exact sizes on the release page)
    </li>
    <li><a href={`${LATEST}/bids.json.gz`}>bids.json.gz</a> — the same, gzipped</li>
    <li><a href={`${LATEST}/bids.sqlite`}>bids.sqlite</a> — SQLite database</li>
  </ul>
  <p>
    The <code>latest</code> release is replaced nightly (generated at ~05:30
    America/Toronto). On the 1st of each month a dated
    <code>snapshot-YYYY-MM-DD</code> release is kept for point-in-time citation — see
    <a href={RELEASES}>all releases</a>.
  </p>

  <h2>Query in your browser</h2>
  <p>
    <a href={DATASETTE}>Open bids.sqlite in Datasette-Lite</a> — full SQL against the
    latest database with nothing to install (your browser downloads the whole
    database).
  </p>

  <h2>Reading the data honestly</h2>
  <p>
    The export is faithful to what the City published — including its errors. Before
    aggregating anything, read these rules.
  </p>

  <h3>Five disjoint keyspaces</h3>
  <p>
    Records live in five identifier spaces that never join: 10-digit
    <code>document_number</code> (competitive solicitations),
    <code>workspace_number</code> (non-competitive contracts),
    <code>call_number</code> (2009–2012 composite awards), council
    <code>reference</code> (<code>YYYY.CCNN.N</code>), and
    <code>(buyer, native_ref)</code> (agency records). Never present a cross-keyspace
    total as one number. The only bridges that exist: bid <code>reference</code> ↔
    council item, bid <code>document_number</code> ↔ solicitation,
    <code>supplier_id</code> across award/bid tables, and suspended-firm
    <code>council_authority</code> ↔ council item.
  </p>

  <h3>Three amount tiers</h3>
  <p>
    Every money field comes in tiers: the raw TEXT verbatim
    (<code>award_amount</code>, <code>bid_price</code>, <code>contract_amount</code>,
    <code>award_value</code> — may contain <code>"kj"</code>,
    <code>"31.65/MT"</code> or <code>"Non-Compliant"</code>); the machine-parsed
    <code>*_numeric</code> column, the only tier safe to sum; and human-labelled
    <code>*_labelled</code>/<code>*_verdict</code>. All totals on this site sum
    <code>*_numeric</code> only, exclude rows with verdict
    <code>not_an_award</code>, and are therefore machine-parseable undercounts.
  </p>

  <h3>One award, two sources (the dedupe rule)</h3>
  <p>
    Award rows are dual-provenance: the same award appears once per source
    (<code>odata</code>: 7,519 rows; <code>ckan_awarded</code>: 7,512). Display and
    aggregate the <code>odata</code> rows and treat CKAN presence as a cross-check.
    Never dedupe by (document, supplier): one row is one award <em>line</em>, and
    standing-offer call-ups legitimately repeat suppliers.
  </p>

  <h3>Bid prices carry an HST basis</h3>
  <p>
    <code>hst_basis</code> is load-bearing: roughly 10,000 bid prices include HST and
    5,400 exclude it. Never compare or sum prices across bases; every price on this
    site is displayed with its basis.
  </p>

  <h3>A null title means the City published no title</h3>
  <p>
    3,464 of 7,444 solicitations (46.5%) have <code>title IS NULL</code>. This site
    renders them as "Doc 3524228095 — RFQ, Transportation Services" with an explicit
    "no title published" marker. Where a title was recovered from another source
    (<code>title_source</code> non-null: council agendas, legacy Ariba HTML) a
    provenance badge says so.
  </p>

  <h3>Three implausible awards (~$15B)</h3>
  <p>
    Totals are faithful, not trustworthy: three City-published award amounts are
    implausible (about $15&nbsp;billion combined, including a $9.05&nbsp;billion award
    to an individual). Headline sums on this site carry this caveat; do your own
    outlier handling before publishing aggregates. Future-dated rows also exist
    (<code>contract_date</code> up to 2026-12-18).
  </p>

  <h3>supplier_id is not stable</h3>
  <p>
    The supplier dimension is rebuilt nightly, so <code>supplier_id</code> changes
    across exports — it is a within-export join key only. For stable identity use
    <code>supplier_key</code> (this site's supplier URLs slug it). Never store
    <code>supplier_id</code> across snapshots.
  </p>

  <h2>Sync status</h2>
  <p>Per-source status from the most recent nightly sync (<code>meta.sources</code>).</p>
  <table>
    <thead>
      <tr>
        <th>Source</th><th>Status</th><th>Finished</th><th>Rows fetched</th>
        <th>Rows upserted</th>
      </tr>
    </thead>
    <tbody>
      {p.doc.meta.sources.map((s) => (
        <tr>
          <td>{s.source}</td>
          <td>{s.status}</td>
          <td>{s.finished_at ?? '—'}</td>
          <td>{s.rows_fetched.toLocaleString('en-CA')}</td>
          <td>{s.rows_upserted.toLocaleString('en-CA')}</td>
        </tr>
      ))}
    </tbody>
  </table>

  <h2>Unlinked records</h2>
  <p>
    The export's <code>unlinked_*</code> buckets hold rows that are
    <strong>not linked to any solicitation</strong> record. Nothing is silently
    dropped — they are listed here in full.
  </p>

  <h3>Unlinked Ariba postings ({p.doc.unlinked_ariba_postings.length})</h3>
  {p.doc.unlinked_ariba_postings.length > 0 ? (
    <table>
      <thead>
        <tr><th>RFx ID</th><th>Title</th><th>Posted</th><th>Closes</th><th>Link</th></tr>
      </thead>
      <tbody>
        {p.doc.unlinked_ariba_postings.map((a) => (
          <tr>
            <td>{a.rfx_id}</td>
            <td>{a.title ?? '—'}</td>
            <td>{a.posted_date ?? '—'}</td>
            <td>{a.close_date ?? '—'}</td>
            <td>
              {a.public_posting_url ? (
                <a href={a.public_posting_url} rel="noopener">Ariba posting</a>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p>None in this export.</p>
  )}

  <h3>Unlinked award lines ({p.doc.unlinked_awards.length})</h3>
  {p.doc.unlinked_awards.length > 0 ? (
    <table>
      <thead>
        <tr><th>Document #</th><th>Supplier</th><th>Amount (raw)</th><th>Date</th></tr>
      </thead>
      <tbody>
        {p.doc.unlinked_awards.map((a) => (
          <tr>
            <td>{a.document_number}</td>
            <td>{a.supplier_name_raw ?? '—'}</td>
            <td>{a.award_amount ?? '—'}</td>
            <td>{a.award_date ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p>None in this export.</p>
  )}

  <h3>Unlinked bids ({p.doc.unlinked_bids.length})</h3>
  {p.doc.unlinked_bids.length > 0 ? (
    <table>
      <thead>
        <tr><th>Document #</th><th>Bidder</th><th>Bid price (raw)</th><th>HST basis</th></tr>
      </thead>
      <tbody>
        {p.doc.unlinked_bids.map((b) => (
          <tr>
            <td>{b.document_number ?? '—'}</td>
            <td>{b.bidder_name_raw}</td>
            <td>{b.bid_price ?? '—'}</td>
            <td>{b.hst_basis ?? 'unknown'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p>None in this export.</p>
  )}

  <h2>Citing this archive</h2>
  <p>
    For reproducible citations, cite a dated monthly snapshot
    (<code>snapshot-YYYY-MM-DD</code>) rather than <code>latest</code> — the
    <code>latest</code> assets change nightly — and include the permanent record URL
    from this site plus the <code>generated_at</code> timestamp shown in every page
    footer.
  </p>
</Base>
```

- [ ] **Step 4: Rebuild and verify the tests pass**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build
npx vitest run -c vitest.site.config.ts tests/site/data.test.ts
```

Expected: build succeeds (route `/data/` now generated), then PASS — `Test Files  1 passed (1)`, 5 tests passed.

- [ ] **Step 5: Create the internal-link crawl + page-count test**

This is the spec's "zero broken internal links" and page-count check. It is an invariant test, not a feature, so there is no red-first cycle: if it fails, the failures are real broken links or missing pages from earlier tasks — fix those before proceeding. It is deliberately data-independent (page counts derive from `dist/counts.json`, which under the fixture build equals the fixture's entity array lengths); Task 22 runs exactly this file against the full-data build.

Create `tests/site/links.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { loadFile } from './helpers';

// Data-independent invariants: run against ANY dist (fixture or full data).
// Task 22's full-data verification runs exactly this file:
//   npx vitest run -c vitest.site.config.ts tests/site/links.test.ts

function walkHtml(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

const EXTERNAL = /^(https?:|mailto:|tel:)/;

describe('internal links', () => {
  it('every internal a[href] in dist resolves to a built file', () => {
    const pages = walkHtml('dist');
    expect(pages.length).toBeGreaterThan(0);
    const broken: string[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      const $ = load(readFileSync(page, 'utf8'));
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        // Internal = starts with '/' after the base (site tests build with
        // BASE_PATH=/). Skip external protocols, fragments, and Pagefind's
        // runtime-generated assets.
        if (EXTERNAL.test(href) || href.startsWith('#') || !href.startsWith('/')) return;
        const path = href.split(/[?#]/)[0];
        if (path.startsWith('/pagefind/')) return;
        if (seen.has(path)) return; // check each target once
        seen.add(path);
        const rel = path.replace(/^\//, '');
        const file = join('dist', rel === '' ? 'index.html' : rel);
        const ok =
          (existsSync(file) && statSync(file).isFile()) ||
          existsSync(join(file, 'index.html'));
        if (!ok) broken.push(`${page} -> ${href}`);
      });
    }
    expect(broken, `broken internal links:\n${broken.join('\n')}`).toEqual([]);
  });
});

describe('page counts', () => {
  // counts.json is countsOf() of the export THIS dist was built from, so these
  // assertions hold for the fixture build AND the full-data build. Under the
  // fixture build, counts.solicitations === fixture solicitations.length and
  // counts.suppliers === fixture suppliers.length.
  const counts = JSON.parse(loadFile('counts.json')) as Record<string, number>;

  function recordDirs(entity: string): number {
    return readdirSync(join('dist', entity)).filter((e) =>
      statSync(join('dist', entity, e)).isDirectory(),
    ).length;
  }

  it('builds one record page per solicitation', () => {
    expect(recordDirs('solicitations')).toBe(counts.solicitations);
  });

  it('builds one record page per supplier', () => {
    expect(recordDirs('suppliers')).toBe(counts.suppliers);
  });
});
```

- [ ] **Step 6: Run the link crawl against the fixture build**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
npx vitest run -c vitest.site.config.ts tests/site/links.test.ts
```

Expected: PASS — `Test Files  1 passed (1)`, 3 tests passed: zero broken internal links across every page in `dist/`, and one record directory per fixture solicitation and per fixture supplier. If the crawl lists broken links, those are real bugs in earlier page tasks (a dead href or a missing page) — fix the page, rebuild, and rerun; do not weaken the test.

- [ ] **Step 7: Run the full site suite to catch regressions**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
npx vitest run -c vitest.site.config.ts
```

Expected: PASS — all site test files. (This also clears the footer's `/data/` link, which until this task pointed at a missing page.)

- [ ] **Step 8: Commit**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add src/pages/data.astro tests/site/data.test.ts tests/site/links.test.ts
git commit -m "feat: /data/ page with downloads, schema gotchas, unlinked records; internal-link crawl test"
```

### Task 22: `deploy.yml` + repo/Pages manual setup + README + full-data verification checklist

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: `scripts/fetch-data.ts` (Task 12 — skips download when `TB_DATA_FILE` is set, else streams `TB_DATA_URL` to `.data/bids.json`); `scripts/check-shrink.ts` (Task 11 — `validateExport` + `countsOf` + `checkShrink` against `.data/previous-counts.json`, exit 1 on violations; reads `.data/bids.json`); the `counts.json` endpoint on the live site (Task 13); the chained `npm run build` (Task 1, verified in Task 20); `tests/site/links.test.ts` (Task 21 — the data-independent internal-link crawl + page-count checks; the ONLY site-test file run against the full-data build, because every other site-test file is fixture-coupled and runs in CI against the fixture build only). **Depends on backend issue #146** (the `toronto-bids-data` `latest` release assets and plexbox's `gh workflow run deploy.yml -R CivicTechTO/toronto-bids-frontend` trigger) — the deploy cannot succeed before it lands.
- Produces: `.github/workflows/deploy.yml` (nightly-dispatch + cron + manual → fetch → shrink guard → build → Pages); `README.md`; a verified live site at `https://civictechto.github.io/toronto-bids-frontend/`.

- [ ] **Step 1: Write the deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  workflow_dispatch:
  schedule:
    - cron: '30 10 * * *'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

env:
  SITE_URL: https://civictechto.github.io
  BASE_PATH: /toronto-bids-frontend
  TB_DATA_URL: https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/bids.json

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Fetch latest export
        run: node scripts/fetch-data.ts
      - name: Fetch previous deploy's entity counts
        run: |
          curl -fsSL "$SITE_URL$BASE_PATH/counts.json" -o .data/previous-counts.json \
            || echo "no previous counts (first deploy?)"
      - name: Guard against archive shrink
        run: node scripts/check-shrink.ts
      - name: Build site (Astro + Pagefind)
        run: npm run build
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify the workflow parses**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
npx --yes js-yaml .github/workflows/deploy.yml > /dev/null && echo "deploy.yml parses"
grep -c "fetch-data\|check-shrink\|upload-pages-artifact\|deploy-pages" .github/workflows/deploy.yml
```

Expected: `deploy.yml parses`, then `4` (all four load-bearing steps present).

- [ ] **Step 3: Commit the workflow**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: nightly deploy workflow with shrink guard and Pages publish"
```

- [ ] **Step 4: Write the README**

Create `README.md`:

````markdown
# Toronto Bids Archive — frontend

Static research site over the [Toronto Bids Archive](https://github.com/CivicTechTO/toronto-bids):
City of Toronto procurement (solicitations, awards, bids including losing bidders,
non-competitive contracts, council decisions, suppliers) with stable, citable URLs.
Built with Astro 5 + React islands + Tailwind 4, searched by Pagefind, hosted on
GitHub Pages. Roughly 24,000 pages are generated from one nightly JSON export.

- Live site: https://civictechto.github.io/toronto-bids-frontend/
- Data releases: https://github.com/CivicTechTO/toronto-bids-data/releases
- Design spec: `docs/superpowers/specs/2026-07-18-frontend-design.md`

## How a build works

1. `scripts/fetch-data.ts` downloads `bids.json` from the `latest` data release into
   `.data/bids.json` (skipped when `TB_DATA_FILE` is set).
2. `scripts/check-shrink.ts` validates the export shape and fails the build if any
   major entity count dropped more than 20% vs the previous deploy's `counts.json`.
3. `src/prepare/` (pure TypeScript, fully unit-tested) applies the archive's data
   rules: award dedupe, display titles, supplier slugs, rollups, browse indexes.
4. `npm run build` = `astro build && pagefind --site dist`.
5. `.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages. A failed build
   leaves the last good site up; the archive never silently shrinks.

## Local development

Requires Node >= 24 (scripts are plain `.ts`, run directly via type stripping) and npm.

```bash
npm ci

# Fast loop against the committed fixture (a few dozen records):
TB_DATA_FILE=tests/fixtures/bids.fixture.json npm run dev

# Full data (~24 MB export; builds ~24k pages):
node scripts/fetch-data.ts     # -> .data/bids.json (the default data path)
npm run dev
```

`getPrepared()` reads `process.env.TB_DATA_FILE ?? '.data/bids.json'`, so every
command (dev, build, scripts) honours the same variable.

## Tests

```bash
# Unit tests for the prepare step:
npx vitest run

# Site tests (post-build HTML assertions over dist/):
TB_DATA_FILE=tests/fixtures/bids.fixture.json BASE_PATH=/ npm run build
npx vitest run -c vitest.site.config.ts
```

CI (`.github/workflows/ci.yml`) runs both on every push and pull request.

## Production build

```bash
BASE_PATH=/ npm run build   # local: site served from /
npm run build               # deploy default: BASE_PATH=/toronto-bids-frontend
```

## Deployment

`.github/workflows/deploy.yml` runs on a daily schedule (10:30 UTC), on manual
dispatch, and when plexbox triggers it after `tb nightly` publishes fresh release
assets (backend issue #146). It refuses to deploy when the export is malformed or
the archive shrank >20% — see `scripts/check-shrink.ts`. On the very first deploy
the guard logs `no previous counts (first deploy?)` and passes; every later deploy
compares against the live site's `counts.json`.

## Data rules

The site enforces the archive's load-bearing rules: award dedupe (odata rows win),
three amount tiers (only `*_numeric` is summed, labelled as undercounts), five
disjoint keyspaces that never join, `hst_basis` shown with every bid price,
null-title semantics, and `supplier_key`-slugged supplier permalinks. They are
documented for readers on the live `/data/` page and in the design spec.
````

- [ ] **Step 5: Verify and commit the README**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
grep -c "TB_DATA_FILE" README.md
git add README.md
git commit -m "docs: README with local dev, testing, and deploy workflow"
```

Expected: grep prints `3` or more (the TB_DATA_FILE workflow is documented), then a clean commit.

- [ ] **Step 6: One-time GitHub setup (manual checklist — needs repo admin on CivicTechTO and backend issue #146 landed)**

Nothing to commit; work through these in order:

1. Confirm the repo is pushed to `CivicTechTO/toronto-bids-frontend` and public. Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`: `git remote -v` — Expected: `origin` pointing at `CivicTechTO/toronto-bids-frontend`. Push `main` if not yet pushed. The repo NAME must stay `toronto-bids-frontend` — it is baked into `BASE_PATH`.
2. Enable Pages via Actions: on GitHub, Settings → Pages → Build and deployment → Source: **GitHub Actions**. (CLI alternative: `gh api -X POST repos/CivicTechTO/toronto-bids-frontend/pages -f build_type=workflow` — Expected: JSON response containing `"build_type":"workflow"`; if Pages already exists, use `-X PUT` instead.)
3. Repo variables/secrets: none required for v1. `SITE_URL`, `BASE_PATH`, and `TB_DATA_URL` are hard-coded in `deploy.yml`'s `env:` block, and the automatic `GITHUB_TOKEN` covers Pages. (Optional later: a `SLACK_WEBHOOK` secret for failure notifications — an open item in the spec.)
4. Verify backend #146 is live before the first deploy: `curl -fsIL https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/bids.json | head -n 1` — Expected: `HTTP/2 200`. If this 404s, stop: `deploy.yml` will fail at the fetch step.
5. Note the nightly trigger path (backend side, informational): after `tb nightly` uploads the release assets, plexbox runs `gh workflow run deploy.yml -R CivicTechTO/toronto-bids-frontend` using the token in `~/.config/toronto-bids/tb.env`.
6. First-deploy expectation: the "Fetch previous deploy's entity counts" step will print `no previous counts (first deploy?)` because the site (and its `counts.json`) does not exist yet; `check-shrink` then runs with a null baseline and reports no violations. This is expected, not an error — the shrink guard arms itself from the second deploy onward.

- [ ] **Step 7: Full-data verification — regenerate a real export locally**

Regenerate the export from the local backend (this works today, before #146). `TB_DATA_DIR` is unset on this machine, so the backend's config defaults its data dir to `<backend>/scrapers/files` and `tb export` writes `scrapers/files/export/bids.json`:

```bash
cd /Users/alex/code/projects/toronto-bids/toronto-bids/scrapers && uv run tb export
ls -lh /Users/alex/code/projects/toronto-bids/toronto-bids/scrapers/files/export/bids.json
```

Expected: `files/export/bids.json` present, roughly 24 MB. (Alternative, only after backend #146 lands: run `node scripts/fetch-data.ts` in the frontend repo to download the `latest` release asset to `.data/bids.json`, and drop the `TB_DATA_FILE` override in Step 9.)

- [ ] **Step 8: Run the shrink guard against the real export**

`scripts/check-shrink.ts` reads `.data/bids.json` (fixed path), so copy the fresh export there first. Run:

```bash
mkdir -p /Users/alex/code/projects/toronto-bids/toronto-bids-frontend/.data
cp /Users/alex/code/projects/toronto-bids/toronto-bids/scrapers/files/export/bids.json /Users/alex/code/projects/toronto-bids/toronto-bids-frontend/.data/bids.json
cd /Users/alex/code/projects/toronto-bids/toronto-bids-frontend && node scripts/check-shrink.ts
```

Expected: exit 0, printing the entity counts — approximately `solicitations 7444`, `awards 15031`, `bids 18632`, `noncompetitive 2856`, `suppliers 7744`, `council_items 4801`, `composite_awards 1052` (slightly higher on a newer export is fine; there is no `.data/previous-counts.json` locally, so no baseline comparison).

- [ ] **Step 9: Full-data build (long-running — hand this to Alex)**

This builds ~24,000 pages plus the Pagefind index. Expect several minutes end to end — roughly 2-5 minutes for the Astro page build on this machine, plus more for Pagefind indexing. Per the global long-running-command rule, do not execute it inline from an agent session — give Alex the exact command to run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend` (or run it in a background shell):

```bash
TB_DATA_FILE=/Users/alex/code/projects/toronto-bids/toronto-bids/scrapers/files/export/bids.json BASE_PATH=/ npm run build
```

Expected: Astro reports ~24,000 pages built; Pagefind reports `Indexed` roughly 23,900 pages (record pages carry `data-pagefind-body`; browse/utility pages do not); exit 0.

- [ ] **Step 10: Spot-check the full-data build (one URL per entity type)**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
ls dist/solicitations | wc -l
node -p "JSON.parse(require('fs').readFileSync('dist/counts.json','utf8'))"
grep -ril "no title published" dist/solicitations --include=index.html | wc -l
```

Expected: `7445` (record folders + the browse page's `index.html` — exactly `counts.solicitations + 1`); the counts object parses and matches Step 8's numbers exactly; roughly `3464` untitled-marker pages (46.5% of solicitations have no published title).

Then verify one built record page per entity type (buyers has no record pages on real data — the export's `buyers` array is empty until agency data lands, so its browse page alone is expected):

```bash
for d in solicitations noncompetitive calls council suppliers buyers capital-projects suspended-firms; do
  first=$(ls "dist/$d" | grep -xv index.html | head -1)
  if [ -n "$first" ]; then p="dist/$d/$first/index.html"; else p="dist/$d/index.html"; fi
  test -f "$p" && echo "OK $p" || echo "MISSING $p"
done
```

Expected: eight `OK` lines, no `MISSING`.

Finally, grep a known supplier page for its display name (derived from the build's own index, so it works on any export):

```bash
node -e "
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('dist/indexes/suppliers.json','utf8'));
const top = rows.find((r) => r.a !== null);
const html = fs.readFileSync('dist/suppliers/' + top.g + '/index.html','utf8');
if (!html.includes(top.n)) { console.error('FAIL: supplier page missing display name'); process.exit(1); }
console.log('supplier spot-check OK:', top.n);
"
```

Expected: `supplier spot-check OK: <a real supplier name>`.

- [ ] **Step 11: Data-independent site checks against the full-data build (link crawl + page counts)**

Run ONLY `tests/site/links.test.ts` — run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend`:

```bash
npx vitest run -c vitest.site.config.ts tests/site/links.test.ts
```

Expected: PASS (the crawl walks all ~24,000 pages, so allow a few minutes) — zero broken internal links against real data, and the page-count assertions hold because they derive from `dist/counts.json`, which now reflects the full export.

Do NOT run the full site suite (`npx vitest run -c vitest.site.config.ts`) against this dist. Every other site-test file is fixture-coupled by design — e.g. `buyers.test.ts` loads the fixture's synthetic `buyers/toronto-zoo-test/` page (real exports have `buyers: []`, so no buyer record pages exist), `tables.test.ts` asserts the fixture's capital-project count, and `base.test.ts` pins the fixture's `generated_at`. Those files run in CI against the fixture build (Task 13's canonical command); failures from running them against full data would be noise, not signal.

- [ ] **Step 12: Manual eyeball via preview (long-running server — hand to Alex)**

Run in `/Users/alex/code/projects/toronto-bids/toronto-bids-frontend` (leave running; Ctrl-C when done):

```bash
BASE_PATH=/ npx astro preview
```

Open `http://localhost:4321/` and verify: home shows labeled City-only headline stats and `Data as of <generated_at>` in the footer; typing a query in the home page's search box and submitting lands on `/search/?q=<term>` with results already loaded (the `?q=` carry-over from Task 20); `/search/` also returns results for a query like `winter` and for a raw document number (Pagefind serves from `dist`); one solicitation record shows raw + numeric amounts side by side, deduped awards (no doubled rows), and `hst_basis` beside every bid price; one supplier page shows per-keyspace totals; `/solicitations/` offers all six facets (status, type, category, division, year, has-documents); `/data/` shows the sync-status table, the Unlinked records section, and the Datasette-Lite link (the link itself only resolves once #146's release exists).

- [ ] **Step 13: First deploy (long-running — hand to Alex; requires Steps 6's checklist complete)**

```bash
gh workflow run deploy.yml -R CivicTechTO/toronto-bids-frontend
gh run watch -R CivicTechTO/toronto-bids-frontend
```

The run takes 10-20 minutes; watch it or check back with `gh run list -R CivicTechTO/toronto-bids-frontend`. Expected: a green run whose "Fetch previous deploy's entity counts" step logs `no previous counts (first deploy?)`. Then verify the live site:

```bash
curl -fsSL https://civictechto.github.io/toronto-bids-frontend/counts.json
```

Expected: the same counts JSON as Step 10, served from GitHub Pages — this is the baseline the next nightly deploy's shrink guard will compare against. Open `https://civictechto.github.io/toronto-bids-frontend/` and confirm the home page renders with the base path intact (browse tables load, search works).
