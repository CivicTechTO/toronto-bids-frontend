# Buyer portal and publication records — 2026-10-23

## Failure and fix

The buyer pages and index read only `solicitations`, `awards` and `bids`. The backend also exports `portal_listings`, `award_publications` and `published_awards`, so a buyer with only these records appeared empty despite successful ingestion and deployment. The original fixtures had no such buyers.

The frontend now renders portal postings, supported published award claims and original publication evidence separately from contract records. Repeated printed references do not collapse distinct postings. Published claims join their evidence by `publication_key` within the same buyer; absent or duplicate source identities fail shape validation. The original text, source URL, source labels, publication month and raw/numeric amounts are visible. Publication months are not presented as award dates, and titles are labelled as extracted.

Original source entries remain available even if they have no supported extracted claim. Empty states describe what this export holds, rather than claiming that nothing has been published. Legacy exports can omit the new arrays; malformed arrays cannot silently become empty sections.

The buyer index, data dictionary and `counts.json` include separate counts for the new kinds. City headline counts and totals are unchanged. Subsequent deployments apply the existing shrink guard to these new counts too.

## Verification

Before implementation, four data-layer regressions and three built-page regressions failed as expected. After implementation:

- 131 unit tests pass; TypeScript checking passes.
- Fixture build and site tests pass (108 passed, four pre-existing skips).
- Full build from a fixed copy of the production export passes, including Pagefind: 25,128 HTML pages. The export timestamp is `2026-10-23T09:40:52.620482+00:00`; JSON SHA-256 is `91a9264bc99ab90c8c37d4a33cbda5ac59c93b3682e8b634b12a83eba815b8e2`.
- A full internal-link crawl and data-independent buyer assertions pass: each exported posting, award claim and publication entry reaches its buyer's built HTML; claim supplier, month and original evidence match the export.
- Full data includes 412 Library portal listings, 122 Zoo postings, 249 TRCA postings, 508 Waterfront award claims and 510 original Waterfront publication entries.
- Real Library and Waterfront pages were visually inspected with the existing Chromium installation.

The new fixtures cover portal-only and publication-only buyers, reused printed references, original evidence, source-only entries, missing numeric values and source labels. Their definitions are also loaded by the fixture generator.

This validation builds locally; it does not publish data or deploy the frontend.
