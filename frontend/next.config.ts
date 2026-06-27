import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  experimental: {
    // This tells turbopack/webpack to restrict watches inside the frontend directory
    turbopack: {
      root: path.resolve(__dirname),
    }
  } as any
};

export default nextConfig;
