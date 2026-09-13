import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to exclude /api/internal/* from auth checks
 * Internal APIs use x-internal-key header for authentication instead
 */
export function middleware(request: NextRequest) {
  // Internal APIs bypass all middleware - they use their own auth
  if (request.nextUrl.pathname.startsWith('/api/internal/')) {
    return NextResponse.next()
  }

  // For all other routes, continue with normal flow
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
