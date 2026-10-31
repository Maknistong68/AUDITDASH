import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Defence in depth: never framed, no MIME sniffing, no referrer leakage, no device APIs.
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
  // Plans, RAMS and Permits were merged into Documents (query string is carried over by Next).
  // High-risk work was removed (not recorded in the Excel): old /high-risk links land on the overview (308).
  async redirects() {
    return [
      ...['plans', 'rams', 'permits'].flatMap((old) => [
        { source: `/category/${old}`, destination: '/category/documents', permanent: true },
        { source: `/category/${old}/:path*`, destination: '/category/documents/:path*', permanent: true },
      ]),
      { source: '/high-risk', destination: '/', permanent: true },
      { source: '/high-risk/:path*', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;
