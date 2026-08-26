import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-only overlay badge defaults to the bottom-left, where it sits on
  // top of the sidebar's expand control and swallows clicks during local
  // development. It isn't present in production builds.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
