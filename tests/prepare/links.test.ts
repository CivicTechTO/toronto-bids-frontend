import { describe, it, expect } from 'vitest';
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

function sol(over: Partial<Solicitation> = {}): Solicitation {
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
