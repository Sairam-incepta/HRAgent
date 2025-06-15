/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { 
    unoptimized: true 
  },
  // Remove output: 'export' and related static export configs
  // These are incompatible with middleware and API routes
};

module.exports = nextConfig;