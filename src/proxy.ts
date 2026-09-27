import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no session cookie → straight to the login page.
// The real check (session in the database + role) runs in every page and action.
export function proxy(request: NextRequest) {
  if (request.cookies.has("mj_session")) return NextResponse.next();
  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/cms/:path*", "/admin/:path*", "/styleguide"],
};
