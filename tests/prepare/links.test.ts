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
