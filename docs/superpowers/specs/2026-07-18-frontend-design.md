# Toronto Bids Archive — Frontend Design

**Date:** 2026-07-18
**Status:** Approved (brainstorming session with Alex)
**Repo:** `toronto-bids-frontend` (this repo). Backend: [CivicTechTO/toronto-bids](https://github.com/CivicTechTO/toronto-bids).

## Purpose

A public research website over the Toronto Bids Archive: City of Toronto procurement
(solicitations, awards, bids including losers, non-competitive contracts, council
decisions, suppliers), surfaced for **journalists and data scientists** — people doing
real research, not casual browsing. The aim is to surface everything the archive knows
is genuinely public, with stable citable URLs and honest presentation of the data's
limits. Attachments and PDFs are **listed and indexed thoroughly but we serve no file
bytes**; where the City itself hosts a file at a public URL, we link out to it.

**Design philosophy:** lean on pre-built libraries as much as possible — build only
what is genuinely specific to this archive (the data-preparation logic and the record
page templates).

## Decisions made during brainstorming

| Decision | Choice |
|---|---|
| Hosting | Fully static — GitHub Pages. Nothing to keep alive; survives neglect. |
| Architecture | Prebuilt static archive: Astro SSG + Pagefind (Approach A; an SPA was considered and rejected for citability/archivability) |
| Data publishing | In scope: nightly publish of export artifacts to a public URL (new `toronto-bids-data` repo, GitHub release assets) |
| v1 scope | Citable records + search; supplier profiles; downloads + in-browser SQL. Dashboards deferred (headline stats only) |
| Documents | List everything; link out where a City URL exists (Award Summary Forms, staff reports); Ariba attachment files are indexed-not-downloadable |

## The data (what the backend provides)

One nightly JSON export, `bids.json` (~24 MB compact), built by
`build_export_document()` behind the backend's Exporter seam. Top-level keys: `meta`,
`solicitations` (7,444, each with nested `awards`, `ariba_postings`, `documents`),
`noncompetitive` (2,856), `suspended_firms` (3), `suppliers` (7,744),
`capital_projects` (46), `composite_awards` (1,052), `council_items` (4,801, each with
nested `background_pdfs` and `bids` — 18,632 bids including losing bidders),
`unlinked_ariba_postings`, `unlinked_awards`, `buyers` (empty today; agency expansion).
Produced nightly at ~05:30 America/Toronto on the maintainer's server (`plexbox`);
today it stops on that server's disk — publishing it is part of this project.

Note: the on-disk export predating 2026-07-18 lacks `buyers` and the per-solicitation
`documents` array; the first nightly run after the backend's schema migration produces
the current shape. The frontend targets the **current** shape only.

### Load-bearing data rules (from the backend, enforced in our prepare step)

1. **Award dedupe.** Award rows are dual-provenance: the same award appears once per
   source (`odata` 7,519 + `ckan_awarded` 7,512). Display and aggregate the `odata`
   rows; present CKAN presence as a cross-check note, never as extra rows. Never
   dedupe by (document, supplier) — one row is one award **line** and standing-offer
   call-ups legitimately repeat suppliers.
2. **Three amount tiers.** Raw TEXT verbatim (`award_amount`, `bid_price`,
   `contract_amount`, `award_value` — may contain `"kj"`, `"31.65/MT"`,
   `"Non-Compliant"`); machine-parsed `*_numeric` (the only aggregatable tier);
   human-labelled `*_labelled` + `*_verdict`. v1 aggregates `*_numeric` only and
   labels sums as machine-parseable undercounts. Rows with verdict `not_an_award`
   are excluded from aggregates. Record pages show raw and numeric side by side.
3. **Five disjoint keyspaces**, no joins between them: `document_number` (10-digit,
   competitive spine), `workspace_number` (non-competitive), `call_number` (2009–2012
   composite awards), council `reference` (`YYYY.CCNN.N`), and `(buyer, native_ref)`
   (agencies). Cross-keyspace totals are never presented as one number. The bridges
   that DO exist and are used: `bid.reference` ↔ `council_item`, `bid.document_number`
   ↔ `solicitation`, `supplier_id` across all award/bid tables,
   `suspended_firm.council_authority` ↔ `council_item`.
4. **`hst_basis` is load-bearing.** Bid prices split ~10k including-HST vs ~5.4k
   excluding; the basis is displayed with every price and prices are never compared
   across bases.
5. **`title IS NULL` means the City published no title** (3,464 of 7,444, 46.5%).
   Untitled records display as "Doc 3524228095 — RFQ, Transportation Services" with an
   explicit "no title published" marker. When a title was recovered (`title_source`
   non-null: council agendas, legacy Ariba HTML), a provenance badge says so.
6. **Category/division normalization.** `'Goods & Services'` (91) folds into
   `'Goods and Services'` (2,364) for facets; raw value still shown on record pages.
7. **Totals are faithful, not trustworthy.** Three City-published awards are
   implausible (~$15B combined, e.g. $9.05B to an individual); headline sums carry a
   caveat. Future-dated rows exist (`contract_date` max 2026-12-18); time charts clamp.
8. **`supplier_id` is not stable across syncs** (the dimension is rebuilt nightly).
   Supplier permalinks use a slug of the stable normalized `supplier_key`; the
   numeric id is a build-internal join key only. The export does not carry
   `supplier_key` today (only `supplier_id`, `display_name`, `variants`) — adding it
   is a required backend change (see Backend changes below). Slugging `display_name`
   instead would break permalinks whenever a display name shifts as variants accrue.
9. **Headline numbers are City-only** — agency (`buyers`) data is presented in its own
   per-buyer section with `partnered`/`funding_share` badges, mirroring the export's
   own contract. `value_confidential=1` renders as "value withheld (confidential
   attachment)", distinct from missing.

