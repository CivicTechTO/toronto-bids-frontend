import type { SupplierRec } from './types.ts';

/**
 * Data rule 8: supplier permalinks slug the stable normalized
 * `supplier_key` — never `display_name` (shifts as variants accrue) and
 * never `supplier_id` (rebuilt nightly). Lowercase; every run of
 * characters outside [a-z0-9] becomes a single '-'; leading/trailing
 * dashes are trimmed.
 */
export function supplierSlug(supplierKey: string): string {
  return supplierKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
