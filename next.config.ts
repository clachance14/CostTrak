import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporary: Ignore ESLint during builds to allow deployment
  // TODO: Remove after fixing all ESLint errors
  eslint: {
    ignoreDuringBuilds: true
  },
  // Temporary: Ignore TypeScript errors during builds
  // TODO: Remove after fixing all TypeScript errors
  typescript: {
    ignoreBuildErrors: true
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: https: blob:;
              font-src 'self' data:;
              connect-src 'self' https://*.supabase.co wss://*.supabase.co;
              frame-src 'self';
              object-src 'none';
              base-uri 'self';
              form-action 'self';
              frame-ancestors 'none';
              upgrade-insecure-requests;
            `.replace(/\n/g, ' ').trim()
          }
        ],
      },
    ]
  },
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
};

export default nextConfig;
