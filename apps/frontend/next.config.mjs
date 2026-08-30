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
    const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || 'http://127.0.0.1:4000';
    
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
  async headers() {
    return [
      {
        source: '/meeting',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
