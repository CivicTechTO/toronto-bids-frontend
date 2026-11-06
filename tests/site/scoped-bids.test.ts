import { describe, expect, it } from 'vitest';
import { loadFixture, loadPage } from './helpers';
import { supplierSlug } from '../../src/prepare/slugs';
const fixture = loadFixture();
const scoped = fixture.solicitations.filter((s) => s.bid_scopes?.length);

describe('scoped bids', () => {
  it('counts identified firms separately from repeated response cells', () => {
    expect(scoped.length).toBeGreaterThan(0);
    for (const sol of scoped) {
      const $ = loadPage(`solicitations/${sol.document_number}`);
      expect($('.scope-counts').text()).toContain(`${sol.bid_scope_summary!.participating_firms} identified participating firms`);
      expect($('.scoped-responses tbody tr').length).toBe(sol.bid_scope_summary!.response_observations);
      expect($('.scoped-bids').text()).not.toContain('Single bidder');
    }
  });
  it('retains No Bid cells and source-labelled alternatives', () => {
    const sol = scoped.find((s) => s.bid_scope_summary!.explicit_no_bid_cells > 0)!;
    expect(sol).toBeDefined();
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect($('.scope-no-bid').length).toBe(sol.bid_scope_summary!.explicit_no_bid_cells);
    for (const scope of sol.bid_scopes!) for (const r of scope.responses) {
      if (r.alternative_label) expect($('.scoped-responses').text()).toContain(r.alternative_label);
    }
  });
  it('renders percentage discounts as source values and preserves tax/basis qualifications', () => {
    const sol = scoped.find((s) => s.bid_scopes!.some((scope) => scope.responses.some((r) => r.prices.some((p) => p.value_kind === 'discount_percentage'))))!;
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect($('.scoped-bids').text()).toContain('Percentage discount off MSRP');
    expect($('.amount-raw').text()).toContain('10%');
    const conditional = scoped.find((s) => s.bid_scopes!.some((scope) => scope.responses.some((r) => r.prices.some((p) => p.price_basis?.includes('5% prompt payment')))))!;
    expect(loadPage(`solicitations/${conditional.document_number}`)('.scope-price-basis').text()).toContain('5% prompt payment');
  });
  it('shows unresolved parties without claiming their full identities', () => {
    const sol = scoped.find((s) => s.bid_scope_summary!.unresolved_party_cells > 0)!;
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect($('.scope-uncertainty').text()).toContain('Party identity unresolved');
    expect($('.scope-uncertainty').text()).toContain('excluded from the identified firm count');
  });
  it('retains responses after a scope was not awarded and displays unscoped outcomes separately', () => {
    const sol = scoped.find((s) => s.bid_scopes!.some((scope) => scope.scope_status))!;
    const $ = loadPage(`solicitations/${sol.document_number}`);
    expect($('.scope-outcome').text()).toContain('Published responses are retained');
    const outcome = scoped.find((s) => s.bid_scope_summary!.unscoped_outcomes > 0)!;
    expect(loadPage(`solicitations/${outcome.document_number}`)('.scoped-responses').text()).toContain('Outcome; scope not stated');
  });
});


it('links supplier participation to scoped responses without a global win/loss claim', () => {
  let checked = 0;
  for (const sol of scoped) for (const b of sol.bids) {
    if (b.supplier_id === null) continue;
    const firm = fixture.suppliers.find((s) => s.supplier_id === b.supplier_id)!;
    const $ = loadPage(`suppliers/${supplierSlug(firm.supplier_key)}`);
    const rows = $('tr').filter((_, row) => $(row).find('a').toArray().some((a) => $(a).attr('href')?.endsWith(`/solicitations/${sol.document_number}/`)));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.text()).toContain('Scoped responses');
    expect(rows.text()).not.toMatch(/\b(?:Won|Lost)\b/);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
});


it('distinguishes unstated HST treatment from the published price header and qualifications', () => {
  const sol = scoped.find((s) => s.bid_scopes!.some((scope) => scope.responses.some((r) => r.prices.some((p) => p.hst_basis === null))))!;
  expect(sol).toBeDefined();
  const $ = loadPage(`solicitations/${sol.document_number}`);
  expect($('.scoped-price').text()).toContain('HST basis not stated');
  expect($('.scoped-price').text()).not.toContain('Tax basis not stated');
});
