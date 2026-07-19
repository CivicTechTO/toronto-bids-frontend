import type { ExportDoc, BidRow } from './types.ts';

export interface CodedValue {
  /** The literal value, or '(null)' for null/absent. */
  value: string;
  count: number;
}

export interface CodedColumn {
  table: string;
  column: string;
  /** Analyst-facing caveat, rendered next to the domain. */
  note?: string;
  values: CodedValue[];
}

function tally(values: Array<string | null | undefined>): CodedValue[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v === null || v === undefined ? '(null)' : String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function allBids(doc: ExportDoc): BidRow[] {
  return [
    ...doc.council_items.flatMap((c) => c.bids),
    ...doc.solicitations.flatMap((s) => s.bids),
    ...doc.unlinked_bids,
  ];
}

/**
 * The observed domain (distinct values + row counts) of each coded, enum-like column,
 * computed from THIS export so it can never drift from the data (#12). These are the
 * columns whose valid values an analyst most needs before querying; the exhaustive
 * column list, types, and nullability come from the backend-generated schema.
 */
export function codedDomains(doc: ExportDoc): CodedColumn[] {
  const awards = [
    ...doc.solicitations.flatMap((s) => s.awards),
    ...doc.unlinked_awards,
  ];
  return [
    { table: 'solicitations', column: 'status', values: tally(doc.solicitations.map((s) => s.status)) },
    { table: 'solicitations', column: 'rfx_type', values: tally(doc.solicitations.map((s) => s.rfx_type)) },
    {
      table: 'bids',
      column: 'hst_basis',
      note: 'Never compare or sum bid prices across bases.',
      values: tally(allBids(doc).map((b) => b.hst_basis)),
    },
    {
      table: 'awards',
      column: 'award_amount_verdict',
      note: 'Rows with not_an_award are excluded from every total on this site.',
      values: tally(awards.map((a) => a.award_amount_verdict)),
    },
    {
      table: 'noncompetitive',
      column: 'contract_amount_verdict',
      values: tally(doc.noncompetitive.map((n) => n.contract_amount_verdict)),
    },
  ];
}
