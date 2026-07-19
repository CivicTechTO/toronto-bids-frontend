// Links out to the City of Toronto's own public records (we host nothing).

/**
 * The City's TMMIS agenda-item page for a council reference (e.g. "2019.BA42.10").
 * This is the URL the City itself publishes — the same form the backend captured in
 * `noncompetitive.council_authority_link` (http upgraded to https).
 */
export function tmmisUrl(reference: string): string {
  return `https://app.toronto.ca/tmmis/viewAgendaItemHistory.do?item=${encodeURIComponent(reference)}`;
}
