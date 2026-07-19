// Samples a full bids.json export down to a small committed fixture
// (tests/fixtures/bids.fixture.json) by CRITERIA — never by hardcoded IDs — so
// it can be regenerated from any sufficiently fresh export. Deterministic for a
// given input file: selection is first-match over the export's own (ORDER BY)
// array order. Requires an export produced AFTER backend issues #144
// (supplier_key) and #145 (solicitations[].bids + unlinked_bids); validateExport
// enforces both on the input.
//
// Usage (frontend repo root): node scripts/make-fixture.ts .data/bids.json

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateExport } from '../src/prepare/validate.ts';
import type {
  Buyer,
  CompositeAward,
  CouncilItem,
  ExportDoc,
  Solicitation,
} from '../src/prepare/types.ts';

const OUT = 'tests/fixtures/bids.fixture.json';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('usage: node scripts/make-fixture.ts <path-to-full-export>');
  process.exit(1);
}

const doc: ExportDoc = validateExport(JSON.parse(readFileSync(inputPath, 'utf8')));

const solByDoc = new Map<string, Solicitation>(doc.solicitations.map((s) => [s.document_number, s]));
const councilByRef = new Map<string, CouncilItem>(doc.council_items.map((c) => [c.reference, c]));

const report: string[] = [];
const missing: string[] = [];
const pickedDocs = new Set<string>();
const pickedRefs = new Set<string>();

function pickSol(label: string, required: boolean, pred: (s: Solicitation) => boolean): void {
  const found = doc.solicitations.find(pred);
  if (found) {
    pickedDocs.add(found.document_number);
    report.push(`${label}: solicitation ${found.document_number}`);
  } else if (required) {
    missing.push(label);
  } else {
    report.push(`${label}: none in source (skipped)`);
  }
}

// --- Solicitation criteria ---
pickSol('untitled with dual-source awards', true, (s) =>
  s.title === null
  && s.awards.some((a) => a.source === 'odata')
  && s.awards.some((a) => a.source === 'ckan_awarded'));
pickSol('titled with recovered title_source', true, (s) => s.title !== null && s.title_source !== null);
pickSol('ariba_attachment document with nested (zip-in-zip) path', true, (s) =>
  s.documents.some((d) => d.source === 'ariba_attachment' && d.path.includes('/')));
pickSol('award_summary/staff_report document with a live URL', true, (s) =>
  s.documents.some((d) => (d.source === 'award_summary' || d.source === 'staff_report') && d.url !== null));
pickSol('Open with an Ariba posting', true, (s) => s.status === 'Open' && s.ariba_postings.length > 0);
pickSol('solicitation-nested award_summary bids (#145)', true, (s) => s.bids.length > 0);
pickSol('award row with a human verdict', false, (s) => s.awards.some((a) => a.award_amount_verdict != null));

// --- Council items ---
// Bridged item with mixed hst_basis: among qualifying items, take the one whose
// bids reference the fewest distinct existing solicitations (keeps the closure
// small); tie-break on reference for determinism.
function referencedDocs(c: CouncilItem): Set<string> {
  const s = new Set<string>();
  for (const b of c.bids) {
    if (b.document_number !== null && solByDoc.has(b.document_number)) s.add(b.document_number);
  }
  return s;
}
function bySmallestClosure(a: CouncilItem, b: CouncilItem): number {
  return referencedDocs(a).size - referencedDocs(b).size
    || (a.reference < b.reference ? -1 : a.reference > b.reference ? 1 : 0);
}
const bridging = doc.council_items.filter((c) => referencedDocs(c).size > 0);
// Preferred: a single council item whose OWN bids carry both hst_basis values.
// Empirically (verified against the live export, see task-3-report.md), hst_basis
// is a per-report-table convention — every bid nested under one council item
// shares one basis, even across items with multiple background_pdfs — so no
// item ever satisfies this within a single regenerated export. Kept as the
// first-choice branch so a future export that DOES contain such an item is
// picked automatically; falls back to a bridged item with a known (non-null)
// hst_basis so the HST-basis display path is still exercised deterministically.
const mixedQualifying = bridging
  .filter((c) => c.bids.some((b) => b.hst_basis === 'including') && c.bids.some((b) => b.hst_basis === 'excluding'))
  .sort(bySmallestClosure);
const knownBasisQualifying = bridging
  .filter((c) => c.bids.some((b) => b.hst_basis === 'including' || b.hst_basis === 'excluding'))
  .sort(bySmallestClosure);
