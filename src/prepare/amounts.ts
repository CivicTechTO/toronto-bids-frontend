import type { SumResult } from './types.ts';

const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

/** Format a number as Canadian dollars, en-CA locale: "$1,234,567.89". */
export function formatCAD(n: number): string {
  return cad.format(n);
}