## Architecture

Three pieces: a data publisher (backend/deploy side), a static site builder (this
repo), static hosting.

### Data publishing (backend side — small deploy addition)

- New repo **`CivicTechTO/toronto-bids-data`**. After `tb nightly` succeeds, plexbox
  uploads `bids.json`, `bids.json.gz`, `bids.sqlite` as assets on a rolling
  **`latest`** release (`gh release upload --clobber`), giving stable URLs of the form
  `https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/bids.json`.
- On the 1st of each month, additionally create a dated release
  (`snapshot-YYYY-MM-DD`) for point-in-time citation.
- GitHub release assets are free at these sizes and served with
  `Access-Control-Allow-Origin: *` — required for Datasette-Lite.
- After upload, plexbox triggers the site build:
  `gh workflow run deploy.yml -R CivicTechTO/toronto-bids-frontend`.
- The `gh` token lives beside the existing Slack webhook in
  `~/.config/toronto-bids/tb.env` (mode 0600, never in git).

### Backend changes required (small, both in scope for this project)

1. The nightly publish step above (a script in the backend's `deploy/`, called after
   `tb nightly`).
2. `build_export_document` adds `supplier_key` to each exported supplier — the stable
   identity the frontend slugs for permalinks. One line behind the Exporter seam.
3. `build_export_document` currently drops the 1,028 Award Summary Form bids
   (`reference IS NULL`): bids nest only under council items by `reference`, so
   reference-less bids attach to nothing (17,604 of 18,632 reach the export). Fix:
   nest reference-null bids under their solicitation (a `bids` array on each
   solicitation, keyed by `document_number`), with an `unlinked_bids` top-level
   bucket for reference-null bids whose `document_number` matches no solicitation —
   the same pattern as `unlinked_awards`. Without this, the post-panel bid record
   (2025-10-01 onward) is invisible to the frontend.

### Site build (GitHub Actions in this repo)

Triggered by the nightly dispatch, a daily scheduled fallback, and manual dispatch.

1. **Fetch** `bids.json` from the `latest` release (local fixture in dev/CI).
2. **Prepare** (`src/prepare/` — pure TypeScript, the custom core): validate export
   shape; apply the data rules above (dedupe, normalization, display titles, supplier
   slugs, rollups, cross-links); emit per-page data plus compact browse indexes.
3. **Astro** generates ~24k static pages from prepared data.
4. **Pagefind** indexes the built HTML (post-build step).
5. **Deploy** to GitHub Pages. Estimated site weight 300–400 MB (Pages soft limit 1 GB).

### Freshness & safety

- Every page footer: "Data as of `<meta.generated_at>`".
- The build **fails instead of deploying** when: the export is malformed (missing
  top-level keys / required fields), any major entity count drops >20% vs. the
  previous successful build (each deploy publishes its entity counts as a small
  `counts.json`; the next build fetches it from the live site), an internal link
  target is missing, or supplier slugs collide. A failed build leaves the last good site up; the archive never silently
  shrinks. Failures surface in GitHub Actions (maintainer email; optionally the
  existing Slack webhook as a repo secret later).

## Site structure

URLs are keyspace-scoped and permanent:

| URL | Page |
|---|---|
| `/` | Home: purpose, headline counts (City-only, labeled), search box, freshness |
| `/search/` | Pagefind UI over all record pages; filters: entity type, status, year, buyer |
| `/solicitations/` | Faceted browse table (status, rfx type, category, division, year, has-documents) |
| `/solicitations/{document_number}/` | Core record page (7,444) |
| `/noncompetitive/` and `/noncompetitive/{workspace_number}/` | Sole-source contracts with stated reason (2,856) |
| `/calls/{call_number}/` | Composite awards 2009–2012 grouped per call (1,052 lines); for 2009–2011 these ARE the award record |
| `/council/{reference}/` | Council items (4,801): decision text, bid tables with `hst_basis`, staff reports |
| `/suppliers/` and `/suppliers/{slug}/` | Supplier profiles (7,744): won, bid-and-lost, suspensions, name variants |
| `/buyers/` and `/buyers/{slug}/` | Agency sections, empty-state-ready; coverage windows, partnered badge |
| `/capital-projects/` | Table page (46 rows, no detail pages) |
| `/suspended-firms/` | Table page (3 rows), links to supplier + council pages |
| `/data/` | Downloads, Datasette-Lite, documented schema and gotchas, sync status, citation |
| `/about/` | Methodology, provenance, coverage windows and known gaps |
| `404` | Search box + keyspace explanation (paste any identifier) |

