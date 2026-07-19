import type { AwardRow, DedupedAward } from './types.ts';

/**
 * Data rule 1: award rows are dual-provenance — the same award appears once
 * per source (odata + ckan_awarded). Group by the raw line identity
 * (supplier, verbatim amount, date); the odata row's field values win;
 * CKAN presence survives only in `sources[]` (rendered as a cross-check
 * note). CKAN-only groups are kept. NEVER dedupe by (document, supplier):
 * one row is one award line, and standing-offer call-ups legitimately
 * repeat suppliers — the amount and date in the key keep those apart.
 */
export function dedupeAwards(rows: AwardRow[]): DedupedAward[] {
  const groups = new Map<string, { rep: AwardRow; sources: Set<string> }>();
  const order: string[] = [];
  for (const row of rows) {
    const key = `${row.supplier_name_raw ?? ''} ${row.award_amount ?? ''} ${row.award_date ?? ''}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { rep: row, sources: new Set([row.source]) });
      order.push(key);
    } else {
      existing.sources.add(row.source);
      if (row.source === 'odata' && existing.rep.source !== 'odata') {
        existing.rep = row;
      }
    }
  }
  return order.map((key) => {
    const { rep, sources } = groups.get(key)!;
    const sorted = [...sources].sort((a, b) => {
      if (a === b) return 0;
      if (a === 'odata') return -1;
      if (b === 'odata') return 1;
      return a < b ? -1 : 1;
    });
    return { ...rep, sources: sorted };
  });
}
