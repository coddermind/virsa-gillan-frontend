import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable Next.js watermark and build indicators
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: "bottom-right",
  },
  // Disable powered by header
  poweredByHeader: false,
  // Disable x-powered-by header
  compress: true,
};

export default nextConfig;
