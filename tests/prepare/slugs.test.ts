import { describe, it, expect } from 'vitest';
import { supplierSlug } from '../../src/prepare/slugs.ts';

describe('supplierSlug', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(supplierSlug('ACME PAVING LTD')).toBe('acme-paving-ltd');
  });

  it('collapses punctuation runs into a single dash', () => {
    expect(supplierSlug('ACME & SONS, LTD.')).toBe('acme-sons-ltd');
  });

  it('trims leading and trailing dashes produced by edge punctuation', () => {
    expect(supplierSlug('(1234567 ONTARIO INC.)')).toBe('1234567-ontario-inc');
  });

  it('keeps digits', () => {
    expect(supplierSlug('A1 GROUP 2000')).toBe('a1-group-2000');
  });
});
