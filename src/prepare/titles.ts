import type { DisplayTitle, Solicitation } from './types.ts';

/**
 * Data rule 5: `title === null` means the City published no title (3,464 of
 * 7,444 solicitations). Untitled records render as
 * "Doc <document_number> — <rfx_type>, <division>", dropping whichever
 * parts are null. Callers show an explicit "no title published" marker
 * whenever `untitled` is true.
 */
export function displayTitle(
  sol: Pick<Solicitation, 'document_number' | 'title' | 'rfx_type' | 'division'>,
): DisplayTitle {
  if (sol.title !== null) return { text: sol.title, untitled: false };
  const parts = [sol.rfx_type, sol.division].filter((p): p is string => p !== null);
  const suffix = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
  return { text: `Doc ${sol.document_number}${suffix}`, untitled: true };
}

/**
 * Data rule 6: the City published both 'Goods & Services' (91 rows) and
 * 'Goods and Services' (2,364 rows). Facets and indexes fold the former
 * into the latter; record pages still show the raw value.
 */
export function normalizeCategory(category: string | null): string | null {
  if (category === 'Goods & Services') return 'Goods and Services';
  return category;
}

/**
 * Badge text for recovered titles (`title_source` non-null, data rule 5).
 * Rendered by ProvenanceBadge.astro next to the display title.
 */
export const TITLE_SOURCE_LABELS: Record<string, string> = {
  bid_award_panel: 'Title from Bid Award Panel records',
  council_pre_ariba: 'Title from council agenda (pre-Ariba)',
  council_composite: 'Title from council composite award records',
  legacy_ariba_html: 'Title from legacy Ariba HTML',
};

// Abbreviations require their dots (d.b.a., c.o.b.) so a real name containing a bare
// "DBA"/"COB" token isn't mistaken for a trade-name marker. "o/a" is unambiguous (the
// slash), as are the full phrases. A trailing colon/period/space after the marker is
// consumed so "trading as: X" yields "X", not ": X".
const OPERATING_MARK = /\b(?:o\/a|operating\s+as|trading\s+as|d\.b\.a\.?|c\.o\.b\.?(?:\s+as)?)[\s:.]+/i;

/**
 * A numbered company's operating / trade name, taken from a name variant carrying an
 * "o/a" / "operating as" / "trading as" / "d.b.a." / "c.o.b." marker (e.g. "614128
 * Ontario Ltd, O/A Trisan Construction" → "Trisan Construction"), so a reader can see
 * who actually received the money. Trailing footnote artifacts (a scraped "*") are
 * stripped. Null when no variant carries such a marker.
 */
export function operatingName(variants: string[]): string | null {
  for (const v of variants) {
    const parts = v.split(OPERATING_MARK);
    if (parts.length > 1) {
      const name = parts[1].replace(/[\s*]+$/, '').trim();
      if (name) return name;
    }
  }
  return null;
}
