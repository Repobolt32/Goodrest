import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const jwtSecret = process.env.JWT_SECRET || 'placeholder-jwt-secret-key-at-least-32-chars-long';
const JWT_SECRET = new TextEncoder().encode(jwtSecret);

const SHARED_SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const STRICT_CSP = "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com; frame-ancestors 'none';";

const RIDER_CSP = [
  "default-src 'self' http://192.168.29.229:3001 https://*.trycloudflare.com",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://192.168.29.229:3001 https://*.trycloudflare.com",
  "style-src 'self' 'unsafe-inline' http://192.168.29.229:3001 https://*.trycloudflare.com",
  "img-src 'self' data: blob: https: http://192.168.29.229:3001",
  "font-src 'self' data: http://192.168.29.229:3001",
  "connect-src 'self' http://192.168.29.229:3001 https://*.trycloudflare.com https://*.supabase.co wss://*.supabase.co https://api.razorpay.com",
  "frame-ancestors 'self' capacitor://localhost http://localhost http://192.168.29.229:3001 https://*.trycloudflare.com",
].join('; ') + ';';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Apply route-specific CSP
  if (pathname.startsWith('/rider')) {
    response.headers.set('Content-Security-Policy', RIDER_CSP);
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  } else if (pathname.startsWith('/api/rider')) {
    response.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('X-Frame-Options', 'DENY');
  } else {
    response.headers.set('Content-Security-Policy', STRICT_CSP);
    response.headers.set('X-Frame-Options', 'DENY');
  }

  // Apply shared security headers
  Object.entries(SHARED_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

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
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
