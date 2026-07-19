import { describe, expect, it } from 'vitest';
import { loadFixture, loadPage } from './helpers';
import { formatCAD } from '../../src/prepare/amounts';
import { wsSlug } from '../../src/prepare/slugs';

const fixture = loadFixture();

describe('non-competitive record page', () => {
  const nc = fixture.noncompetitive.find((n) => n.reason !== null) ?? fixture.noncompetitive[0];
  // Pages are routed by the URL-safe slug, never the raw workspace_number (which can
  // contain spaces, parens, commas, ampersands, slashes in real data). Computing the
  // path through wsSlug keeps this fixture-safe whether or not the fixture's value is clean.
  const ncPath = `noncompetitive/${wsSlug(nc.workspace_number)}`;
  it('has a fixture record', () => {
    expect(nc).toBeDefined();
  });
  it('is routed at the wsSlug path and displays the raw workspace number verbatim', () => {
    const $ = loadPage(ncPath);
    expect($('body').text()).toContain(nc.workspace_number);
  });
  it('shows the stated reason', () => {
    const $ = loadPage(ncPath);
    if (nc.reason !== null) {
      expect($('.nc-reason').text()).toContain(nc.reason);
    } else {
      expect($('.nc-reason').text()).toContain('No reason recorded');
    }
  });
  it('shows the amount tiers: raw verbatim and parsed numeric side by side', () => {
    const $ = loadPage(ncPath);
    if (nc.contract_amount !== null) {
      expect($('.amount-raw').text()).toContain(nc.contract_amount);
    }
    if (nc.contract_amount_numeric !== null) {
      expect($('.amount-numeric').text()).toContain(formatCAD(nc.contract_amount_numeric));
    } else {
      expect($('.amount-unparsed').text()).toContain('not machine-parseable');
    }
  });
  it('notes that workspace numbers never join to document numbers', () => {
    const $ = loadPage(ncPath);
    expect($('.keyspace-note').text()).toContain('never matched up');
  });
});
