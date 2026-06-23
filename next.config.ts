import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['192.168.1.117', '192.168.29.229', 'localhost:3000', '192.168.29.229:3000', '192.168.29.229:3001'],
  experimental: {
    serverActions: {
      allowedOrigins: ['192.168.1.117', '192.168.29.229', 'localhost:3000', '192.168.29.229:3000', '192.168.29.229:3001']
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: '**.pexels.com',
      },
      {
        protocol: 'https',
        hostname: 'pexels.com',
      },
      {
        protocol: 'https',
        hostname: 'pixabay.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    const sharedSecurityHeaders = [
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
    ];

    return [
      // All other routes: strict CSP (excludes rider web app and api routes)
      {
        source: '/((?!rider|api/rider).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://maps.googleapis.com https://*.googleapis.com",
              "frame-ancestors 'none'",
              "frame-src 'self' https://*.google.com https://*.google.co.in",
            ].join('; ') + ';',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          ...sharedSecurityHeaders,
        ],
      },
      // Rider routes: relaxed CSP overrides global for Capacitor WebView
      {
        source: '/rider/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' http://192.168.1.117:3000 http://192.168.29.229:3000 http://192.168.29.229:3001 https://*.trycloudflare.com",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://192.168.1.117:3000 http://192.168.29.229:3000 http://192.168.29.229:3001 https://*.trycloudflare.com",
              "style-src 'self' 'unsafe-inline' http://192.168.1.117:3000 http://192.168.29.229:3000 http://192.168.29.229:3001 https://*.trycloudflare.com",
              "img-src 'self' data: blob: https: http://192.168.1.117:3000 http://192.168.29.229:3000 http://192.168.29.229:3001",
              "font-src 'self' data: http://192.168.1.117:3000 http://192.168.29.229:3000 http://192.168.29.229:3001",
              "connect-src 'self' http://192.168.1.117:3000 http://192.168.29.229:3000 http://192.168.29.229:3001 https://*.trycloudflare.com https://*.supabase.co wss://*.supabase.co https://api.razorpay.com",
              "frame-ancestors 'self' capacitor://localhost http://localhost http://192.168.1.117:3000 http://192.168.29.229:3000 http://192.168.29.229:3001 https://*.trycloudflare.com",
            ].join('; ') + ';',
          },
          ...sharedSecurityHeaders,
        ],
      },
      // API routes for rider: no frame restrictions, permissive connect
      {
        source: '/api/rider/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; frame-ancestors 'none';",
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type',
          },
          ...sharedSecurityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
