import { describe, it, expect } from 'vitest';
import { formatCAD } from '../../src/prepare/amounts.ts';

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
