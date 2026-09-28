import { NextResponse, type NextRequest } from "next/server";
import { LANG_HEADER, splitLocalePath } from "@/lib/i18n/locales";

/** Website pages that exist in every language (under /tj and /en) */
const LOCALIZED = /^\/($|mastera(\/|$)|portfolio$|kabinet$|podarok$|oplata\/[\w-]+$|sertifikat\/[\w-]+$|ochered\/[\w-]+$)/;
const PROTECTED = /^\/(cms|admin|styleguide)(\/|$)/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /tj/… and /en/…: serve the same page, telling it the language in a request header
  const { lang, path } = splitLocalePath(pathname);
  const headers = new Headers(request.headers);
  headers.delete(LANG_HEADER); // never trust a language header sent by the browser
  if (lang !== "ru") {
    if (!LOCALIZED.test(path)) return NextResponse.next(); // → 404
    headers.set(LANG_HEADER, lang);
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // Optimistic check only: no session cookie → straight to the login page.
  // The real check (session in the database + role) runs in every page and action.
  if (PROTECTED.test(pathname) && !request.cookies.has("mj_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/", "/mastera/:path*", "/portfolio", "/kabinet", "/podarok", "/oplata/:path*", "/sertifikat/:path*", "/ochered/:path*", "/tj", "/tj/:path*", "/en", "/en/:path*", "/cms/:path*", "/admin/:path*", "/styleguide"],
};
