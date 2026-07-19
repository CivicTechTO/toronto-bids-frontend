import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadPage } from './helpers';
import { supplierSlug } from '../../src/prepare/slugs';
import { operatingName } from '../../src/prepare/titles';
import { dedupeAwards } from '../../src/prepare/awards';
import { prepare } from '../../src/prepare/prepare';
import { validateExport } from '../../src/prepare/validate';
import type { ExportDoc } from '../../src/prepare/types';

const fx = JSON.parse(
  readFileSync('tests/fixtures/bids.fixture.json', 'utf8'),
) as ExportDoc;
// Expectations for the Lost mirror below are derived through the SAME code
// path the page uses (prepare()'s bridge + dedupedAwardsByDoc + supplier
// rollups) — never a re-derivation with different first-match rules.
const p = prepare(validateExport(fx));

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
// The mirror above only scans solicitations[].bids, but the fixture's real
// Lost case lives on a bridged council bid (council item 2019.BA42.10, doc
// 1808735584): a council bid carrying both a `reference` and a
// `document_number`. Mirror the page's exact derivation
// (src/pages/suppliers/[slug].astro: bidDoc/bidResult) via the real Prepared
// maps — including bids resolved through p.bridge.refToDoc — so bids sourced
// from council_items are considered too, not just solicitations[].bids.
function bidDocFor(entry: {
  document_number: string | null;
  reference: string | null;
}): string | null {
  if (entry.document_number !== null) return entry.document_number;
  if (entry.reference !== null) {
    return p.bridge.refToDoc.get(entry.reference) ?? null;
  }
  return null;
}
const lostBidder = [...p.rollupsBySlug.values()].find((rollup) => {
  const awardDocs = new Set(rollup.awards.map((a) => a.document_number));
  return rollup.bids.some((entry) => {
    const doc = bidDocFor(entry);
    if (doc === null || awardDocs.has(doc)) return false;
    return (p.dedupedAwardsByDoc.get(doc) ?? []).length > 0;
  });
})?.supplier;

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

describe('/suppliers/{slug}/ profile page', () => {
  it('surfaces the extracted operating (trade) name atop a numbered company (#13)', () => {
    const oaSuppliers = fx.suppliers.filter((s) =>
      s.variants.some((v) => /\bo\/a\b/i.test(v)),
    );
    expect(
      oaSuppliers.length,
      'fixture needs a supplier with an o/a variant',
    ).toBeGreaterThan(0);
    for (const s of oaSuppliers) {
      const trade = operatingName(s.variants);
      expect(trade, `should extract a trade name from ${s.supplier_key}`).not.toBeNull();
      const $ = loadPage(`suppliers/${supplierSlug(s.supplier_key)}`);
      // Non-vacuous: the extracted trade name itself must render, not merely the
      // static "Trading as" label the template always emits.
      expect($('.trade-name').text()).toContain(trade!);
    }
  });

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
    expect(text).toContain('kept separate by record type and never merged');
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
