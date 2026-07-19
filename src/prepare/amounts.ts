import type { SumResult } from './types.ts';

const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

/** Format a number as Canadian dollars, en-CA locale: "$1,234,567.89". */
export function formatCAD(n: number): string {
  return cad.format(n);
}

/**
 * Sum the machine-parsed numeric tier only (data rule 2).
 * A row is skipped — and the skip counted — when its verdict is
 * 'not_an_award' or its numeric is null (raw was unparseable, e.g. "kj",
 * "31.65/MT", "Non-Compliant"). Callers label every total as a
 * machine-parseable undercount and surface `skipped` beside `total`.
 */
export function sumAwardNumeric(
  rows: { numeric: number | null; verdict: string | null | undefined }[],
): SumResult {
  const result: SumResult = { total: 0, counted: 0, skipped: 0 };
  for (const row of rows) {
    if (row.verdict === 'not_an_award' || row.numeric === null) {
      result.skipped += 1;
      continue;
    }
    result.total += row.numeric;
    result.counted += 1;
  }
  return result;
}

/**
 * A single municipal procurement award above this is implausible — Toronto's
 * entire annual budget is ~$16B. Three City-published award lines exceed it
 * (e.g. $9.05B to an individual) and inflate the headline (#73). The site shows
 * a total excluding them beside the raw one.
 */
export const IMPLAUSIBLE_AWARD_THRESHOLD = 1_000_000_000;

export interface TrimmedSum extends SumResult {
  /** How many award lines were dropped for exceeding the threshold. */
  outliers: number;
}

/**
 * `sumAwardNumeric`, but excluding award lines whose numeric exceeds `threshold`
 * (implausibly large City-published values). Reports how many were dropped so
 * the caption can state it. A `not_an_award` row is never an outlier — it was
 * already excluded from the sum.
 */
export function sumAwardNumericExcludingOutliers(
  rows: { numeric: number | null; verdict: string | null | undefined }[],
  threshold: number = IMPLAUSIBLE_AWARD_THRESHOLD,
): TrimmedSum {
  const isOutlier = (r: { numeric: number | null; verdict: string | null | undefined }) =>
    r.verdict !== 'not_an_award' && typeof r.numeric === 'number' && r.numeric > threshold;
  const kept = rows.filter((r) => !isOutlier(r));
  return { ...sumAwardNumeric(kept), outliers: rows.length - kept.length };
}
