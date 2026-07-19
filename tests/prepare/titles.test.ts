import { describe, it, expect } from 'vitest';
import {
  displayTitle,
  normalizeCategory,
  operatingName,
  TITLE_SOURCE_LABELS,
} from '../../src/prepare/titles.ts';

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

describe('operatingName', () => {
  it('extracts the trade name after an o/a marker', () => {
    expect(operatingName(['614128 ONTARIO LTD, O/A TRISAN CONSTRUCTION'])).toBe(
      'TRISAN CONSTRUCTION',
    );
  });

  it('handles "operating as", "d.b.a.", and "trading as"', () => {
    expect(operatingName(['2489960 Ontario Inc. operating as Kore Group'])).toBe('Kore Group');
    expect(operatingName(['123 Ontario Ltd d.b.a. Acme Paving'])).toBe('Acme Paving');
    expect(operatingName(['456 Ontario Inc trading as BuildCo'])).toBe('BuildCo');
  });

  it('strips trailing footnote artifacts from the extracted name', () => {
    expect(operatingName(['614128 Ontario Ltd. O/A Trisan Construction*'])).toBe(
      'Trisan Construction',
    );
  });

  it('does NOT treat a bare "DBA"/"COB" token (no dots) as a marker', () => {
    // A real company literally named this way must not get a fabricated trade name.
    expect(operatingName(['DBA Software Inc'])).toBeNull();
    expect(operatingName(['COB Consulting Ltd'])).toBeNull();
  });

  it('returns null when no variant carries a trade-name marker', () => {
    expect(operatingName(['Compugen Inc.', 'Compugen Incorporated'])).toBeNull();
  });

  it('returns null for an empty variant list', () => {
    expect(operatingName([])).toBeNull();
  });
});
