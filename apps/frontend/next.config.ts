import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Opzionale: se hai problemi con le immagini, decommenta questo:
  // images: { unoptimized: true } 
};

export default nextConfig;