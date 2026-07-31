import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DRIFTLENS_BUILD_SHA: process.env.DRIFTLENS_BUILD_SHA ?? "",
  },
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
