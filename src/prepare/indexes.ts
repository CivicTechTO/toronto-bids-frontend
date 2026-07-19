// Compact browse-index rows for the BrowseTable island (Task 19 serves them as
// /indexes/*.json). Keys are deliberately terse to keep the shipped JSON small;
// every key is documented on its interface.
import type { Prepared } from './types';
import { sumAwardNumeric } from './amounts';
import { wsSlug } from './slugs';
import { displayTitle, normalizeCategory } from './titles';

export interface SolicitationIndexRow { d: string; t: string; u: boolean; s: string; r: string | null; c: string | null; v: string | null; y: number; dl: string | null; a: number | null; nb: number; nd: number }
// d=document_number t=display title u=untitled s=status r=rfx_type c=normalized category
// v=division y=issue year dl=deadline a=deduped award total (null if none) nb=bid count nd=document count

export interface SupplierIndexRow { g: string; n: string; na: number; nb: number; a: number | null }
// g=slug n=display_name na=award-line count nb=bid count a=city award total

export interface NoncompetitiveIndexRow { w: string; wl: string; n: string | null; r: string | null; v: string | null; y: number | null; a: number | null }
// w=workspace_number (raw, displayed) wl=URL slug (wsSlug — links are /noncompetitive/{wl}/)
// n=supplier r=reason v=division y=contract year a=numeric amount

export interface CouncilIndexRow { f: string; t: string | null; y: number; nb: number }
// f=reference t=title y=year nb=bid count

export function buildSolicitationIndex(p: Prepared): SolicitationIndexRow[] {
  return p.doc.solicitations.map((sol) => {
    const d = sol.document_number;
    const title = displayTitle(sol);
    const dedupedRows = p.dedupedAwardsByDoc.get(d) ?? [];
    const total = sumAwardNumeric(
      dedupedRows.map((a) => ({ numeric: a.award_amount_numeric, verdict: a.award_amount_verdict })),
    );
    // Bids reach a solicitation two ways: nested directly (award_summary bids,
    // backend issue #145) and via the council bid-bridge.
    let councilBids = 0;
    for (const ref of p.bridge.docToRefs.get(d) ?? []) {
      const item = p.councilByRef.get(ref);
      if (!item) continue;
      councilBids += item.bids.filter((b) => b.document_number === d).length;
    }
    return {
      d, t: title.text, u: title.untitled, s: sol.status, r: sol.rfx_type,
      c: normalizeCategory(sol.category), v: sol.division,
      y: Number(sol.issue_date.slice(0, 4)), dl: sol.submission_deadline,
      a: dedupedRows.length > 0 ? total.total : null,
      nb: sol.bids.length + councilBids, nd: sol.documents.length,
    };
  });
}

export function buildSupplierIndex(p: Prepared): SupplierIndexRow[] {
  return [...p.rollupsBySlug.values()]
    .map((r) => ({
      g: r.slug, n: r.supplier.display_name, na: r.awards.length, nb: r.bids.length,
      a: r.awards.length > 0 ? r.totals.cityAwards.total : null,
    }))
    .sort((x, y) => x.n.localeCompare(y.n, 'en-CA') || x.g.localeCompare(y.g, 'en-CA'));
}

export function buildNoncompetitiveIndex(p: Prepared): NoncompetitiveIndexRow[] {
  // wl is computed with wsSlug directly (deterministic) — identical to the
  // value prepare() stores in Prepared.wsSlugByNumber, which has already
  // collision-checked every workspace_number before any index is built.
  return p.doc.noncompetitive.map((row) => ({
    w: row.workspace_number, wl: wsSlug(row.workspace_number),
    n: row.supplier_name_raw, r: row.reason, v: row.division,
    y: row.contract_date ? Number(row.contract_date.slice(0, 4)) : null,
    a: row.contract_amount_numeric,
  }));
}

export function buildCouncilIndex(p: Prepared): CouncilIndexRow[] {
  return p.doc.council_items.map((item) => ({
    f: item.reference, t: item.title,
    y: Number(item.reference.slice(0, 4)), nb: item.bids.length,
  }));
}
