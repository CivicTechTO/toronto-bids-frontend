import { describe, expect, it } from 'vitest';
import { href } from '../../src/lib/url';

describe('href', () => {
  it('joins a GitHub Pages base path without double slashes', () => {
    expect(href('/solicitations/3524228095/', '/toronto-bids-frontend')).toBe(
      '/toronto-bids-frontend/solicitations/3524228095/',
    );
  });
  it('handles a base with a trailing slash', () => {
    expect(href('/solicitations/3524228095/', '/toronto-bids-frontend/')).toBe(
      '/toronto-bids-frontend/solicitations/3524228095/',
    );
  });
  it("href('/') resolves to the base root", () => {
    expect(href('/', '/toronto-bids-frontend')).toBe('/toronto-bids-frontend/');
    expect(href('/', '/')).toBe('/');
  });
  it('works with root base', () => {
    expect(href('/about/', '/')).toBe('/about/');
  });
  it('prepends a slash to relative paths', () => {
    expect(href('about/', '/')).toBe('/about/');
  });
  it('defaults the base to import.meta.env.BASE_URL (vitest default "/")', () => {
    expect(href('/data/')).toBe('/data/');
  });
});
