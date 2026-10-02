/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dossier de compilation reglable : permet un second serveur de dev
  // (verification visuelle) sans ecraser `.next` du serveur principal.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.google.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/og',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/:all*(svg|jpg|png)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