const bridged = mixedQualifying[0] ?? knownBasisQualifying[0];
if (bridged) {
  pickedRefs.add(bridged.reference);
  if (mixedQualifying[0] === bridged) {
    report.push(`council item with mixed hst_basis bridged to solicitation(s): ${bridged.reference}`);
  } else {
    const bases = [...new Set(bridged.bids.map((b) => b.hst_basis))].filter((b) => b !== null).join(',');
    report.push(
      `council item with mixed hst_basis bridged to solicitation(s): none in source (hst_basis is per-report-table, `
      + `never mixed within one item in this export) — fell back to single-basis bridged item ${bridged.reference} (hst_basis=${bases})`,
    );
  }
} else {
  missing.push('council item with mixed hst_basis bridged to a solicitation (no single-basis bridged fallback available either)');
}

const pre2019 = doc.council_items.find((c) =>
  Number(c.reference.slice(0, 4)) < 2019
  && c.bids.length > 0
  && c.bids.every((b) => b.document_number === null));
if (pre2019) {
  pickedRefs.add(pre2019.reference);
  report.push(`pre-2019 council item, bids without document_number: ${pre2019.reference}`);
} else {
  missing.push('pre-2019 council item whose bids have document_number: null');
}

// suspended_firm.council_authority -> council_item closure (graceful when the
// authority string does not resolve to a council reference in the export).
for (const firm of doc.suspended_firms) {
  const auth = firm.council_authority;
  if (auth === null) continue;
  const ref = councilByRef.has(auth) ? auth : (auth.match(/\d{4}\.[A-Z]{1,3}\d+\.\d+/)?.[0] ?? null);
  if (ref !== null && councilByRef.has(ref)) {
    pickedRefs.add(ref);
    report.push(`council item cited by suspended firm "${firm.supplier_name_raw}": ${ref}`);
  }
}

// --- Referential closure: every solicitation referenced by an included council
// item's bids (and existing in the export) is included, so council->solicitation
// links inside the fixture site always resolve. ---
for (const ref of pickedRefs) {
  const item = councilByRef.get(ref);
  if (!item) continue;
  for (const d of referencedDocs(item)) pickedDocs.add(d);
}

// --- Non-competitive: prefer a row with a stated reason and a parsed amount ---
const nc = doc.noncompetitive.find((n) => n.reason !== null && n.contract_amount_numeric !== null)
  ?? doc.noncompetitive[0];
if (nc) report.push(`noncompetitive: ${nc.workspace_number}`);
else missing.push('one noncompetitive row');

// --- Composite call with >=2 distinct winners (first in call_number order) ---
const byCall = new Map<string, CompositeAward[]>();
for (const line of doc.composite_awards) {
  const arr = byCall.get(line.call_number) ?? [];
  arr.push(line);
  byCall.set(line.call_number, arr);
}
let compositeLines: CompositeAward[] = [];
for (const [call, lines] of byCall) {
  if (new Set(lines.map((l) => l.supplier_name_raw)).size >= 2) {
    compositeLines = lines;
    report.push(`composite call with >=2 winners: ${call} (${lines.length} lines)`);
    break;
  }
}
if (compositeLines.length === 0) missing.push('composite call with >=2 winners');

if (missing.length > 0) {
  console.error('STOP: could not satisfy required fixture criteria:\n- ' + missing.join('\n- '));
  process.exit(1);
}

// --- Assemble output arrays, preserving the export's own deterministic order ---
const solicitations = doc.solicitations.filter((s) => pickedDocs.has(s.document_number));
const councilItems = doc.council_items.filter((c) => pickedRefs.has(c.reference));
const noncompetitive = nc ? [nc] : [];
const suspendedFirms = doc.suspended_firms;
const capitalProjects = doc.capital_projects.slice(0, 3);
const unlinkedPostings = doc.unlinked_ariba_postings.slice(0, 2);

