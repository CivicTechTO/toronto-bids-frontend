import { describe, it, expect } from 'vitest';
import { dedupeAwards } from '../../src/prepare/awards.ts';
import type { AwardRow } from '../../src/prepare/types.ts';

function award(over: Partial<AwardRow>): AwardRow {
  return {
    supplier_name_raw: 'ACME PAVING LTD',
    supplier_id: 41,
    award_amount: '$1,000,000.00',
    award_amount_numeric: 1000000,
    award_date: '2024-03-01',
    source: 'odata',
    first_seen: '2024-03-02',
    last_seen: '2026-07-17',
    ...over,
  };
}

describe('dedupeAwards', () => {
  it('collapses an identical odata + ckan_awarded pair into one row', () => {
    const rows = [
      award({ source: 'odata' }),
      award({ source: 'ckan_awarded', supplier_id: null, first_seen: '2024-03-05' }),
    ];
    const out = dedupeAwards(rows);
    expect(out).toHaveLength(1);
    expect(out[0].sources).toEqual(['odata', 'ckan_awarded']);
  });

  it("the odata row's field values win even when the ckan row comes first", () => {
    const rows = [
      award({ source: 'ckan_awarded', supplier_id: null, first_seen: '2024-03-05' }),
      award({ source: 'odata', supplier_id: 41, first_seen: '2024-03-02' }),
    ];
    const out = dedupeAwards(rows);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('odata');
    expect(out[0].supplier_id).toBe(41);
    expect(out[0].first_seen).toBe('2024-03-02');
    expect(out[0].sources).toEqual(['odata', 'ckan_awarded']);
  });

  it('keeps ckan-only rows', () => {
    const out = dedupeAwards([award({ source: 'ckan_awarded' })]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('ckan_awarded');
    expect(out[0].sources).toEqual(['ckan_awarded']);
  });

  it('never merges standing-offer call-ups: same supplier, different amount or date', () => {
    const rows = [
      award({ award_amount: '$10,000.00', award_amount_numeric: 10000, award_date: '2024-01-10' }),
      award({ award_amount: '$25,000.00', award_amount_numeric: 25000, award_date: '2024-01-10' }),
      award({ award_amount: '$10,000.00', award_amount_numeric: 10000, award_date: '2024-06-01' }),
    ];
    expect(dedupeAwards(rows)).toHaveLength(3);
  });

  it('preserves first-appearance order of groups', () => {
    const rows = [
      award({ supplier_name_raw: 'B FIRM', source: 'odata' }),
      award({ supplier_name_raw: 'A FIRM', source: 'odata' }),
      award({ supplier_name_raw: 'B FIRM', source: 'ckan_awarded' }),
    ];
    const out = dedupeAwards(rows);
    expect(out.map((r) => r.supplier_name_raw)).toEqual(['B FIRM', 'A FIRM']);
  });

  it('treats null key fields as empty strings in the group key', () => {
    const rows = [
      award({ supplier_name_raw: null, award_amount: null, award_amount_numeric: null, source: 'odata' }),
      award({ supplier_name_raw: null, award_amount: null, award_amount_numeric: null, source: 'ckan_awarded' }),
    ];
    const out = dedupeAwards(rows);
    expect(out).toHaveLength(1);
    expect(out[0].sources).toEqual(['odata', 'ckan_awarded']);
  });
});
