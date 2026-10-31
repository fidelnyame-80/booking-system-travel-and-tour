import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.NEXT_OUTPUT_DIR || ".next",
};

export default nextConfig;
