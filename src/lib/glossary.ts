// Plain-language definitions of the procurement vocabulary used across the archive
// (#11). One source of truth: the /glossary/ page renders every entry, and <Term>
// pulls an entry's `short` text for its hover tooltip. Keep `short` to one plain
// sentence (it appears in a title attribute); put nuance in `full`.

export interface GlossaryEntry {
  /** URL-fragment id and <Term id="..."> key. Stable — it's a citable anchor. */
  id: string;
  /** Heading shown on the glossary page. */
  term: string;
  /** One-sentence plain definition; also the <Term> hover tooltip. */
  short: string;
  /** Optional extra context shown only on the glossary page. */
  full?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'solicitation',
    term: 'Solicitation',
    short:
      'A formal, publicly advertised request from the City for suppliers to submit bids on a contract.',
    full: 'A formal, publicly advertised request from the City for suppliers to submit bids on a contract — a tender, quotation, or proposal. The competitive record on this site is organized around solicitations.',
  },
  {
    id: 'rfx',
    term: 'RFQ, RFT, RFP (request types)',
    short:
      'The kind of solicitation: Request for Quotation, Tender, or Proposal — differing mainly in how bids are evaluated.',
    full: 'The kind of solicitation. Request for Quotation (RFQ) and Request for Tender (RFT) generally award on price to a compliant bidder; Request for Proposal (RFP) also weighs qualifications and approach. The City uses several such abbreviations.',
  },
  {
    id: 'bid',
    term: 'Bid',
    short: "A supplier's priced offer submitted in response to a solicitation.",
    full: "A supplier's priced offer submitted in response to a solicitation. This archive keeps losing bids as well as winning ones where the City published them, so you can see who else competed.",
  },
  {
    id: 'award',
    term: 'Award',
    short: 'The contract decision — which supplier won a solicitation, and for how much.',
    full: 'The contract decision: which supplier the City selected and the value recorded. Award amounts here come from the City verbatim; only machine-parseable numbers are ever summed, so totals undercount.',
  },
  {
    id: 'non-competitive',
    term: 'Non-competitive (sole-source) contract',
    short:
      'A contract awarded without open competition, with a stated reason — also called sole-source.',
    full: 'A contract the City entered without an open competition — for example when only one supplier can supply the goods, or in an emergency — always with a stated reason. Also called sole-source or single-source. Tracked separately from competitive solicitations.',
  },
  {
    id: 'buyer',
    term: 'Buyer (agency)',
    short:
      'A City agency, board, or corporation (e.g. TTC, Police, TCHC) that runs its own procurement, separate from the core City.',
    full: 'A City agency, board, or corporation — TTC, Toronto Police, Toronto Community Housing, the Zoo, and others — that runs procurement through its own portal. Their records are kept separate from the core City’s and are never merged into City-wide totals. Not to be confused with a City division (Transportation, Toronto Water, Parks), whose records live under Solicitations and Suppliers.',
  },
  {
    id: 'composite-award',
    term: 'Composite award / call (2009–2012)',
    short:
      'For 2009–2012, awards survive only as summary lines grouped under a numbered "call", not full solicitation records.',
    full: 'For 2009–2012 the City’s published record survives only as composite award lines grouped under a numbered "call". For 2009–2011 those summary lines are the entire award record — there are no underlying solicitation or bid details.',
  },
  {
    id: 'suspended-firm',
    term: 'Suspended firm',
    short:
      'A supplier the City has barred from bidding for a period, by council or administrative decision.',
    full: 'A supplier the City has barred from being awarded work for a period, by council or administrative decision. The archive lists the suspension type and dates where published.',
  },
  {
    id: 'identifiers',
    term: 'Record numbers (document, workspace, call, council)',
    short:
      'Each kind of record has its own numbering system; the archive never mixes them or adds across them.',
    full: 'Each kind of record carries its own identifier — a 10-digit document number for competitive solicitations, a workspace number for non-competitive contracts, a call number for 2009–2012 composite awards, and a council reference for council decisions. These numbering systems never overlap, and the archive never presents a total that adds across them. The Data page documents each in full.',
  },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY.map((e) => [e.id, e]),
);
