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
