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
    expect($('body').text()).toContain('divisions');
    expect($('a[href="/solicitations/"]').length).toBeGreaterThanOrEqual(1);
    expect($('a[href="/suppliers/"]').length).toBeGreaterThanOrEqual(1);
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
    expect(text).toContain('Portal captured since');
    const sections: Array<[number, string]> = [
      [zoo.solicitations.length, 'no solicitations posted yet'],
      [zoo.awards.length, 'no awards published yet'],
      [zoo.bids.length, 'no bids posted yet'],
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
