import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the pathname
  const { pathname } = request.nextUrl;
  
  // Protected routes
  const protectedRoutes = ['/builder', '/search', '/generation', '/pricing'];
  
  // Check if the current path is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute) {
    // Check for session token (NextAuth uses this cookie)
    const token = request.cookies.get('next-auth.session-token') || 
                  request.cookies.get('__Secure-next-auth.session-token');
    
    // If no token, redirect to login
    if (!token) {
      const url = new URL('/login', request.url);
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }
  }
  
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
