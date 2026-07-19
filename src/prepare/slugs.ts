import type { SupplierRec } from './types.ts';

// Filesystem safety cap: slugs become `dist/suppliers/<slug>/` directory
// names, and ubuntu-latest (and most filesystems) reject names over 255
// bytes (NAME_MAX). A handful of real supplier_key values are scraped
// footnote text hundreds of bytes long, so the base slug must be capped
// well under that limit. 180 leaves ample room for the '-' + 8-hex-char
// hash suffix appended below (<=189 chars total) while leaving every
// normal (short) slug byte-for-byte unchanged.
const MAX_SLUG_LEN = 180;

/**
 * Small dependency-free 32-bit FNV-1a hash, used only to disambiguate
 * over-long slugs after truncation so two different pathological
 * supplier_keys sharing a truncated prefix can never collide.
 */
function slugHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Data rule 8: supplier permalinks slug the stable normalized
 * `supplier_key` — never `display_name` (shifts as variants accrue) and
 * never `supplier_id` (rebuilt nightly). Lowercase; every run of
 * characters outside [a-z0-9] becomes a single '-'; leading/trailing
 * dashes are trimmed.
 *
 * A few real supplier_key values are scraped footnote text hundreds of
 * bytes long; left unbounded their slugs would become directory names
 * that exceed the filesystem NAME_MAX (255 bytes) and crash `astro
 * build` with ENAMETOOLONG. Slugs longer than MAX_SLUG_LEN are truncated
 * and given a deterministic hash suffix of the full original key so
 * they stay unique; every slug at or under the cap is unchanged.
 */
export function supplierSlug(supplierKey: string): string {
  const base = supplierKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length <= MAX_SLUG_LEN) {
    return base;
  }
  const truncated = base.slice(0, MAX_SLUG_LEN).replace(/-+$/, '');
  return `${truncated}-${slugHash(supplierKey)}`;
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
