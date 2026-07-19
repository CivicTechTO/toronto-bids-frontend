// Deploy shrink guard. countsOf() is published as counts.json after each
// deploy; the next build fetches it and refuses to deploy if any entity
// count shrank by more than 20% — the archive never silently shrinks.
import type { ExportDoc } from './types';

// Keys: solicitations, awards, bids, noncompetitive, suppliers, council_items,
// composite_awards. bids = council-nested + solicitation-nested + unlinked.
export function countsOf(doc: ExportDoc): Record<string, number> {
  return {
    solicitations: doc.solicitations.length,
    awards: doc.solicitations.reduce((n, s) => n + s.awards.length, 0) + doc.unlinked_awards.length,
    bids: doc.council_items.reduce((n, c) => n + c.bids.length, 0)
      + doc.solicitations.reduce((n, s) => n + s.bids.length, 0)
      + doc.unlinked_bids.length,
    noncompetitive: doc.noncompetitive.length,
    suppliers: doc.suppliers.length,
    council_items: doc.council_items.length,
    composite_awards: doc.composite_awards.length,
  };
}

// Violation when current < 80% of previous on any key previous knows about.
// Exactly 20% is allowed. previous === null (first deploy) never violates.
// Integer comparison (cur*5 < prev*4) avoids float rounding at the boundary.
export function checkShrink(
  previous: Record<string, number> | null,
  current: Record<string, number>,
): string[] {
  if (previous === null) return [];
  const violations: string[] = [];
  for (const [key, prev] of Object.entries(previous)) {
    const cur = current[key] ?? 0;
    if (cur * 5 < prev * 4) {
      violations.push(`${key}: count dropped from ${prev} to ${cur} — more than the 20% guard allows`);
    }
  }
  return violations;
}
