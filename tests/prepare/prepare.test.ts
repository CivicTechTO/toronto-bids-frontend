import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ExportDoc, Prepared } from '../../src/prepare/types';
import { validateExport } from '../../src/prepare/validate';
import { wsSlug } from '../../src/prepare/slugs';
import { getPrepared, prepare } from '../../src/prepare/prepare';

const FIXTURE = 'tests/fixtures/bids.fixture.json';

describe('prepare() over the committed fixture', () => {
  let doc: ExportDoc;
  let p: Prepared;

  beforeAll(() => {
    doc = validateExport(JSON.parse(readFileSync(FIXTURE, 'utf8')));
    p = prepare(doc);
  });

  it('carries generatedAt from meta', () => {
    expect(p.generatedAt).toBe(doc.meta.generated_at);
  });

  it('lookup map sizes match the export arrays', () => {
    expect(p.solByDoc.size).toBe(doc.solicitations.length);
    expect(p.councilByRef.size).toBe(doc.council_items.length);
    // One (possibly empty) deduped-awards entry per solicitation, PLUS one
    // per distinct unlinked-award document_number — the unlinked_awards
    // bucket is never silently dropped (the fixture ships it empty, so the
    // two terms are equal there; the formula holds for real data too).
    expect(p.dedupedAwardsByDoc.size).toBe(
      doc.solicitations.length + new Set(doc.unlinked_awards.map((a) => a.document_number)).size,
    );
    expect(p.supplierSlugById.size).toBe(doc.suppliers.length);
    expect(p.wsSlugByNumber.size).toBe(new Set(doc.noncompetitive.map((n) => n.workspace_number)).size);
    // One rollup per supplier — supplier pages exist for every supplier.
    expect(p.rollupsBySlug.size).toBe(doc.suppliers.length);
  });

  it('dedupe never increases row counts and collapses dual-source groups', () => {
    for (const sol of doc.solicitations) {
      const rows = p.dedupedAwardsByDoc.get(sol.document_number)!;
      expect(rows.length).toBeLessThanOrEqual(sol.awards.length);
    }
    // The fixture is required to contain a dual-source (odata + ckan_awarded) award.
    const collapsed = [...p.dedupedAwardsByDoc.values()].flat().filter((a) => a.sources.length > 1);
    expect(collapsed.length).toBeGreaterThan(0);
  });

  it('compositeCalls group every line exactly once, sorted by call_number', () => {
    const lineTotal = p.compositeCalls.reduce((n, c) => n + c.lines.length, 0);
    expect(lineTotal).toBe(doc.composite_awards.length);
    const callNumbers = p.compositeCalls.map((c) => c.call_number);
    expect(callNumbers).toEqual([...callNumbers].sort((a, b) => a.localeCompare(b, 'en-CA')));
    expect(new Set(callNumbers).size).toBe(callNumbers.length);
  });

  it('headline is consistent with the document', () => {
    expect(p.headline.solicitations).toBe(doc.solicitations.length);
    expect(p.headline.supplierCount).toBe(doc.suppliers.length);
    expect(p.headline.openCount).toBe(doc.solicitations.filter((s) => s.status === 'Open').length);
    const solBids = doc.solicitations.reduce((n, s) => n + s.bids.length, 0);
    const councilBids = doc.council_items.reduce((n, c) => n + c.bids.length, 0);
    expect(p.headline.bidCount).toBe(solBids + councilBids + doc.unlinked_bids.length);
    const dedupedRows = [...p.dedupedAwardsByDoc.values()].flat();
    expect(dedupedRows.length).toBeGreaterThan(0);
    expect(p.headline.awardedTotal.counted + p.headline.awardedTotal.skipped).toBe(dedupedRows.length);
    expect(p.headline.awardedTotal.total).toBeGreaterThanOrEqual(0);
    expect(p.headline.noncompetitiveTotal.counted + p.headline.noncompetitiveTotal.skipped)
      .toBe(doc.noncompetitive.length);
  });

  it('counts agree with headline and export arrays', () => {
    expect(p.counts.solicitations).toBe(doc.solicitations.length);
    expect(p.counts.bids).toBe(p.headline.bidCount);
    expect(p.counts.suppliers).toBe(doc.suppliers.length);
    expect(p.counts.council_items).toBe(doc.council_items.length);
    expect(p.counts.composite_awards).toBe(doc.composite_awards.length);
    expect(p.counts.noncompetitive).toBe(doc.noncompetitive.length);
  });

  it('maps every workspace_number to its wsSlug URL slug', () => {
    expect(doc.noncompetitive.length).toBeGreaterThan(0); // fixture guarantee (Task 3)
    for (const row of doc.noncompetitive) {
      expect(p.wsSlugByNumber.get(row.workspace_number)).toBe(wsSlug(row.workspace_number));
    }
  });

  it('throws on a workspace slug collision, naming BOTH workspace_numbers', () => {
    const ncRow = (workspace_number: string): ExportDoc['noncompetitive'][number] => ({
      workspace_number, supplier_name_raw: 'Acme Ltd', supplier_id: null, reason: 'Sole source',
      contract_amount: '$1.00', contract_amount_numeric: 1, contract_amount_labelled: null,
      contract_amount_verdict: null, contract_date: '2021-01-01', division: null,
      council_authority_link: null, source: 'ckan', first_seen: '2026-01-01', last_seen: '2026-07-18',
    });
    const clone = structuredClone(doc);
    clone.noncompetitive.push(ncRow('WS 100'), ncRow('WS  100')); // both slug to "WS-100"
    expect(() => prepare(clone)).toThrowError(
      'Workspace slug collision: "WS-100" from workspace_number "WS 100" and workspace_number "WS  100"',
    );
  });

  it('routes unlinked_awards through dedupeAwards into dedupedAwardsByDoc', () => {
    const clone = structuredClone(doc);
    const unlinked: ExportDoc['unlinked_awards'][number] = {
      document_number: '8888888888', supplier_name_raw: 'Orphan Paving Ltd', supplier_id: null,
      award_amount: '$500.00', award_amount_numeric: 500, award_amount_labelled: null,
      award_amount_verdict: null, award_date: '2024-01-01', source: 'ckan_awarded',
      first_seen: '2026-01-01', last_seen: '2026-07-18',
    };
    clone.unlinked_awards.push(unlinked, { ...unlinked, source: 'odata' });
    const p2 = prepare(clone);
    const rows = p2.dedupedAwardsByDoc.get('8888888888')!;
    expect(rows).toHaveLength(1); // the dual-source pair collapses like any linked award group
    expect(rows[0]!.sources).toEqual(['odata', 'ckan_awarded']); // odata-first ordering (Task 5)
    expect(p2.dedupedAwardsByDoc.size).toBe(
      clone.solicitations.length + new Set(clone.unlinked_awards.map((a) => a.document_number)).size,
    );
  });
});

describe('getPrepared()', () => {
  it('loads TB_DATA_FILE, validates, prepares, and caches', async () => {
    process.env.TB_DATA_FILE = FIXTURE;
    const a = await getPrepared();
    const b = await getPrepared();
    expect(b).toBe(a); // cached: same object, no re-read
    expect(a.generatedAt).toBeTruthy();
    expect(a.solByDoc.size).toBeGreaterThan(0);
  });
});
