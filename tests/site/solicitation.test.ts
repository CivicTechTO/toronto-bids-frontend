import { describe, expect, it } from 'vitest';
import { loadFixture, loadPage } from './helpers';
import { dedupeAwards } from '../../src/prepare/awards';
import { formatCAD } from '../../src/prepare/amounts';
import { TITLE_SOURCE_LABELS } from '../../src/prepare/titles';
import { prepare } from '../../src/prepare/prepare';
import { validateExport } from '../../src/prepare/validate';

const fixture = loadFixture();
const p = prepare(validateExport(fixture));

describe('untitled solicitation', () => {
  const sol = fixture.solicitations.find((s) => s.title === null)!;
  it('is present in the fixture', () => {
    expect(sol).toBeDefined();
  });
  it('constructs a "Doc <n>" heading and shows the no-title-published marker', () => {
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect($('h1').text()).toContain(`Doc ${sol.document_number}`);
    expect($('.untitled-marker').text().toLowerCase()).toContain('no title published');
  });
});

describe('recovered-title provenance badge', () => {
  const sol = fixture.solicitations.find((s) => s.title !== null && s.title_source !== null)!;
  it('shows the title_source label', () => {
    const $ = loadPage(`solicitations/${sol.document_number}`);
    const expected = TITLE_SOURCE_LABELS[sol.title_source!] ?? sol.title_source!;
    expect($('.provenance-badge').text()).toContain(expected);
  });
});

describe('deduped awards with raw AND numeric amounts', () => {
  const sol = fixture.solicitations.find(
    (s) => s.awards.some((a) => a.source === 'odata') && s.awards.some((a) => a.source === 'ckan_awarded'),
  )!;
  const deduped = dedupeAwards(sol.awards);
  it('renders exactly one row per deduped award line (not one per source row)', () => {
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect(deduped.length).toBeLessThan(sol.awards.length);
    expect($('.awards-table tbody tr').length).toBe(deduped.length);
  });
  it('shows raw verbatim and formatted numeric side by side', () => {
    const $ = loadPage(`solicitations/${sol.document_number}`);
    const withNumeric = deduped.find((a) => a.award_amount_numeric !== null);
    if (withNumeric) {
      expect($('.awards-table').text()).toContain(withNumeric.award_amount ?? '');
      expect($('.awards-table').text()).toContain(formatCAD(withNumeric.award_amount_numeric!));
    }
    expect($('.awards-table .amount-raw').length).toBe(deduped.length);
  });
  it('shows a sources badge listing both feeds, odata first', () => {
    const $ = loadPage(`solicitations/${sol.document_number}`);
    const badges = $('.sources-badge')
      .map((_, el) => $(el).text())
      .get();
    expect(badges).toContain('odata + ckan_awarded');
  });
});

