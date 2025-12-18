import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // output: "standalone",  <-- QUESTA RIGA VA RIMOSSA O COMMENTATA //
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;