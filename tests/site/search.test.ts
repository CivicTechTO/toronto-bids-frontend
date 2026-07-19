import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPage } from './helpers';

function firstIndexRow(file: string): Record<string, any> {
  return JSON.parse(readFileSync(join('dist', 'indexes', file), 'utf8'))[0];
}

describe('build chaining (created in Task 1, verified here)', () => {
  it('pagefind ran after astro build and emitted its UI bundle', () => {
    expect(existsSync(join('dist', 'pagefind', 'pagefind-ui.js'))).toBe(true);
    expect(existsSync(join('dist', 'pagefind', 'pagefind-ui.css'))).toBe(true);
  });
});

describe('search page', () => {
  it('has the PagefindUI mount, a hidden dev fallback, and a noscript pointer to browse pages', () => {
    const $ = loadPage('search');
    expect($('#search').length).toBe(1);
    expect($('#search-fallback[hidden]').length).toBe(1);
    const raw = readFileSync(join('dist', 'search', 'index.html'), 'utf8');
    expect(raw).toContain('<noscript>');
    expect(raw).toContain('solicitations/');
  });

  it('carries ?q= from the home/404 search forms into the Pagefind input', () => {
    // The page script (inlined or bundled to a file by Astro) must read ?q=
    // and feed it to PagefindUI's input. Both markers survive esbuild
    // minification: one is a global identifier, the other a string literal.
    const $ = loadPage('search');
    let scriptText = $('script:not([src])').text();
    $('script[src]').each((_, el) => {
      const src = ($(el).attr('src') ?? '').replace(/^\//, '');
      const file = join('dist', src);
      if (existsSync(file)) scriptText += readFileSync(file, 'utf8');
    });
    expect(scriptText).toContain('URLSearchParams');
    expect(scriptText).toContain('pagefind-ui__search-input');
  });
});

describe('pagefind indexing attributes', () => {
  it('solicitation record pages carry data-pagefind-body, meta title, and a type filter', () => {
    const d = firstIndexRow('solicitations.json').d as string;
    const $ = loadPage(`solicitations/${d}`);
    expect($('[data-pagefind-body]').length).toBe(1);
    expect($('[data-pagefind-meta="title"]').length).toBe(1);
    expect($('[data-pagefind-filter="type"]').text()).toBe('Solicitation');
  });

  it('supplier record pages carry data-pagefind-body', () => {
    const g = firstIndexRow('suppliers.json').g as string;
    const $ = loadPage(`suppliers/${g}`);
    expect($('[data-pagefind-body]').length).toBe(1);
  });

  it('browse and utility pages do not carry data-pagefind-body', () => {
    for (const p of ['', 'search', 'solicitations', 'suppliers', 'noncompetitive', 'council']) {
      const $ = loadPage(p);
      expect($('[data-pagefind-body]').length, `/${p}/ should not be indexed`).toBe(0);
    }
  });
});
