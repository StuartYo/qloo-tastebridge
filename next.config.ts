import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cached Qloo responses (git-ignored, never committed) are read at runtime by the API routes.
  outputFileTracingIncludes: { "/api/**": ["./.cache/qloo/**/*.json"] },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
