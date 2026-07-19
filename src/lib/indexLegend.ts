// Legend for the compact single-letter keys used in the public /indexes/*.json files
// (#12). The same letter can mean different things in different indexes (e.g. `r` is
// rfx_type for solicitations but the sole-source reason for non-competitive), so the
// legend is per file. Source of truth for the KEYS is src/prepare/indexes.ts; a test
// (tests/prepare/indexLegend.test.ts) rebuilds each index and fails if the documented
// keys drift from what the builders actually emit.

export interface IndexLegend {
  /** Path under the site root. */
  file: string;
  entity: string;
  /** key -> plain-language meaning, in row order. */
  keys: Record<string, string>;
}

export const INDEX_LEGENDS: IndexLegend[] = [
  {
    file: 'indexes/solicitations.json',
    entity: 'Solicitations',
    keys: {
      d: 'document_number',
      t: 'title (display text; constructed when u is true)',
      u: 'untitled — the City published no title, so t is constructed',
      s: 'status',
      r: 'rfx_type',
      c: 'category (normalized)',
      v: 'division',
      y: 'issue year',
      dl: 'submission deadline (ISO date, or null)',
      a: 'awarded total, machine-parseable $ (null when no award)',
      nb: 'number of bids on record',
      nd: 'number of documents',
    },
  },
  {
    file: 'indexes/suppliers.json',
    entity: 'Suppliers',
    keys: {
      g: 'slug (the supplier’s URL id)',
      n: 'display name',
      na: 'number of awards',
      nb: 'number of bids',
      a: 'City awards total, machine-parseable $ (null when none)',
    },
  },
  {
    file: 'indexes/noncompetitive.json',
    entity: 'Non-competitive',
    keys: {
      w: 'workspace_number',
      wl: 'workspace slug (the URL id)',
      n: 'supplier name (raw)',
      r: 'reason for sole-sourcing',
      v: 'division',
      y: 'contract year (or null)',
      a: 'contract amount, machine-parseable $ (or null)',
    },
  },
  {
    file: 'indexes/council.json',
    entity: 'Council items',
    keys: {
      f: 'reference (YYYY.CCNN.N)',
      t: 'title (or null)',
      y: 'reference year',
      nb: 'number of bids',
    },
  },
];
