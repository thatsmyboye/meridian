import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@meridian/api",
    "@meridian/inngest",
    "@meridian/types",
    "@meridian/ui",
  ],
};

export default nextConfig;
