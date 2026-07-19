import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { ExportDoc } from '../../src/prepare/types';

/** Load a built page by its URL path (directory format). Pass '' for the root page. */
export function loadPage(relPath: string): CheerioAPI {
  return cheerio.load(readFileSync(join('dist', relPath, 'index.html'), 'utf-8'));
}

/** Read an exact file under dist/ (e.g. 'counts.json', '404.html'). */
export function loadFile(relPath: string): string {
  return readFileSync(join('dist', relPath), 'utf-8');
}

/** The committed fixture the site was built from (site tests assert against it). */
export function loadFixture(): ExportDoc {
  return JSON.parse(readFileSync('tests/fixtures/bids.fixture.json', 'utf-8')) as ExportDoc;
}
