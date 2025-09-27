import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  eslint: {
    // allow build to succeed even if ESLint errors are present
    ignoreDuringBuilds: true,
  },
  typescript: {
    // allow build to succeed even if there are TypeScript type errors
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns:[
      {
        protocol:'https',
        hostname:'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'ucarecdn.com',
      },
    ],
  },
};

export default nextConfig;
