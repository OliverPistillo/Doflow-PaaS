import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Non bloccare il build in presenza di errori TypeScript
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
