import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadPage } from './helpers';
import type { ExportDoc } from '../../src/prepare/types';

const fx = JSON.parse(
  readFileSync('tests/fixtures/bids.fixture.json', 'utf8'),
) as ExportDoc;

// Fixture guarantees (Task 3 criteria): synthetic buyers exist.
const zoo = fx.buyers.find((b) => b.slug === 'toronto-zoo-test')!;
const partnered = fx.buyers.find((b) => b.partnered === 1)!;
const confidentialAward = partnered.awards.find(
  (a) => a.value_confidential === 1,
)!;

describe('/buyers/ index', () => {
  it('clarifies City divisions live under Solicitations/Suppliers, not here (#13)', () => {
    const $ = loadPage('buyers');
    // Scope to the intro paragraph — the Base header nav links to these routes on
    // every page, so a document-wide selector would pass without the clarification.
    const intro = $('p:contains("divisions")');
    expect(intro.length).toBeGreaterThanOrEqual(1);
    expect(intro.find('a[href="/solicitations/"]').length).toBeGreaterThanOrEqual(1);
    expect(intro.find('a[href="/suppliers/"]').length).toBeGreaterThanOrEqual(1);
  });

  it('lists every buyer with a partnered marker and keyspace separation note', () => {
    const $ = loadPage('buyers');
    for (const b of fx.buyers) {
      expect($(`a[href$="/buyers/${b.slug}/"]`).length).toBe(1);
    }
    const text = $('body').text();
    expect(text).toContain('Partnered');
    expect(text).toContain('never merged into City headline numbers');
  });
});

describe('/buyers/{slug}/ pages', () => {
  it('renders honest empty states for sections with no records', () => {
    const $ = loadPage(`buyers/${zoo.slug}`);
    const text = $('body').text();
    expect($('h1').length).toBe(1);
    expect($('h1').first().text()).toBe(zoo.name);
    expect(text).toContain('Captured since');
    const sections: Array<[number, string]> = [
      [zoo.solicitations.length, 'No contract solicitations captured in this export'],
      [zoo.awards.length, 'No contract awards captured in this export'],
      [zoo.bids.length, 'No bids captured in this export'],
    ];
    for (const [count, msg] of sections) {
      if (count === 0) expect(text).toContain(msg);
    }
  });

  it('shows the partnered badge and funding share on a partnered buyer', () => {
    const $ = loadPage(`buyers/${partnered.slug}`);
    const text = $('body').text();
    expect(text).toContain('Partnered');
    expect(text).toContain(
      `${(partnered.funding_share! * 100).toFixed(1)}%`,
    );
  });

  it('renders confidential award values as withheld, not as amounts', () => {
    const $ = loadPage(`buyers/${partnered.slug}`);
    const text = $('body').text();
    expect(text).toContain('value withheld (confidential attachment)');
    expect(text).toContain(confidentialAward.native_ref);
  });
});


describe('portal-only and publication-only buyers', () => {
  it('counts the new records separately from contract records on the buyer index', () => {
    const $ = loadPage('buyers');
    const library = $('tr').filter((_, row) => $(row).find('a[href$="/buyers/library-test/"]').length > 0);
    expect(library.find('td').map((_, el) => $(el).text()).get().slice(3)).toEqual(['0', '2', '0', '0', '0']);
    const waterfront = $('tr').filter((_, row) => $(row).find('a[href$="/buyers/waterfront-test/"]').length > 0);
    expect(waterfront.find('td').map((_, el) => $(el).text()).get().slice(3)).toEqual(['0', '0', '0', '2', '0']);
  });

  it('renders distinct portal postings even when references repeat', () => {
    const $ = loadPage('buyers/library-test');
    const section = $('#portal-listings');
    expect(section.find('tbody tr').length).toBe(2);
    expect(section.find('a[href="https://example.org/opportunities/1"]').length).toBe(1);
    expect(section.find('a[href="https://example.org/opportunities/2"]').length).toBe(1);
    expect(section.text()).toContain('Library procurement 1');
    expect($('body').text()).not.toContain('no solicitations posted yet');
  });

  it('shows published claims with their original evidence, month, labels and source links', () => {
    const $ = loadPage('buyers/waterfront-test');
    const section = $('#published-awards');
    expect(section.find('tbody tr').length).toBe(2);
    const text = section.text();
    for (const expected of ['Published supplier 1', 'Published contract 1', '$123,456', '2026-09', 'Original source evidence 1', 'Non-competitive', 'Value not disclosed']) {
      expect(text).toContain(expected);
    }
    expect(section.find('a[href="https://example.org/awarded-contracts"]').length).toBe(2);
    expect(text).toContain('publication month');
    expect($('body').text()).not.toContain('no awards published yet');
    expect($('#award-publications tbody tr').length).toBe(3);
    expect($('#award-publications').text()).toContain('Original source evidence 3');
  });
});
