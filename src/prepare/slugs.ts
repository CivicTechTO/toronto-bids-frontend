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
    if (existing !== undefined && existing !== s.supplier_key) {
      throw new Error(
        `Supplier slug collision: "${slug}" from supplier_key "${existing}" and supplier_key "${s.supplier_key}"`,
      );
    }
    keyBySlug.set(slug, s.supplier_key);
    result.set(s.supplier_id, slug);
  }
  return result;
}

/**
 * URL-safe slug for a noncompetitive workspace_number. 77 of 2,856 real
 * values contain spaces, parens, commas, ampersands, or slashes — unusable
 * raw as an Astro route param (a '/' even splits the path). Case, digits,
 * dots, underscores, and dashes are preserved so most workspace numbers
 * pass through unchanged; every other run of characters becomes a single
 * '-'. Record pages display the raw workspace_number verbatim — only URLs
 * use the slug. Collision detection lives in prepare() (Task 10), which
 * builds Prepared.wsSlugByNumber and throws naming both colliding values.
 */
export function wsSlug(ws: string): string {
  return ws
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
