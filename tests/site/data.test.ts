import { describe, expect, it } from 'vitest';
import { loadFixture, loadPage } from './helpers';

// Datasette-Lite loads the sqlite in-browser from a CORS-enabled R2 bucket, not the
// release asset (which no longer sends ACAO — toronto-bids#155). Downloads stay on the release.
const DATASETTE =
  'https://lite.datasette.io/?url=https://pub-99a890c186c743c19ef7bcd00024dca8.r2.dev/bids.sqlite';
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

  it('states the license and reuse terms (OGL-Toronto source + CC BY 4.0 compilation)', () => {
    const $ = loadPage('data');
    expect($('h2:contains("License")').length).toBe(1);
    expect($('a[href="https://open.toronto.ca/open-data-license/"]').length).toBeGreaterThan(0);
    expect($('a[href="https://creativecommons.org/licenses/by/4.0/"]').length).toBeGreaterThan(0);
  });
});
