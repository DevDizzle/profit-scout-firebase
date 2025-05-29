// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ─── Build settings ──────────────────────────────────────────────────────────
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  // ─── Images ──────────────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
    ],
  },

  // ─── NEW: CORS for local dev ─────────────────────────────────────────────────
  // Goes at *top level* as of v15.2.3+
  allowedDevOrigins: [
    'https://3000-firebase-studio-1747849194793.cluster-joak5ukfbnbyqspg4tewa33d24.cloudworkstations.dev',
    'http://localhost:3000',
    'http://0.0.0.0:3000',
    'http://localhost:9002',
    'http://0.0.0.0:9002',
  ],

  // ─── Any other experimental flags stay here ─────────────────────────────────
  experimental: {
    // keep this block only if you need other experimental options
  },
}

export default nextConfig
