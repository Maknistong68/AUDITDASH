import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plans, RAMS and Permits were merged into Documents (query string is carried over by Next).
  async redirects() {
    return ['plans', 'rams', 'permits'].flatMap((old) => [
      { source: `/category/${old}`, destination: '/category/documents', permanent: true },
      { source: `/category/${old}/:path*`, destination: '/category/documents/:path*', permanent: true },
    ]);
  },
};

export default nextConfig;
