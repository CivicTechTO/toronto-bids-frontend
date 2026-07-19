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

**Status:** backend issue #146 (the nightly publish to the `CivicTechTO/toronto-bids-data`
releases repo) is code-merged but not yet operational — the `toronto-bids-data` repo/release
does not exist yet, so `TB_DATA_URL` currently 404s. `deploy.yml` is complete and correct
and will work as soon as #146's release exists; until then, do not trigger the live deploy.
Local verification against real data uses a locally-regenerated export via `TB_DATA_FILE`
instead (see "Full-data verification" below).

### One-time GitHub/Pages setup (manual, needs repo admin on CivicTechTO)

1. Confirm the repo is pushed to `CivicTechTO/toronto-bids-frontend` and public.
   The repo NAME must stay `toronto-bids-frontend` — it is baked into `BASE_PATH`.
2. Enable Pages via Actions: Settings → Pages → Build and deployment → Source:
   **GitHub Actions**. (CLI: `gh api -X POST repos/CivicTechTO/toronto-bids-frontend/pages -f build_type=workflow`;
   use `-X PUT` instead if Pages is already configured.)
3. Repo variables/secrets: none required for v1. `SITE_URL`, `BASE_PATH`, and
   `TB_DATA_URL` are hard-coded in `deploy.yml`'s `env:` block, and the automatic
   `GITHUB_TOKEN` covers Pages. (Optional later: a `SLACK_WEBHOOK` secret for
   failure notifications — an open item in the spec.)
4. Verify backend #146 is live before the first deploy:
   `curl -fsIL https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/bids.json | head -n 1`
   should print `HTTP/2 200`. If it 404s, stop — `deploy.yml` will fail at the fetch step.
5. Nightly trigger path (backend side, informational): after `tb nightly` uploads
   the release assets, plexbox runs `gh workflow run deploy.yml -R CivicTechTO/toronto-bids-frontend`
   using the token in `~/.config/toronto-bids/tb.env`.
6. First-deploy expectation: the "Fetch previous deploy's entity counts" step will
   print `no previous counts (first deploy?)` because the site (and its `counts.json`)
   does not exist yet; `check-shrink` then runs with a null baseline and reports no
   violations. This is expected, not an error — the shrink guard arms itself from
   the second deploy onward.

## Full-data verification (executed once locally, before #146 is operational)

Because the live `TB_DATA_URL` isn't reachable yet, the full ~24k-page build was
verified locally against a fresh export from the backend, bypassing the network
fetch entirely:

```bash
cd <backend>/scrapers && uv run tb export        # writes scrapers/files/export/bids.json
TB_DATA_FILE=<path-to-export>/bids.json BASE_PATH=/ npm run build
npx vitest run -c vitest.site.config.ts tests/site/links.test.ts
```

Only `tests/site/links.test.ts` is run against the full-data `dist/` — it is the
one site-test file that is data-independent (an internal-link crawl plus page
counts derived from the build's own `counts.json`). Every other site-test file
under `tests/site/` is fixture-coupled by design (e.g. `buyers.test.ts` expects
the fixture's synthetic `buyers/toronto-zoo-test/` page; real exports have
`buyers: []`) and is expected to fail against full data — those run in CI against
the fixture build only, per `.github/workflows/ci.yml`.

## Data rules

The site enforces the archive's load-bearing rules: award dedupe (odata rows win),
three amount tiers (only `*_numeric` is summed, labelled as undercounts), five
disjoint keyspaces that never join, `hst_basis` shown with every bid price,
null-title semantics, and `supplier_key`-slugged supplier permalinks. They are
documented for readers on the live `/data/` page and in the design spec.
