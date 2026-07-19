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
