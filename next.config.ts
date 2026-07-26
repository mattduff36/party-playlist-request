import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [],
  // typescript.ignoreBuildErrors removed — `npm run type-check` is green (PRD-05).
  // eslint.ignoreDuringBuilds remains until no-explicit-any debt is cleared
  // (see docs/database/QUALITY_GATE_DEBT.md). Do not demote ESLint rules to warn.
  eslint: {
    ignoreDuringBuilds: true,
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
