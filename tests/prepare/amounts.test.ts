import { describe, it, expect } from 'vitest';
import { formatCAD, sumAwardNumeric } from '../../src/prepare/amounts.ts';

describe('formatCAD', () => {
  it('formats with $ prefix, comma thousands, two decimals (en-CA)', () => {
    expect(formatCAD(1234567.89)).toBe('$1,234,567.89');
  });

  it('pads whole numbers to two decimals', () => {
    expect(formatCAD(1000)).toBe('$1,000.00');
  });

  it('formats zero', () => {
    expect(formatCAD(0)).toBe('$0.00');
  });

  it('rounds sub-cent values', () => {
    expect(formatCAD(31.654)).toBe('$31.65');
  });
});

describe('sumAwardNumeric', () => {
  it('returns zeros for an empty list', () => {
    expect(sumAwardNumeric([])).toEqual({ total: 0, counted: 0, skipped: 0 });
  });

  it('sums numeric values and counts them', () => {
    const rows = [
      { numeric: 100.5, verdict: null },
      { numeric: 200.25, verdict: undefined },
    ];
    expect(sumAwardNumeric(rows)).toEqual({ total: 300.75, counted: 2, skipped: 0 });
  });

  it('skips null numerics but counts each skip', () => {
    const rows = [
      { numeric: 500, verdict: null },
      { numeric: null, verdict: null }, // raw was "kj" or "31.65/MT" — unparseable
      { numeric: null, verdict: undefined },
    ];
    expect(sumAwardNumeric(rows)).toEqual({ total: 500, counted: 1, skipped: 2 });
  });

  it("skips verdict 'not_an_award' even when a numeric is present", () => {
    const rows = [
      { numeric: 1000, verdict: 'not_an_award' },
      { numeric: 250, verdict: null },
    ];
    expect(sumAwardNumeric(rows)).toEqual({ total: 250, counted: 1, skipped: 1 });
  });

  it('counts rows with any other verdict normally', () => {
    const rows = [{ numeric: 42, verdict: 'plausible' }];
    expect(sumAwardNumeric(rows)).toEqual({ total: 42, counted: 1, skipped: 0 });
  });
});
