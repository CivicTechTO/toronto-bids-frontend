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
