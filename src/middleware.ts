import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Protected routes that require authentication
const protectedRoutes = ["/onboarding", "/status", "/settings"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all protected routes
    "/onboarding/:path*",
    "/status/:path*",
    "/settings/:path*",
    // Match API routes except auth
    "/api/((?!auth).)*",
  ],
};
