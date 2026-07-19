import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { codedDomains } from '../../src/prepare/domains.ts';
import type { ExportDoc } from '../../src/prepare/types.ts';

const fx = JSON.parse(readFileSync('tests/fixtures/bids.fixture.json', 'utf8')) as ExportDoc;
const domains = codedDomains(fx);
const col = (t: string, c: string) => domains.find((d) => d.table === t && d.column === c)!;

describe('codedDomains', () => {
  it('covers exactly the coded columns analysts need', () => {
    expect(domains.map((d) => `${d.table}.${d.column}`)).toEqual([
      'solicitations.status',
      'solicitations.rfx_type',
      'bids.hst_basis',
      'awards.award_amount_verdict',
      'noncompetitive.contract_amount_verdict',
    ]);
  });

  it('tallies every row of the source column (nulls included) so counts sum to the total', () => {
    // rfx_type is nullable — the (null) bucket must be counted, not dropped.
    const rfx = col('solicitations', 'rfx_type');
    const total = rfx.values.reduce((n, v) => n + v.count, 0);
    expect(total).toBe(fx.solicitations.length);
  });

  it('lists every distinct status observed in this export', () => {
    const status = col('solicitations', 'status');
    for (const s of new Set(fx.solicitations.map((x) => x.status))) {
      expect(status.values.find((v) => v.value === s), `missing status ${s}`).toBeDefined();
    }
  });

  it('normalizes null to "(null)" and never a literal "null"/"undefined"', () => {
    for (const c of domains) {
      for (const v of c.values) {
        expect(v.value).not.toBe('null');
        expect(v.value).not.toBe('undefined');
      }
    }
  });

  it('sorts each domain by descending count', () => {
    for (const c of domains) {
      for (let i = 1; i < c.values.length; i++) {
        expect(c.values[i - 1].count).toBeGreaterThanOrEqual(c.values[i].count);
      }
    }
  });

  it('carries analyst caveats on the load-bearing coded columns', () => {
    expect(col('bids', 'hst_basis').note).toMatch(/never/i);
    expect(col('awards', 'award_amount_verdict').note).toMatch(/not_an_award/);
  });
});
