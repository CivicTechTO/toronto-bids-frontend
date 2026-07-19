import type { Bridge, CouncilItem } from './types.ts';

/**
 * Data rule 3: the five keyspaces never join, but one bridge legitimately
 * exists on the competitive spine — council bids that carry BOTH a council
 * `reference` and a solicitation `document_number`. Bids missing either
 * identifier (e.g. pre-2019 council bids with document_number null)
 * contribute nothing.
 */
export function buildBridge(councilItems: CouncilItem[]): Bridge {
  const refToDoc = new Map<string, string>();
  const docToRefs = new Map<string, string[]>();
  for (const item of councilItems) {
    for (const b of item.bids) {
      if (b.reference === null || b.document_number === null) continue;
      if (!refToDoc.has(b.reference)) refToDoc.set(b.reference, b.document_number);
      const refs = docToRefs.get(b.document_number) ?? [];
      if (!refs.includes(b.reference)) {
        refs.push(b.reference);
        docToRefs.set(b.document_number, refs);
      }
    }
  }
  return { refToDoc, docToRefs };
}
