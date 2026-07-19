// Links out to the City of Toronto's own public records (we host nothing).

/**
 * The City's TMMIS agenda-item page for a council reference (e.g. "2019.BA42.10").
 * `secure.toronto.ca/council/agenda-item.do` is the canonical, browser-verified host
 * (the `app.toronto.ca/tmmis/viewAgendaItemHistory.do` form the City stores serves only
 * http and redirects here). The `item=` param takes the reference verbatim.
 */
export function tmmisUrl(reference: string): string {
  return `https://secure.toronto.ca/council/agenda-item.do?item=${encodeURIComponent(reference)}`;
}
