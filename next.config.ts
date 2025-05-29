// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
    ],
  },

  experimental: {
    // 👇 Make this the full origin you see in the browser’s address bar
    allowedDevOrigins: [
      'https://3000-firebase-studio-1747849194793.cluster-joak5ukfbnbyqspg4tewa33d24.cloudworkstations.dev',
      // (optional) add the local ones you still hit from inside the workstation
      'http://localhost:3000',
      'http://0.0.0.0:3000',
      'http://localhost:9002',
      'http://0.0.0.0:9002',
    ],
  },
};

export default nextConfig;