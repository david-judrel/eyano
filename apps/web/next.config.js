/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@eyano/types', '@eyano/auth'],
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
