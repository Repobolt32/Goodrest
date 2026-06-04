import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const jwtSecret = process.env.JWT_SECRET || 'placeholder-jwt-secret-key-at-least-32-chars-long';
const JWT_SECRET = new TextEncoder().encode(jwtSecret);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Auth logic for /admin routes
  if (pathname.startsWith('/admin')) {
    // Fast-path for E2E: skip auth entirely to remove flakiness in Playwright runs
    if (process.env.E2E_MODE === 'true' && process.env.NODE_ENV !== 'production') {
      return response;
    }

    // Allow access to /admin/login
    if (pathname === '/admin/login') {
      return response;
    }

    // Check for session cookie
    const session = request.cookies.get('admin_session')?.value;

    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    try {
      // Verify JWT
      await jwtVerify(session, JWT_SECRET);
      return response;
    } catch {
      // Invalid session
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
};
