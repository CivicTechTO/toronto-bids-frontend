import type {
  BidRow,
  Bridge,
  CouncilItem,
  DedupedAward,
  ExportDoc,
  Solicitation,
  SupplierRollup,
} from './types.ts';
import { sumAwardNumeric } from './amounts.ts';

/**
 * Data rule 3: the five keyspaces never join, but one bridge legitimately
 * exists on the competitive spine — council bids that carry BOTH a council
 * `reference` and a solicitation `document_number`. Bids missing either
 * identifier (e.g. pre-2019 council bids with document_number null)
 * contribute nothing.
 */
export function buildBridge(councilItems: CouncilItem[]): Bridge {
  const refToDoc = new Map<string, string>();
  const docToRefs = new Map<string, string[]>();
  for (const item of councilItems) {
    for (const b of item.bids) {
      if (b.reference === null || b.document_number === null) continue;
      if (!refToDoc.has(b.reference)) refToDoc.set(b.reference, b.document_number);
      const refs = docToRefs.get(b.document_number) ?? [];
      if (!refs.includes(b.reference)) {
        refs.push(b.reference);
        docToRefs.set(b.document_number, refs);
      }
    }
  }
  return { refToDoc, docToRefs };
}

/**
 * One rollup per supplier (every supplier gets one, even with no activity),
 * keyed by permalink slug. Attribution is by `supplier_id` — valid only
 * within this build (data rule 8); the slug is the stable identity.
 * City awards come from the caller's deduped-by-document map (which may
 * include unlinked documents — those get `sol: null`); bids come from
 * council items, solicitation-nested bids, and `unlinked_bids`. Totals are
 * one SumResult per keyspace — cityAwards, composite, noncompetitive —
 * and are NEVER merged into a single figure (data rule 3).
 *
 * The slug layer (buildSupplierSlugs) deliberately maps two supplier_ids
 * sharing the same supplier_key to the SAME slug without throwing (same key
 * = same firm = one page). So a slug may have more than one supplier_id
 * behind it; when it does, every one of those supplier_ids must point at
 * the SAME rollup object so their awards/bids/etc all accumulate onto one
 * page instead of the second supplier_id's rollup silently overwriting (and
 * orphaning) the first's in `out`.
 */
export function buildSupplierRollups(
  doc: ExportDoc,
  slugs: Map<number, string>,
  dedupedByDoc: Map<string, DedupedAward[]>,
): Map<string, SupplierRollup> {
  const solByDoc = new Map<string, Solicitation>();
  for (const s of doc.solicitations) solByDoc.set(s.document_number, s);

  const byId = new Map<number, SupplierRollup>();
  const out = new Map<string, SupplierRollup>();
  for (const supplier of doc.suppliers) {
    const slug = slugs.get(supplier.supplier_id);
    if (slug === undefined) {
      throw new Error(
        `No slug for supplier_id ${supplier.supplier_id} (supplier_key "${supplier.supplier_key}")`,
      );
    }
    let rollup = out.get(slug);
    if (rollup === undefined) {
      rollup = {
        slug,
        supplier,
        awards: [],
        compositeAwards: [],
        noncompetitive: [],
        bids: [],
        suspended: [],
        totals: {
          cityAwards: { total: 0, counted: 0, skipped: 0 },
          composite: { total: 0, counted: 0, skipped: 0 },
          noncompetitive: { total: 0, counted: 0, skipped: 0 },
        },
      };
      out.set(slug, rollup);
    }
    byId.set(supplier.supplier_id, rollup);
  }

  for (const [document_number, awards] of dedupedByDoc) {
    const s = solByDoc.get(document_number) ?? null;
    for (const award of awards) {
      if (award.supplier_id === null) continue;
      byId.get(award.supplier_id)?.awards.push({ document_number, sol: s, award });
    }
  }

  for (const comp of doc.composite_awards) {
    if (comp.supplier_id === null) continue;
    byId.get(comp.supplier_id)?.compositeAwards.push(comp);
  }

  for (const nc of doc.noncompetitive) {
    if (nc.supplier_id === null) continue;
    byId.get(nc.supplier_id)?.noncompetitive.push(nc);
  }

  const addBid = (b: BidRow): void => {
    if (b.supplier_id === null) return;
    byId.get(b.supplier_id)?.bids.push({
      reference: b.reference,
      document_number: b.document_number,
      bid: b,
    });
  };
  for (const item of doc.council_items) for (const b of item.bids) addBid(b);
  for (const s of doc.solicitations) for (const b of s.bids) addBid(b);
  for (const b of doc.unlinked_bids) addBid(b);

  for (const f of doc.suspended_firms) {
    if (f.supplier_id === null) continue;
    byId.get(f.supplier_id)?.suspended.push(f);
  }

  for (const rollup of out.values()) {
    rollup.totals.cityAwards = sumAwardNumeric(
      rollup.awards.map((a) => ({
        numeric: a.award.award_amount_numeric,
        verdict: a.award.award_amount_verdict,
      })),
    );
    rollup.totals.composite = sumAwardNumeric(
      rollup.compositeAwards.map((c) => ({ numeric: c.award_value_numeric, verdict: null })),
    );
    rollup.totals.noncompetitive = sumAwardNumeric(
      rollup.noncompetitive.map((n) => ({
        numeric: n.contract_amount_numeric,
        verdict: n.contract_amount_verdict,
      })),
    );
  }

  return out;
}
