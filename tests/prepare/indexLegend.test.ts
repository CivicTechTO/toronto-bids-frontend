import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { INDEX_LEGENDS } from '../../src/lib/indexLegend.ts';
import { prepare } from '../../src/prepare/prepare.ts';
import { validateExport } from '../../src/prepare/validate.ts';
import {
  buildSolicitationIndex,
  buildSupplierIndex,
  buildNoncompetitiveIndex,
  buildCouncilIndex,
} from '../../src/prepare/indexes.ts';
import type { ExportDoc } from '../../src/prepare/types.ts';

const fx = JSON.parse(readFileSync('tests/fixtures/bids.fixture.json', 'utf8')) as ExportDoc;
const p = prepare(validateExport(fx));

const BUILDERS: Record<string, () => object[]> = {
  'indexes/solicitations.json': () => buildSolicitationIndex(p),
  'indexes/suppliers.json': () => buildSupplierIndex(p),
  'indexes/noncompetitive.json': () => buildNoncompetitiveIndex(p),
  'indexes/council.json': () => buildCouncilIndex(p),
};

describe('INDEX_LEGENDS', () => {
  it('documents exactly the index files that ship', () => {
    expect(INDEX_LEGENDS.map((l) => l.file).sort()).toEqual(Object.keys(BUILDERS).sort());
  });

  // Drift guard: the documented keys must equal what each builder actually emits, so a
  // schema change to src/prepare/indexes.ts fails here until the legend is updated.
  for (const legend of INDEX_LEGENDS) {
    it(`documents the exact keys ${legend.file} emits`, () => {
      const rows = BUILDERS[legend.file]();
      expect(rows.length, `fixture produced no ${legend.file} rows`).toBeGreaterThan(0);
      const emitted = Object.keys(rows[0]).sort();
      const documented = Object.keys(legend.keys).sort();
      expect(documented).toEqual(emitted);
    });
  }
});
