import type { ExportDoc } from './types.ts';

/** Thrown by validateExport; `problems` lists EVERY shape violation found. */
export class ExportShapeError extends Error {
  problems: string[];

  constructor(problems: string[]) {
    super(`export failed shape validation, ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
    this.name = 'ExportShapeError';
    this.problems = problems;
  }
}

const TOP_LEVEL_ARRAYS = [
  'solicitations',
  'noncompetitive',
  'suspended_firms',
  'suppliers',
  'capital_projects',
  'composite_awards',
  'council_items',
  'unlinked_ariba_postings',
  'unlinked_awards',
  'unlinked_bids',
  'buyers',
] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Structural guard over a parsed bids.json. Collects every problem (missing
 * top-level keys, malformed meta, rows missing identity fields or nested
 * arrays) and throws a single ExportShapeError listing all of them, so a failed
 * nightly build reports the full damage at once. Returns the input typed as
 * ExportDoc when clean.
 */
export function validateExport(raw: unknown): ExportDoc {
  if (!isRecord(raw)) throw new ExportShapeError(['export is not a JSON object']);
  const problems: string[] = [];

  if (!isRecord(raw.meta)) {
    problems.push('meta: missing or not an object');
  } else {
    if (typeof raw.meta.generated_at !== 'string') problems.push('meta.generated_at: missing or not a string');
    if (!isRecord(raw.meta.counts)) problems.push('meta.counts: missing or not an object');
    if (!Array.isArray(raw.meta.sources)) problems.push('meta.sources: missing or not an array');
  }

  for (const key of TOP_LEVEL_ARRAYS) {
    if (!Array.isArray(raw[key])) {
      const hint = key === 'unlinked_bids' ? ' (backend issue #145 landed?)' : '';
      problems.push(`${key}: missing or not an array${hint}`);
    }
  }

  if (Array.isArray(raw.solicitations)) {
    raw.solicitations.forEach((sol: unknown, i: number) => {
      if (!isRecord(sol)) {
        problems.push(`solicitations[${i}]: not an object`);
        return;
      }
      if (typeof sol.document_number !== 'string') problems.push(`solicitations[${i}].document_number: missing or not a string`);
      if (typeof sol.issue_date !== 'string') problems.push(`solicitations[${i}].issue_date: missing or not a string`);
      for (const nested of ['awards', 'ariba_postings', 'documents', 'bids'] as const) {
        if (!Array.isArray(sol[nested])) {
          const hint = nested === 'bids' ? ' (backend issue #145 landed?)' : '';
          problems.push(`solicitations[${i}].${nested}: missing or not an array${hint}`);
        }
      }
    });
  }

  if (Array.isArray(raw.suppliers)) {
    raw.suppliers.forEach((s: unknown, i: number) => {
      if (!isRecord(s)) {
        problems.push(`suppliers[${i}]: not an object`);
        return;
      }
      if (typeof s.supplier_id !== 'number') problems.push(`suppliers[${i}].supplier_id: missing or not a number`);
      if (typeof s.supplier_key !== 'string' || s.supplier_key === '') {
        problems.push(`suppliers[${i}].supplier_key: missing or not a non-empty string (backend issue #144 landed?)`);
      }
      if (typeof s.display_name !== 'string') problems.push(`suppliers[${i}].display_name: missing or not a string`);
      if (!Array.isArray(s.variants)) problems.push(`suppliers[${i}].variants: missing or not an array`);
    });
  }

  if (Array.isArray(raw.noncompetitive)) {
    raw.noncompetitive.forEach((n: unknown, i: number) => {
      if (!isRecord(n) || typeof n.workspace_number !== 'string') {
        problems.push(`noncompetitive[${i}].workspace_number: missing or not a string`);
      }
    });
  }

  if (Array.isArray(raw.council_items)) {
    raw.council_items.forEach((c: unknown, i: number) => {
      if (!isRecord(c)) {
        problems.push(`council_items[${i}]: not an object`);
        return;
      }
      if (typeof c.reference !== 'string') problems.push(`council_items[${i}].reference: missing or not a string`);
      if (!Array.isArray(c.background_pdfs)) problems.push(`council_items[${i}].background_pdfs: missing or not an array`);
      if (!Array.isArray(c.bids)) problems.push(`council_items[${i}].bids: missing or not an array`);
    });
  }

  if (Array.isArray(raw.composite_awards)) {
    raw.composite_awards.forEach((c: unknown, i: number) => {
      if (!isRecord(c) || typeof c.call_number !== 'string') {
        problems.push(`composite_awards[${i}].call_number: missing or not a string`);
      }
    });
  }

  if (Array.isArray(raw.buyers)) {
    raw.buyers.forEach((b: unknown, i: number) => {
      if (!isRecord(b)) {
        problems.push(`buyers[${i}]: not an object`);
        return;
      }
      if (typeof b.slug !== 'string') problems.push(`buyers[${i}].slug: missing or not a string`);
      for (const nested of ['solicitations', 'awards', 'bids'] as const) {
        if (!Array.isArray(b[nested])) problems.push(`buyers[${i}].${nested}: missing or not an array`);
      }
    });
  }

  if (problems.length > 0) throw new ExportShapeError(problems);
  return raw as unknown as ExportDoc;
}
