import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Page-level authentication is used instead of middleware-based guards.
  // The NEXTAUTH_URL is now environment-aware, so the cookie issues that
  // originally prompted disabling this middleware have been resolved.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/builder/:path*',
    '/search/:path*',
    '/generation/:path*',
    '/pricing/:path*',
  ],
};
