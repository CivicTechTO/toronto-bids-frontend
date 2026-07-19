import { describe, it, expect } from 'vitest';
import { supplierSlug, buildSupplierSlugs, wsSlug } from '../../src/prepare/slugs.ts';
import type { SupplierRec } from '../../src/prepare/types.ts';

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

function supplier(over: Partial<SupplierRec>): SupplierRec {
  return {
    supplier_id: 1,
    supplier_key: 'acme paving ltd',
    display_name: 'Acme Paving Ltd.',
    variants: ['ACME PAVING LTD', 'Acme Paving Ltd.'],
    first_seen: '2024-01-01',
    last_seen: '2026-07-17',
    ...over,
  };
}

describe('buildSupplierSlugs', () => {
  it('maps every supplier_id to the slug of its supplier_key', () => {
    const slugs = buildSupplierSlugs([
      supplier({ supplier_id: 41, supplier_key: 'acme paving ltd' }),
      supplier({ supplier_id: 99, supplier_key: 'idle corp', display_name: 'Idle Corp', variants: [] }),
    ]);
    expect(slugs.size).toBe(2);
    expect(slugs.get(41)).toBe('acme-paving-ltd');
    expect(slugs.get(99)).toBe('idle-corp');
  });

  it('throws on a slug collision, naming BOTH supplier_keys and the slug', () => {
    const suppliers = [
      supplier({ supplier_id: 1, supplier_key: 'acme ltd' }),
      supplier({ supplier_id: 2, supplier_key: 'acme. ltd' }),
    ];
    expect(() => buildSupplierSlugs(suppliers)).toThrowError(
      'Supplier slug collision: "acme-ltd" from supplier_key "acme ltd" and supplier_key "acme. ltd"',
    );
  });
});

describe('wsSlug', () => {
  it('passes clean workspace numbers through unchanged', () => {
    expect(wsSlug('2021-0001')).toBe('2021-0001');
    expect(wsSlug('SR1152773518')).toBe('SR1152773518');
  });

  it('replaces runs of spaces, slashes, commas, and ampersands with a single dash', () => {
    expect(wsSlug('SR5252910024 / CW2310865')).toBe('SR5252910024-CW2310865');
    expect(wsSlug('SR5465565873/CW2312872')).toBe('SR5465565873-CW2312872');
    expect(wsSlug('11393, 11394 & 11395')).toBe('11393-11394-11395');
  });

  it('trims edge dashes from wrapping punctuation; preserves case, dots, and underscores', () => {
    expect(wsSlug('10834 (11106)')).toBe('10834-11106');
    expect(wsSlug('CINTAS CANADA LIMITED')).toBe('CINTAS-CANADA-LIMITED');
    expect(wsSlug(' No. 6034_A ')).toBe('No.-6034_A');
  });
});
