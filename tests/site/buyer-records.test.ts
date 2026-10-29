// Data-independent assertions: run against the fixture or any full export build.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadFile, loadPage } from './helpers';
import type { ExportDoc } from '../../src/prepare/types';

const doc = JSON.parse(readFileSync(process.env.TB_DATA_FILE ?? 'tests/fixtures/bids.fixture.json', 'utf8')) as ExportDoc;

function headingCount(n: number, label: string): string {
  return `${label} (${n})`;
}

describe('exported buyer records reach built pages', () => {
  it('renders every portal posting and source-backed award under its own buyer', () => {
    const index = loadPage('buyers');
    for (const buyer of doc.buyers) {
      const $ = loadPage(`buyers/${buyer.slug}`);
      const listings = buyer.portal_listings ?? [];
      const claims = buyer.published_awards ?? [];
      const publications = buyer.award_publications ?? [];
      const row = index('tr').filter((_, el) => index(el).find(`a[href$="/buyers/${buyer.slug}/"]`).length > 0);
      expect(row.find('td').map((_, el) => index(el).text()).get().slice(3)).toEqual([
        buyer.solicitations.length, listings.length, buyer.awards.length, claims.length, buyer.bids.length,
      ].map(String));
      expect($('#portal-listings tbody tr').length).toBe(listings.length);
      expect($('#published-awards tbody tr').length).toBe(claims.length);
      expect($('#award-publications tbody tr').length).toBe(publications.length);
      if (listings.length) expect($('#portal-listings h2').text()).toBe(headingCount(listings.length, 'Portal listings'));
      claims.forEach((claim, i) => {
        const text = $('#published-awards tbody tr').eq(i).text();
        const source = publications.find((p) => p.source_key === claim.publication_key)!;
        expect(text).toContain(claim.supplier_name_raw);
        expect(text).toContain(source.publication_month);
        expect(text).toContain(source.raw_text);
        for (const proof of claim.evidence_json?.sources ?? []) {
          expect($('#published-awards tbody tr').eq(i).find(`a[href="${proof.url}#page=${proof.page}"]`).length).toBe(1);
        }
      });
    }
  });

  it('publishes counts of the displayed record kinds for subsequent shrink checks', () => {
    const counts = JSON.parse(loadFile('counts.json'));
    for (const kind of ['portal_listings', 'published_awards', 'award_publications'] as const) {
      expect(counts[kind]).toBe(doc.buyers.reduce((n, b) => n + (b[kind]?.length ?? 0), 0));
    }
  });
});
