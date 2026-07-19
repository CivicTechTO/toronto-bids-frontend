// The prepare step: turns a validated ExportDoc into everything the pages need.
// Pure except getPrepared(), which reads the export file once and caches.
import { readFile } from 'node:fs/promises';
import type { AwardRow, CompositeCall, DedupedAward, ExportDoc, Headline, Prepared } from './types';
import { validateExport } from './validate';
import { sumAwardNumeric } from './amounts';
import { dedupeAwards } from './awards';
import { buildSupplierSlugs, wsSlug } from './slugs';
import { buildBridge, buildSupplierRollups } from './links';

function buildCompositeCalls(doc: ExportDoc): CompositeCall[] {
  const byCall = new Map<string, CompositeCall>();
  for (const line of doc.composite_awards) {
    let call = byCall.get(line.call_number);
    if (!call) {
      call = { call_number: line.call_number, reference: null, title: null, lines: [], total: { total: 0, counted: 0, skipped: 0 } };
      byCall.set(line.call_number, call);
    }
    call.lines.push(line);
    call.reference ??= line.reference; // first non-null wins
    call.title ??= line.title;
  }
  const calls = [...byCall.values()].sort((a, b) => a.call_number.localeCompare(b.call_number, 'en-CA'));
  for (const call of calls) {
    call.total = sumAwardNumeric(call.lines.map((l) => ({ numeric: l.award_value_numeric, verdict: null })));
  }
  return calls;
}

// Entity counts (bids = council-nested + solicitation-nested + unlinked).
// Task 11 extracts this contract into guard.ts countsOf and replaces this
// helper with an import; keys and values are identical.
function localCounts(doc: ExportDoc): Record<string, number> {
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

export function prepare(doc: ExportDoc): Prepared {
  const dedupedAwardsByDoc = new Map<string, DedupedAward[]>();
  for (const sol of doc.solicitations) {
    dedupedAwardsByDoc.set(sol.document_number, dedupeAwards(sol.awards));
  }
  // Unlinked awards (document_number matching no exported solicitation) are
  // never silently dropped: group by document_number and dedupe exactly like
  // linked awards, so supplier rollups (sol: null branch, Task 8) and
  // headline.awardedTotal include them. By definition of "unlinked" these
  // keys cannot collide with a solicitation's document_number.
  const unlinkedAwardsByDoc = new Map<string, AwardRow[]>();
  for (const award of doc.unlinked_awards) {
    const group = unlinkedAwardsByDoc.get(award.document_number);
    if (group) group.push(award);
    else unlinkedAwardsByDoc.set(award.document_number, [award]);
  }
  for (const [documentNumber, group] of unlinkedAwardsByDoc) {
    dedupedAwardsByDoc.set(documentNumber, dedupeAwards(group));
  }
  const bridge = buildBridge(doc.council_items);
  const supplierSlugById = buildSupplierSlugs(doc.suppliers);
  // Workspace-number slugs for /noncompetitive/ URLs (wsSlug, Task 7). Two
  // distinct workspace_numbers slugging identically would merge two records'
  // permalinks, so a collision throws naming both — the same fails-loudly
  // class as supplier slug collisions. Duplicate rows of the SAME
  // workspace_number are fine and share a slug.
  const wsSlugByNumber = new Map<string, string>();
  const wsNumberBySlug = new Map<string, string>();
  for (const row of doc.noncompetitive) {
    const slug = wsSlug(row.workspace_number);
    const existing = wsNumberBySlug.get(slug);
    if (existing !== undefined && existing !== row.workspace_number) {
      throw new Error(
        `Workspace slug collision: "${slug}" from workspace_number "${existing}" and workspace_number "${row.workspace_number}"`,
      );
    }
    wsNumberBySlug.set(slug, row.workspace_number);
    wsSlugByNumber.set(row.workspace_number, slug);
  }
  const rollupsBySlug = buildSupplierRollups(doc, supplierSlugById, dedupedAwardsByDoc);
  const councilByRef = new Map(doc.council_items.map((c) => [c.reference, c] as const));
  const solByDoc = new Map(doc.solicitations.map((s) => [s.document_number, s] as const));
  const allDeduped = [...dedupedAwardsByDoc.values()].flat();
  const counts = localCounts(doc);
  const headline: Headline = {
    solicitations: doc.solicitations.length,
    // City-only, deduped, *_numeric only, not_an_award excluded — a machine-parseable undercount.
    awardedTotal: sumAwardNumeric(allDeduped.map((a) => ({ numeric: a.award_amount_numeric, verdict: a.award_amount_verdict }))),
    noncompetitiveTotal: sumAwardNumeric(doc.noncompetitive.map((n) => ({ numeric: n.contract_amount_numeric, verdict: n.contract_amount_verdict }))),
    openCount: doc.solicitations.filter((s) => s.status === 'Open').length,
    bidCount: counts.bids,
    supplierCount: doc.suppliers.length,
  };
  return {
    doc, generatedAt: doc.meta.generated_at, dedupedAwardsByDoc, bridge,
    supplierSlugById, wsSlugByNumber, rollupsBySlug, compositeCalls: buildCompositeCalls(doc),
    councilByRef, solByDoc, headline, counts,
  };
}

let cached: Promise<Prepared> | null = null;

export function getPrepared(): Promise<Prepared> {
  cached ??= (async () => {
    const path = process.env.TB_DATA_FILE ?? '.data/bids.json';
    const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
    return prepare(validateExport(raw));
  })();
  return cached;
}
