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
      solicitations: 0, awardedTotal: zero(), awardedTotalTrimmed: zero(), outlierAwardCount: 0,
      noncompetitiveTotal: zero(),
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
