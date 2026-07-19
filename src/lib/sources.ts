// Links out to the City of Toronto's own public records (we host nothing).

/**
 * The City's live procurement portal, where suppliers find *current* open
 * opportunities to bid on. This archive is a historical record and links out here
 * for anything live (#10). The toronto.ca landing page is stable and browser-verified;
 * the underlying SAP Ariba / Business Network deep-links behind it are volatile, so we
 * point at the City's own portal page rather than an Ariba URL.
 */
export const TORONTO_BIDS_PORTAL =
  'https://www.toronto.ca/business-economy/doing-business-with-the-city/searching-bidding-on-city-contracts/toronto-bids-portal/';

/**
 * The City's TMMIS agenda-item page for a council reference (e.g. "2019.BA42.10").
 * `secure.toronto.ca/council/agenda-item.do` is the canonical, browser-verified host
 * (the `app.toronto.ca/tmmis/viewAgendaItemHistory.do` form the City stores serves only
 * http and redirects here). The `item=` param takes the reference verbatim.
 */
export function tmmisUrl(reference: string): string {
  return `https://secure.toronto.ca/council/agenda-item.do?item=${encodeURIComponent(reference)}`;
}
