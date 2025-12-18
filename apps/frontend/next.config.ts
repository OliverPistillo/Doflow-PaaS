import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone", // <--- FONDAMENTALE PER DOCKER
  typescript: {
    ignoreBuildErrors: true,
  },
  // Opzionale: se hai problemi con le immagini, decommenta questo:
  // images: { unoptimized: true } 
};

export default nextConfig;