import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadPage } from './helpers';
import { supplierSlug } from '../../src/prepare/slugs';
import type { ExportDoc } from '../../src/prepare/types';

const fx = JSON.parse(
  readFileSync('tests/fixtures/bids.fixture.json', 'utf8'),
) as ExportDoc;

describe('/capital-projects/', () => {
  it('lists every project with estimated_range shown verbatim as text', () => {
    const $ = loadPage('capital-projects');
    const text = $('body').text();
    expect(text).toContain(`${fx.capital_projects.length} upcoming`);
    for (const cp of fx.capital_projects) {
      expect(text).toContain(cp.name);
      if (cp.estimated_range) expect(text).toContain(cp.estimated_range);
    }
    expect(text).toContain('never parsed');
  });
});

describe('/suspended-firms/', () => {
  it('lists every firm, linking supplier profiles and council authority', () => {
    const $ = loadPage('suspended-firms');
    const text = $('body').text();
    for (const f of fx.suspended_firms) {
      expect(text).toContain(f.supplier_name_raw);
    }
    for (const f of fx.suspended_firms) {
      if (f.supplier_id === null) continue;
      const sup = fx.suppliers.find((s) => s.supplier_id === f.supplier_id);
      if (!sup) continue;
      expect(
        $(`a[href$="/suppliers/${supplierSlug(sup.supplier_key)}/"]`).length,
      ).toBeGreaterThan(0);
    }
    for (const f of fx.suspended_firms) {
      if (
        f.council_authority &&
        fx.council_items.some((ci) => ci.reference === f.council_authority)
      ) {
        expect(
          $(`a[href$="/council/${f.council_authority}/"]`).length,
        ).toBeGreaterThan(0);
      }
    }
  });
});
