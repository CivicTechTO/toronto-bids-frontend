/**
 * Join the site base path (GitHub Pages project path) with an internal path.
 * ALL internal links go through this. The base parameter exists so unit tests
 * can pass it explicitly; pages rely on the import.meta.env.BASE_URL default.
 */
export function href(path: string, base: string = import.meta.env.BASE_URL): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  const joined = `${b}${p}`;
  return joined === '' ? '/' : joined;
}
