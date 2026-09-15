import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("digicanvas_session")?.value;

  const isProtectedAdminRoute = pathname.startsWith("/admin");
  const isProtectedClientRoute = pathname.startsWith("/portal");
  const isAuthRoute = pathname.startsWith("/login");

  // If unauthenticated and accessing protected routes, redirect to /login
  if ((isProtectedAdminRoute || isProtectedClientRoute) && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If already logged in and accessing login page, let server page redirect based on role
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:path*",
    "/login",
  ],
};
