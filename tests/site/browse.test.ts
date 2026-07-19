import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPage } from './helpers';

const ENDPOINTS: { file: string; keys: string[] }[] = [
  { file: 'indexes/solicitations.json', keys: ['d', 't', 'u', 's', 'r', 'c', 'v', 'y', 'dl', 'a', 'nb', 'nd'] },
  { file: 'indexes/suppliers.json', keys: ['g', 'n', 'na', 'nb', 'a'] },
  { file: 'indexes/noncompetitive.json', keys: ['w', 'wl', 'n', 'r', 'v', 'y', 'a'] },
  { file: 'indexes/council.json', keys: ['f', 't', 'y', 'nb'] },
];

describe('JSON index endpoints', () => {
  for (const { file, keys } of ENDPOINTS) {
    it(`${file} is parseable JSON whose rows carry the compact keys`, () => {
      const raw = readFileSync(join('dist', file), 'utf8');
      const rows = JSON.parse(raw);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(Object.keys(rows[0]), `${file} row missing key "${key}"`).toContain(key);
      }
    });
  }
});

const BROWSE_PAGES = [
  { path: 'solicitations', index: 'indexes/solicitations.json' },
  { path: 'suppliers', index: 'indexes/suppliers.json' },
  { path: 'noncompetitive', index: 'indexes/noncompetitive.json' },
  { path: 'council', index: 'indexes/council.json' },
];

describe('browse pages', () => {
  for (const { path, index } of BROWSE_PAGES) {
    it(`/${path}/ mounts the BrowseTable island pointing at ${index}`, () => {
      const $ = loadPage(path);
      const island = $('astro-island[client="load"]');
      expect(island.length).toBeGreaterThanOrEqual(1);
      expect(island.attr('props') ?? '').toContain(index);
    });

    it(`/${path}/ contains a noscript static fallback table`, () => {
      const raw = readFileSync(join('dist', path, 'index.html'), 'utf8');
      expect(raw).toMatch(/<noscript>[\s\S]*?<table[\s\S]*?<\/noscript>/);
    });
  }
});

describe('solicitations facets', () => {
  it('/solicitations/ prerenders all six facet controls in the island', () => {
    const $ = loadPage('solicitations');
    const labels = $('astro-island label').text();
    for (const facet of ['Status', 'Type', 'Category', 'Division', 'Year', 'Has documents']) {
      expect(labels, `missing facet control "${facet}"`).toContain(facet);
    }
    expect($('astro-island input[type="checkbox"]').length).toBe(1);
  });
});
