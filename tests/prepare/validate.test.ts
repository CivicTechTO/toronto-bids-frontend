import { describe, expect, it } from 'vitest';
import type { ExportDoc } from '../../src/prepare/types.ts';
import { ExportShapeError, validateExport } from '../../src/prepare/validate.ts';

/** Smallest valid post-#144/#145 export: meta + all 11 top-level arrays. */
function makeValidDoc(): any {
  return {
    meta: {
      generated_at: '2026-07-18T05:30:00',
      counts: { solicitation: 1, supplier: 1 },
      sources: [
        { source: 'odata', status: 'ok', finished_at: '2026-07-18T05:00:00', rows_fetched: 10, rows_upserted: 10 },
      ],
    },
    solicitations: [
      {
        document_number: '3524228095',
        status: 'Awarded',
        rfx_type: 'RFQ',
        noip_type: null,
        form_type: null,
        title: null,
        description: null,
        issue_date: '2024-01-15',
        submission_deadline: null,
        category: 'Goods and Services',
        division: 'Transportation Services',
        buyer_name: null,
        buyer_email: null,
        buyer_phone: null,
        wards: null,
        ariba_posting_link: null,
        source: 'odata',
        title_source: null,
        first_seen: '2026-01-01',
        last_seen: '2026-07-18',
        awards: [],
        ariba_postings: [],
        documents: [],
        bids: [],
      },
    ],
    noncompetitive: [],
    suspended_firms: [],
    suppliers: [
      {
        supplier_id: 42,
        supplier_key: 'acme paving ltd',
        display_name: 'Acme Paving Ltd.',
        variants: ['ACME PAVING LTD'],
        first_seen: '2026-01-01',
        last_seen: '2026-07-18',
      },
    ],
    capital_projects: [],
    composite_awards: [],
    council_items: [
      {
        reference: '2024.GG9.10',
        title: 'Award of RFQ',
        decision_text: 'Adopted',
        first_seen: '2026-01-01',
        last_seen: '2026-07-18',
        background_pdfs: [],
        bids: [],
      },
    ],
    unlinked_ariba_postings: [],
    unlinked_awards: [],
    unlinked_bids: [],
    buyers: [],
  };
}

function problemsOf(raw: unknown): string[] {
  try {
    validateExport(raw);
  } catch (e) {
    if (e instanceof ExportShapeError) return e.problems;
    throw e;
  }
  throw new Error('expected validateExport to throw ExportShapeError');
}

describe('validateExport', () => {
  it('returns the document typed as ExportDoc when the shape is valid', () => {
    const doc: ExportDoc = validateExport(makeValidDoc());
    expect(doc.solicitations[0]!.document_number).toBe('3524228095');
    expect(doc.suppliers[0]!.supplier_key).toBe('acme paving ltd');
  });

  it('rejects a non-object payload with a single problem', () => {
    expect(problemsOf('not an object')).toEqual(['export is not a JSON object']);
    expect(problemsOf(null)).toEqual(['export is not a JSON object']);
  });

  it('collects ALL problems instead of stopping at the first', () => {
    const raw = makeValidDoc();
    delete raw.buyers;
    delete raw.council_items;
    raw.meta.generated_at = 42;
    const problems = problemsOf(raw);
    expect(problems).toContain('meta.generated_at: missing or not a string');
    expect(problems).toContain('council_items: missing or not an array');
    expect(problems).toContain('buyers: missing or not an array');
    expect(problems).toHaveLength(3);
  });

  it('flags a pre-#145 export (solicitation missing its bids array, no unlinked_bids)', () => {
    const raw = makeValidDoc();
    delete raw.solicitations[0].bids;
    delete raw.unlinked_bids;
    const problems = problemsOf(raw);
    expect(problems).toContain('solicitations[0].bids: missing or not an array (backend issue #145 landed?)');
    expect(problems).toContain('unlinked_bids: missing or not an array (backend issue #145 landed?)');
  });

  it('flags a pre-#144 supplier missing supplier_key', () => {
    const raw = makeValidDoc();
    delete raw.suppliers[0].supplier_key;
    expect(problemsOf(raw)).toContain(
      'suppliers[0].supplier_key: missing or not a non-empty string (backend issue #144 landed?)',
    );
  });

  it('flags rows missing identity fields', () => {
    const raw = makeValidDoc();
    raw.noncompetitive = [{ supplier_name_raw: 'Acme' }];
    raw.composite_awards = [{ id: 1 }];
    const problems = problemsOf(raw);
    expect(problems).toContain('noncompetitive[0].workspace_number: missing or not a string');
    expect(problems).toContain('composite_awards[0].call_number: missing or not a string');
  });

  it('names the problem count in the error message', () => {
    const raw = makeValidDoc();
    delete raw.buyers;
    expect(() => validateExport(raw)).toThrow(ExportShapeError);
    expect(() => validateExport(raw)).toThrow(/1 problem\(s\)/);
  });
});
