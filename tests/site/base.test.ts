import { describe, expect, it } from 'vitest';
import { loadFile, loadFixture, loadPage } from './helpers';

describe('home page', () => {
  it('shows headline stats labeled City-only with the undercount caveat', () => {
    const $ = loadPage('');
    expect($('.stats-strip').length).toBe(1);
    expect($('.stats-caveat').text()).toContain('City records only');
    expect($('.stats-caveat').text()).toContain('undercount');
  });
  it('shows the freshness date from meta.generated_at in the footer', () => {
    const $ = loadPage('');
    // Visible label is human-formatted; the raw ISO stays machine-readable on <time>.
    expect($('footer').text()).toContain('Data as of');
    expect($('footer time').attr('datetime')).toBe(loadFixture().meta.generated_at);
  });
  it('has a search form pointing at /search/', () => {
    const $ = loadPage('');
    expect($('form[role="search"]').attr('action')).toBe('/search/');
  });
  it('links every spec page so none is orphaned', () => {
    const $ = loadPage('');
    for (const path of ['/calls/', '/capital-projects/', '/suspended-firms/', '/buyers/']) {
      expect($(`a[href="${path}"]`).length, `missing home link to ${path}`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('footer on every page', () => {
  for (const page of ['', 'about']) {
    it(`renders "Data as of" and a /data/ link on /${page}`, () => {
      const $ = loadPage(page);
      expect($('footer').text()).toContain('Data as of');
      expect($('footer a[href="/data/"]').length).toBe(1);
    });
  }
  it('renders "Data as of" on the 404 page', () => {
    expect(loadFile('404.html')).toContain('Data as of');
  });
});

describe('404 page', () => {
  it('explains the five keyspaces and offers search', () => {
    const html = loadFile('404.html');
    expect(html).toContain('document number');
    expect(html).toContain('workspace number');
    expect(html).toContain('call number');
    expect(html).toContain('council reference');
    expect(html).toContain('role="search"');
  });
});

describe('counts.json', () => {
  it('parses with the expected count keys', () => {
    const counts = JSON.parse(loadFile('counts.json')) as Record<string, number>;
    for (const key of [
      'solicitations',
      'awards',
      'bids',
      'noncompetitive',
      'suppliers',
      'council_items',
      'composite_awards',
    ]) {
      expect(counts, `missing key ${key}`).toHaveProperty(key);
      expect(typeof counts[key]).toBe('number');
    }
  });
});
