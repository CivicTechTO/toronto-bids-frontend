import { describe, expect, it } from 'vitest';
import { tmmisUrl } from '../../src/lib/sources.ts';

describe('tmmisUrl', () => {
  it('builds the City TMMIS agenda-item URL for a council reference', () => {
    expect(tmmisUrl('2019.BA42.10')).toBe(
      'https://secure.toronto.ca/council/agenda-item.do?item=2019.BA42.10',
    );
  });

  it('encodes the reference into the query parameter', () => {
    // A hypothetical reference with a reserved char stays a valid single-param URL.
    expect(tmmisUrl('2020.GG17 4')).toBe(
      'https://secure.toronto.ca/council/agenda-item.do?item=2020.GG17%204',
    );
  });
});