// --- Synthetic buyers (the real export's buyers array is empty today) ---
const SEEN = '2026-07-18T00:00:00';
const buyers: Buyer[] = [
  {
    slug: 'toronto-zoo-test',
    name: 'Toronto Zoo (synthetic test buyer)',
    kind: 'agency',
    partnered: 0,
    funding_share: null,
    platform: 'bidsandtenders',
    notes: 'Synthetic fixture row for empty-state buyer pages. Not real data.',
    first_seen: SEEN,
    last_seen: SEEN,
    solicitations: [],
    awards: [],
    bids: [],
  },
  {
    slug: 'trca-test',
    name: 'Toronto and Region Conservation Authority (synthetic test buyer)',
    kind: 'agency',
    partnered: 1,
    funding_share: 0.626,
    platform: 'city_partnered',
    notes: 'Synthetic fixture row: partnered buyer with a confidential-value award. Not real data.',
    first_seen: SEEN,
    last_seen: SEEN,
    solicitations: [{
      native_ref: 'TRCA-2026-001',
      title: 'Erosion control works (synthetic)',
      status: 'Closed',
      posted_date: '2026-06-01',
      closing_date: '2026-06-20',
      portal_url: null,
      source: 'synthetic',
      first_seen: SEEN,
      last_seen: SEEN,
    }],
    awards: [{
      native_ref: 'TRCA-2026-001',
      supplier_name_raw: 'Synthetic Shoreline Contracting Inc.',
      supplier_id: null,
      award_amount: null,
      award_amount_numeric: null,
      value_confidential: 1,
      award_date: '2026-07-02',
      report_url: null,
      source: 'synthetic',
      first_seen: SEEN,
      last_seen: SEEN,
    }],
    bids: [],
  },
];

// --- Supplier closure: every supplier_id referenced by any included row ---
const supplierIds = new Set<number>();
function addId(id: number | null): void {
  if (id !== null) supplierIds.add(id);
}
for (const s of solicitations) {
  for (const a of s.awards) addId(a.supplier_id);
  for (const b of s.bids) addId(b.supplier_id);
}
for (const c of councilItems) for (const b of c.bids) addId(b.supplier_id);
for (const n of noncompetitive) addId(n.supplier_id);
for (const l of compositeLines) addId(l.supplier_id);
for (const f of suspendedFirms) addId(f.supplier_id);
const suppliers = doc.suppliers.filter((s) => supplierIds.has(s.supplier_id));

const fixture: ExportDoc = {
  meta: {
    generated_at: doc.meta.generated_at,
    counts: {}, // recomputed below from the fixture's own arrays
    sources: doc.meta.sources.slice(0, 3),
  },
  solicitations,
  noncompetitive,
  suspended_firms: suspendedFirms,
  suppliers,
  capital_projects: capitalProjects,
  composite_awards: compositeLines,
  council_items: councilItems,
  unlinked_ariba_postings: unlinkedPostings,
  unlinked_awards: [],
  unlinked_bids: [],
  buyers,
};

// meta.counts mirrors the backend's 16 sqlite table names (db.counts), recomputed
// so count-based UI and tests over the fixture stay truthful.
function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}
fixture.meta.counts = {
  solicitation: fixture.solicitations.length,
  award: sum(fixture.solicitations.map((s) => s.awards.length)) + fixture.unlinked_awards.length,
  noncompetitive: fixture.noncompetitive.length,
  ariba_posting: sum(fixture.solicitations.map((s) => s.ariba_postings.length)) + fixture.unlinked_ariba_postings.length,
  suspended_firm: fixture.suspended_firms.length,
  supplier: fixture.suppliers.length,
  capital_project: fixture.capital_projects.length,
  bid: sum(fixture.council_items.map((c) => c.bids.length)) + sum(fixture.solicitations.map((s) => s.bids.length)) + fixture.unlinked_bids.length,
  council_item: fixture.council_items.length,
  background_pdf: sum(fixture.council_items.map((c) => c.background_pdfs.length)),
  composite_award: fixture.composite_awards.length,
  sync_run: fixture.meta.sources.length,
  buyer: fixture.buyers.length,
  agency_solicitation: sum(fixture.buyers.map((b) => b.solicitations.length)),
  agency_award: sum(fixture.buyers.map((b) => b.awards.length)),
  agency_bid: sum(fixture.buyers.map((b) => b.bids.length)),
};

validateExport(fixture); // throws ExportShapeError if the fixture itself is malformed

for (const line of report) console.log(line);
console.log('fixture passes validateExport');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n');
console.log(
  `wrote ${OUT} — ${fixture.solicitations.length} solicitations, ${fixture.council_items.length} council items, `
  + `${fixture.noncompetitive.length} noncompetitive, ${fixture.composite_awards.length} composite lines, `
  + `${fixture.suspended_firms.length} suspended firms, ${fixture.capital_projects.length} capital projects, `
  + `${fixture.suppliers.length} suppliers, ${fixture.buyers.length} buyers`,
);
