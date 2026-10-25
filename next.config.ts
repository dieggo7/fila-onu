import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  ...(process.env.ELECTRON === "1"
    ? { output: "export" as const, images: { unoptimized: true } }
    : {}),
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: process.env.ELECTRON !== "1",
  partialPrefetching: process.env.ELECTRON !== "1",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
