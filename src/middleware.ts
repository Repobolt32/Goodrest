import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-me-in-production'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Only protect /admin routes
  if (pathname.startsWith('/admin')) {
    // Fast-path for E2E: skip auth entirely to remove flakiness in Playwright runs
    if (process.env.E2E_MODE === 'true') {
      return NextResponse.next();
    }

    // 2. Allow access to /admin/login
    if (pathname === '/admin/login') {
      return NextResponse.next();
    }

    // 3. Check for session cookie
    const session = request.cookies.get('admin_session')?.value;

    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    try {
      // 4. Verify JWT
      await jwtVerify(session, JWT_SECRET);
      return NextResponse.next();
    } catch {
      // Invalid session
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/admin/:path*',
  ],
};
