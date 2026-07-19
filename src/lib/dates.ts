/**
 * Whether a solicitation's submission deadline had already passed as of the data
 * snapshot. Records still marked "Open" whose bidding window closed are flagged so a
 * reader doesn't mistake this historical archive for a live tenders board (#10).
 *
 * Compared against the export's `generated_at` (the snapshot instant) — never the
 * machine clock — so the flag is deterministic and reproducible from a given export.
 * Returns false for a null / empty / unparseable deadline: we never invent an expiry.
 */
export function deadlinePassed(deadline: string | null, asOf: string): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  const ref = new Date(asOf);
  if (Number.isNaN(d.getTime()) || Number.isNaN(ref.getTime())) return false;
  return d.getTime() < ref.getTime();
}
