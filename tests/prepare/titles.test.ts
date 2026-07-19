import { describe, it, expect } from 'vitest';
import { displayTitle, normalizeCategory, TITLE_SOURCE_LABELS } from '../../src/prepare/titles.ts';

describe('displayTitle', () => {
  it('uses the published title verbatim when present', () => {
    expect(
      displayTitle({
        document_number: '3524228095',
        title: 'Road Resurfacing — Various Locations',
        rfx_type: 'RFT',
        division: 'Transportation Services',
      }),
    ).toEqual({ text: 'Road Resurfacing — Various Locations', untitled: false });
  });

  it('builds "Doc <n> — <rfx_type>, <division>" for a null title (data rule 5)', () => {
    expect(
      displayTitle({
        document_number: '3524228095',
        title: null,
        rfx_type: 'RFQ',
        division: 'Transportation Services',
      }),
    ).toEqual({ text: 'Doc 3524228095 — RFQ, Transportation Services', untitled: true });
  });

  it('omits the division when null', () => {
    expect(
      displayTitle({ document_number: '3524228095', title: null, rfx_type: 'RFQ', division: null }),
    ).toEqual({ text: 'Doc 3524228095 — RFQ', untitled: true });
  });

  it('omits the rfx_type when null', () => {
    expect(
      displayTitle({
        document_number: '3524228095',
        title: null,
        rfx_type: null,
        division: 'Transportation Services',
      }),
    ).toEqual({ text: 'Doc 3524228095 — Transportation Services', untitled: true });
  });

  it('falls back to the bare document number when rfx_type and division are both null', () => {
    expect(
      displayTitle({ document_number: '3524228095', title: null, rfx_type: null, division: null }),
    ).toEqual({ text: 'Doc 3524228095', untitled: true });
  });
});

describe('normalizeCategory', () => {
  it("folds 'Goods & Services' into 'Goods and Services' (data rule 6)", () => {
    expect(normalizeCategory('Goods & Services')).toBe('Goods and Services');
  });

  it("leaves 'Goods and Services' unchanged", () => {
    expect(normalizeCategory('Goods and Services')).toBe('Goods and Services');
  });

  it('leaves other categories unchanged', () => {
    expect(normalizeCategory('Professional Services')).toBe('Professional Services');
  });

  it('passes null through', () => {
    expect(normalizeCategory(null)).toBeNull();
  });
});

describe('TITLE_SOURCE_LABELS', () => {
  it('labels all four title_source values with non-empty text', () => {
    expect(Object.keys(TITLE_SOURCE_LABELS).sort()).toEqual([
      'bid_award_panel',
      'council_composite',
      'council_pre_ariba',
      'legacy_ariba_html',
    ]);
    for (const label of Object.values(TITLE_SOURCE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
