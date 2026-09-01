import { NextRequest, NextResponse } from "next/server";
import { resolveTenantSlugFromHost, rewritePathForTenantSlug } from "@/lib/tenant/slug";

/**
 * Equivalente de tenant.minhaplataforma.com.
 *
 * Com DNS wildcard, `slug.minhaplataforma.com/agendar` é reescrito para
 * `/{slug}/agendar`. Sem wildcard (preview/local), use o caminho `/{slug}`.
 */
export function middleware(req: NextRequest) {
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "minhaplataforma.com";
  const slug = resolveTenantSlugFromHost(req.headers.get("host") ?? "", platformDomain);
  if (!slug) return NextResponse.next();

  const nextPath = rewritePathForTenantSlug(req.nextUrl.pathname, slug);
  if (!nextPath) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = nextPath;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)"],
};
