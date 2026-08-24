import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Middleware disabled - using page-level authentication instead
  // This prevents cookie issues with NextAuth on localhost
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
