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

/**
 * Slug every supplier, mapping the build-internal `supplier_id` join key
 * to the permalink slug. Two distinct supplier_keys slugging identically
 * would silently merge two firms' permalinks, so a collision throws —
 * naming both keys — and the site build fails instead of deploying.
 */
export function buildSupplierSlugs(suppliers: SupplierRec[]): Map<number, string> {
  const keyBySlug = new Map<string, string>();
  const result = new Map<number, string>();
  for (const s of suppliers) {
    const slug = supplierSlug(s.supplier_key);
    const existing = keyBySlug.get(slug);
    if (existing !== undefined) {
      throw new Error(
        `Supplier slug collision: "${slug}" from supplier_key "${existing}" and supplier_key "${s.supplier_key}"`,
      );
    }
    keyBySlug.set(slug, s.supplier_key);
    result.set(s.supplier_id, slug);
  }
  return result;
}
