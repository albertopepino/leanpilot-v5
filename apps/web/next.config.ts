import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Proxy API calls to NestJS in development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