describe('bids table', () => {
  it('renders council-bridged bids with an HST basis column', () => {
    const council = fixture.council_items.find((c) =>
      c.bids.some(
        (b) =>
          b.document_number !== null &&
          fixture.solicitations.some((s) => s.document_number === b.document_number),
      ),
    )!;
    const bid = council.bids.find(
      (b) =>
        b.document_number !== null &&
        fixture.solicitations.some((s) => s.document_number === b.document_number),
    )!;
    const $ = loadPage(`solicitations/${bid.document_number}`);
    expect($('.bids-table thead').text()).toContain('HST basis');
    expect($('.bids-table tbody').text()).toContain(bid.bidder_name_raw);
  });
  it('renders solicitation-nested (award_summary) bids', () => {
    const sol = fixture.solicitations.find((s) => s.bids.length > 0)!;
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect($('.bids-table tbody').text()).toContain(sol.bids[0].bidder_name_raw);
  });
  it('the Bids heading counts direct AND bridged bids (not just direct)', () => {
    // Pick a solicitation reached ONLY via the council bridge (0 direct bids), so the
    // heading count must reflect bridged bids. Mirror the page's own allBids computation.
    const doc = fixture.solicitations.find((s) => {
      const refs = p.bridge.docToRefs.get(s.document_number) ?? [];
      const bridged = refs.flatMap((ref) =>
        (p.councilByRef.get(ref)?.bids ?? []).filter((b) => b.document_number === s.document_number),
      );
      return s.bids.length === 0 && bridged.length > 0;
    });
    expect(doc, 'fixture needs a bridged-only solicitation').toBeDefined();
    const refs = p.bridge.docToRefs.get(doc!.document_number) ?? [];
    const total = refs.flatMap((ref) =>
      (p.councilByRef.get(ref)?.bids ?? []).filter((b) => b.document_number === doc!.document_number),
    ).length; // = direct (0) + bridged
    const $ = loadPage(`solicitations/${doc!.document_number}`);
    // If the heading wrongly used sol.bids.length it would show (0) and fail.
    expect($('h2:contains("Bids")').first().text()).toContain(`(${total})`);
  });
  it('reworded empty state does not read as "uncompetitive"', () => {
    // An awarded record with no captured bids (direct or bridged).
    const empty = fixture.solicitations.find(
      (s) => s.status === 'Awarded' && s.bids.length === 0 && s.document_number === '1669551201',
    )!;
    const $ = loadPage(`solicitations/${empty.document_number}`);
    const bids = $('h2:contains("Bids")').first().parent().text();
    expect(bids).toContain('No bid record is captured');
    expect(bids).toContain('not'); // "...not evidence the award was uncompetitive"
    expect(bids).toContain('uncompetitive');
    expect(bids).not.toContain('No bids on record'); // the old, misleading wording
  });
  it('renders a Result column only when the record has named award winners', () => {
    // Fixture-safe: each branch runs only if the fixture has a matching record.
    const withWinners = fixture.solicitations.find(
      (s) => s.bids.length > 0 && dedupeAwards(s.awards).some((a) => a.supplier_name_raw !== null),
    );
    if (withWinners) {
      const $ = loadPage(`solicitations/${withWinners.document_number}`);
      expect($('.bids-table thead').text()).toContain('Result');
    }
    const withoutAwards = fixture.solicitations.find((s) => s.bids.length > 0 && s.awards.length === 0);
    if (withoutAwards) {
      const $ = loadPage(`solicitations/${withoutAwards.document_number}`);
      expect($('.bids-table thead').text()).not.toContain('Result');
      expect($('.bids-table').text()).not.toContain('Winner');
    }
    expect(withWinners ?? withoutAwards, 'fixture has no solicitation with bids').toBeDefined();
  });
});

describe('documents list', () => {
  const solWithAriba = fixture.solicitations.find((s) =>
    s.documents.some((d) => d.source === 'ariba_attachment'),
  )!;
  const solWithUrl = fixture.solicitations.find((s) =>
    s.documents.some((d) => d.source === 'award_summary' || d.source === 'staff_report'),
  )!;
  it('renders ariba_attachment entries with NO anchor and an indexed-not-downloadable note', () => {
    const $ = loadPage(`solicitations/${solWithAriba.document_number}`);
    expect($('.doc-ariba_attachment').length).toBeGreaterThan(0);
    $('.doc-ariba_attachment').each((_, el) => {
      expect($(el).find('a').length).toBe(0);
      expect($(el).text()).toContain('indexed, not downloadable');
    });
  });
  it('links staff_report / award_summary entries to their City URL', () => {
    const doc = solWithUrl.documents.find(
      (d) => d.source === 'award_summary' || d.source === 'staff_report',
    )!;
    const $ = loadPage(`solicitations/${solWithUrl.document_number}`);
    expect($(`.doc-${doc.source} a[href="${doc.url}"]`).length).toBeGreaterThan(0);
  });
  it('renders nested zip-in-zip paths verbatim', () => {
    const nested = fixture.solicitations
      .flatMap((s) => s.documents.map((d) => ({ s, d })))
      .find(({ d }) => d.source === 'ariba_attachment' && d.path.includes('/'))!;
    const $ = loadPage(`solicitations/${nested.s.document_number}`);
    const paths = $('.doc-path').map((_, el) => $(el).text()).get();
    expect(paths).toContain(nested.d.path);
  });
});

describe('primary-source links (#8)', () => {
  it('surfaces the City original-posting link when present', () => {
    const sol = fixture.solicitations.find((s) => s.ariba_posting_link)!;
    expect(sol, 'fixture needs a solicitation with ariba_posting_link').toBeDefined();
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect($(`a[href="${sol.ariba_posting_link}"]`).length).toBeGreaterThan(0);
  });
});
