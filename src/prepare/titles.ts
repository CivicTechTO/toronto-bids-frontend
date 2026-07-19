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
