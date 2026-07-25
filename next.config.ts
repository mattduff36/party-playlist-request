import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/:username/admin/overview',
        destination: '/:username/admin/requests',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
