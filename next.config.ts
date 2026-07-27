import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [],
  // typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds removed (PRD-05).
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
