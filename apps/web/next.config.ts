import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  transpilePackages: ['@buildflow/api-client', '@buildflow/contracts'],
};

export default nextConfig;
