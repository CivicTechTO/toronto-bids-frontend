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
