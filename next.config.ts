import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Keep dev indicators minimal (supported keys only)
  devIndicators: {
    position: "bottom-right",
  },
  // Disable powered by header
  poweredByHeader: false,
  // Enable gzip compression
  compress: true,
};

export default nextConfig;
