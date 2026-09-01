const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "login",
  "signup",
  "recover",
  "mail",
  "cdn",
  "static",
  "dev",
  "staging",
]);

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SUBDOMAINS.has(slug.trim().toLowerCase());
}

/**
 * Equivalente de tenant.minhaplataforma.com.
 *
 * Em produção com DNS wildcard, o host `slug.minhaplataforma.com` identifica
 * o tenant. Em preview/local (sem wildcard), o caminho `/{slug}` é usado.
 */
export function resolveTenantSlugFromHost(
  host: string,
  platformDomain: string
): string | null {
  const hostname = host.split(":")[0].trim().toLowerCase();
  const domain = platformDomain.trim().toLowerCase().replace(/^\./, "");
  if (!hostname || !domain) return null;
  if (hostname === domain || hostname === `www.${domain}`) return null;
  const suffix = `.${domain}`;
  if (!hostname.endsWith(suffix)) return null;
  const sub = hostname.slice(0, -suffix.length);
  if (!sub || sub.includes(".") || isReservedSlug(sub)) return null;
  return sub;
}

export function rewritePathForTenantSlug(pathname: string, slug: string): string | null {
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/recover")
  ) {
    return null;
  }
  if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) return null;
  if (pathname === "/") return `/${slug}`;
  return `/${slug}${pathname}`;
}