**Solicitation record page** assembles everything joinable: spine fields with
`title_source` provenance badge; deduped awards (raw + numeric amounts side by side);
bids reached both by `document_number` and via the council bid-bridge, winner/loser
marked, `hst_basis` shown; Ariba posting details; the **documents index** (name, nested
path, type, size; City-hosted PDFs link out; Ariba attachment files marked
indexed-not-downloadable with a note that the bytes are archived); links to related
council items and supplier pages.

**Supplier page** answers "who is this firm?": display name + all raw variants;
awards won (City + composite, presented in separate labeled sections); bids lost;
single-bidder appearances; suspension status if any; totals per keyspace, never merged.

**Buyer pages** exist from day one with honest empty states ("TRCA portal captured
since 2026-07-18; no bids posted yet") because the agency expansion (TTC, Police,
TCHC, Waterfront Toronto, Exhibition Place, TPL) is the backend's active direction.
The UI treats buyer as a first-class dimension; nothing assumes `document_number` is
a universal ID.

**About page** documents coverage honestly: 2009–2012 exists only as composite awards;
Exhibition Place stops dead at 2019-08-27; Toronto Hydro (the City's largest procuring
body) publishes no record at all; the Bid Award Panel corpus ended 2025-10-01 and
Award Summary Forms (>$500K only) took over, so the bid record thins for small awards
after that date.

## Search and browse

- **Pagefind** (post-build, zero indexing code): covers titles, descriptions, supplier
  names and variants, council decision text, and **every document filename** — a
  search for a filename surfaces the solicitation holding it. All identifiers
  (document numbers, workspace numbers, call numbers, council references) are
  searchable verbatim. Filters via per-page data attributes.
- **Browse tables**: one client-side island (TanStack Table) over compact prebuilt
  JSON indexes (solicitations index ~1–2 MB gzipped). Sort/filter/paginate
  client-side; filter state serializes to query params so filtered views are citable
  URLs. Reused with smaller indexes for suppliers, non-competitive, council items.
- **No-JS degradation**: browse pages prerender the first page of rows as plain HTML;
  search page degrades to a note pointing at browse pages.

## The `/data/` page

- Download links: `latest` (JSON, JSON.gz, SQLite) + monthly snapshots, with sizes
  and `generated_at`.
- **"Open in Datasette-Lite"**: `https://lite.datasette.io/?url=<bids.sqlite latest URL>`
  — full SQL in the browser, zero code from us.
- Schema documentation published for users: the five keyspaces, the three amount
  tiers, the award dedupe rule, `hst_basis`, `title IS NULL` semantics, the ~$15B
  implausible-award caveat, supplier-id instability.
- Sync-status table from `meta.sources`; citation guidance (cite a monthly snapshot
  for reproducibility).

## Error handling

Build-time (primary): validation and invariant failures abort deploys (see
Freshness & safety). Legitimately unlinked records (the export's `unlinked_*`
buckets, pre-2019 bids with no document number) render with explicit "not linked"
states — nothing is silently dropped.
Runtime: static pages; the only failure mode is JS-off, handled by degradation above.

## Testing

- **Prepare step** (all custom logic): Vitest unit tests against a fixture
  `bids.json` (dozens of records, committed) covering: dual-source award dedupe,
  untitled records, unparseable amounts, `hst_basis` mixes, keyspace non-joins,
  supplier slug stability and collision detection, category normalization,
  `value_confidential`, empty `buyers`.
- **CI on every PR**: full build against the fixture; asserts page counts, golden-file
  HTML snapshots for one record page per entity type, zero broken internal links.
- **Nightly full-data build** is the integration test; its invariant checks are the
  assertions.

## Deferred (explicitly out of v1)

- Analytics dashboards (v1: headline stats only, following the aggregation rules).
- Serving any document bytes; full-text search inside PDFs.
- Agency data UI beyond empty-state-ready buyer pages (portals are empty today).
- Custom domain (GitHub Pages default until CivicTechTO decides; all URLs relative).
- Parquet exports (the backend Exporter seam makes this a later, separate addition).
- The #124 surrogate-ID migration — keyspace-scoped URLs mean it can land later
  without breaking links.
- New record types from upcoming sources (TTC unevaluated bid lists, ACANs) — the
  design accommodates them as new sections/badges when the export carries them.

## Open items

- Site name presented as "Toronto Bids Archive" pending CivicTechTO branding wishes.
- Whether to add the Slack webhook to GitHub Actions failure notifications
  (maintainer email is the v1 channel).
