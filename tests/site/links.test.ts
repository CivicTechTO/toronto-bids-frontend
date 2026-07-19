import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { loadFile } from './helpers';

// Data-independent invariants: run against ANY dist (fixture or full data).
// Task 22's full-data verification runs exactly this file:
//   npx vitest run -c vitest.site.config.ts tests/site/links.test.ts

function walkHtml(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

const EXTERNAL = /^(https?:|mailto:|tel:)/;

// The build bakes BASE_PATH into every internal href (via href()); strip it to
// resolve against dist/, which has no base prefix on disk. Unset or '/' (the
// fixture/CI build) => empty prefix, nothing to strip.
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/+$/, '');

describe('internal links', () => {
  it('every internal a[href] in dist resolves to a built file', () => {
    const pages = walkHtml('dist');
    expect(pages.length).toBeGreaterThan(0);
    const broken: string[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      const $ = load(readFileSync(page, 'utf8'));
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        // Internal links start with '/'. Skip external protocols and fragments.
        if (EXTERNAL.test(href) || href.startsWith('#') || !href.startsWith('/')) return;
        let path = href.split(/[?#]/)[0];
        // Strip the baked-in base path so the target resolves against dist/.
        if (BASE && (path === BASE || path.startsWith(BASE + '/'))) {
          path = path.slice(BASE.length) || '/';
        }
        if (path.startsWith('/pagefind/')) return;
        if (seen.has(path)) return; // check each target once
        seen.add(path);
        const rel = path.replace(/^\//, '');
        const file = join('dist', rel === '' ? 'index.html' : rel);
        const ok =
          (existsSync(file) && statSync(file).isFile()) ||
          existsSync(join(file, 'index.html'));
        if (!ok) broken.push(`${page} -> ${href}`);
      });
    }
    expect(broken, `broken internal links:\n${broken.join('\n')}`).toEqual([]);
  });
});

describe('page counts', () => {
  // counts.json is countsOf() of the export THIS dist was built from, so these
  // assertions hold for the fixture build AND the full-data build. Under the
  // fixture build, counts.solicitations === fixture solicitations.length and
  // counts.suppliers === fixture suppliers.length.
  const counts = JSON.parse(loadFile('counts.json')) as Record<string, number>;

  function recordDirs(entity: string): number {
    return readdirSync(join('dist', entity)).filter((e) =>
      statSync(join('dist', entity, e)).isDirectory(),
    ).length;
  }

  it('builds one record page per solicitation', () => {
    expect(recordDirs('solicitations')).toBe(counts.solicitations);
  });

  it('builds one record page per supplier', () => {
    expect(recordDirs('suppliers')).toBe(counts.suppliers);
  });

  it('builds one record page per noncompetitive contract', () => {
    expect(recordDirs('noncompetitive')).toBe(counts.noncompetitive);
  });

  it('builds one record page per council item', () => {
    expect(recordDirs('council')).toBe(counts.council_items);
  });
});
