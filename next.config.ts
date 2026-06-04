import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
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
      // Rider routes: relaxed CSP for Capacitor WebView (WiFi IP + tunnel fallback)
      {
        source: '/rider/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' http://192.168.29.229:3001 https://*.trycloudflare.com",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://192.168.29.229:3001 https://*.trycloudflare.com",
              "style-src 'self' 'unsafe-inline' http://192.168.29.229:3001 https://*.trycloudflare.com",
              "img-src 'self' data: blob: https: http://192.168.29.229:3001",
              "font-src 'self' data: http://192.168.29.229:3001",
              "connect-src 'self' http://192.168.29.229:3001 https://*.trycloudflare.com https://*.supabase.co wss://*.supabase.co https://api.razorpay.com",
              "frame-ancestors 'self' capacitor://localhost http://localhost http://192.168.29.229:3001 https://*.trycloudflare.com",
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
      // All other routes: strict CSP
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' http://192.168.29.229:3001; script-src 'self' 'unsafe-eval' 'unsafe-inline' http://192.168.29.229:3001; style-src 'self' 'unsafe-inline' http://192.168.29.229:3001; img-src 'self' data: blob: https: http://192.168.29.229:3001; font-src 'self' data: http://192.168.29.229:3001; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com http://192.168.29.229:3001; frame-ancestors 'none';",
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          ...sharedSecurityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
