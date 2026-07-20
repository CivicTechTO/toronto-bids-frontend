import { describe, expect, it } from 'vitest';
import { loadPage } from './helpers';
import { TORONTO_BIDS_PORTAL } from '../../src/lib/sources';
import { GLOSSARY } from '../../src/lib/glossary';

// #10 — the site must read as a historical archive, not a live tenders board.
describe('archive framing (#10)', () => {
  for (const page of ['', 'solicitations', 'about']) {
    it(`shows the historical-archive banner linking the live portal on /${page}`, () => {
      const $ = loadPage(page);
      const banner = $('.archive-banner');
      expect(banner.length).toBe(1);
      expect(banner.text().toLowerCase()).toContain('historical');
      expect(banner.find(`a[href="${TORONTO_BIDS_PORTAL}"]`).length).toBe(1);
    });
  }

  it('relabels the Open stat so it does not read as live opportunities', () => {
    const $ = loadPage('');
    // The "historical, not live" framing lives in the site-wide banner (tested above)
    // and the stat label itself — the stat is no longer captioned "Open solicitations".
    expect($('.stats-strip').text()).toContain('Last recorded as Open');
    expect($('.stats-strip').text()).not.toContain('Open solicitations');
  });

  it('flags a record still marked Open whose deadline has passed', () => {
    // Fixture doc 5274436439 is Open with a deadline before the snapshot date.
    const $ = loadPage('solicitations/5274436439');
    expect($('.status-expired').length).toBe(1);
    expect($('.deadline-expired').text()).toContain('passed');
    expect($('.deadline-expired-note').length).toBe(1);
    expect($('.deadline-expired-note').text()).toContain('not an opportunity you can bid on');
  });

  it('does NOT flag a settled (Awarded) record as expired', () => {
    const $ = loadPage('solicitations/0101110129');
    expect($('.status-expired').length).toBe(0);
    expect($('.deadline-expired').length).toBe(0);
    expect($('.deadline-expired-note').length).toBe(0);
  });
});

// #11 — a plain-language layer for non-technical visitors.
describe('plain-language layer (#11)', () => {
  it('publishes a glossary page defining every term with a citable anchor', () => {
    const $ = loadPage('glossary');
    expect($('h1').first().text()).toBe('Glossary');
    for (const e of GLOSSARY) {
      expect($(`#${e.id}`).length, `missing anchor #${e.id}`).toBe(1);
      expect($(`#${e.id}`).text()).toContain(e.term);
    }
  });

  it('links terms in browse copy to the glossary with a hover definition', () => {
    const $ = loadPage('solicitations');
    const term = $('a.term[href="/glossary/#solicitation"]');
    expect(term.length).toBeGreaterThanOrEqual(1);
    expect(term.first().attr('title')?.length ?? 0).toBeGreaterThan(0);
  });

  it('reaches the glossary from the site chrome (header and footer)', () => {
    const $ = loadPage('');
    expect($(`header a[href="/glossary/"]`).length).toBeGreaterThanOrEqual(1);
    expect($(`footer a[href="/glossary/"]`).length).toBeGreaterThanOrEqual(1);
  });

  it('keeps identifier-system jargon out of the public browse copy', () => {
    for (const page of [
      'solicitations',
      'suppliers',
      'noncompetitive',
      'council',
      'calls',
      'buyers',
    ]) {
      const bodyText = loadPage(page)('main').text().toLowerCase();
      expect(bodyText, `"keyspace" leaked into /${page}`).not.toContain('keyspace');
    }
  });

  it('offers a citizen-oriented "Start here" with question-shaped entry points', () => {
    const $ = loadPage('');
    const startHere = $('.start-here');
    expect(startHere.length).toBe(1);
    expect(startHere.find('h2').text()).toContain('Start here');
    for (const path of [
      '/suppliers/?sort=a.desc',
      '/noncompetitive/?sort=a.desc',
      '/solicitations/?sole=yes',
    ]) {
      expect(startHere.find(`a[href="${path}"]`).length, `missing ${path}`).toBe(1);
    }
    expect(startHere.find('a[href="/glossary/"]').length).toBe(1);
  });
});
