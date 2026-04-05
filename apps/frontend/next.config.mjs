/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // 1. Permetti le immagini dai domini esterni (necessario per avatar GitHub/Google)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'github.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  // 2. CONFIGURAZIONE PROXY (Fondamentale)
  async rewrites() {
    // Se siamo in locale senza docker usa localhost, altrimenti usa il nome del servizio docker 'backend'
    const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || 'http://localhost:4000';
    
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`, // Proxy verso NestJS
      },
      // Opzionale: Proxy per WebSocket (anche se spesso conviene connettersi diretti)
      {
        source: '/ws',
        destination: `${BACKEND_URL}/ws`,
      }
    ];
  },
};

export default nextConfig;