import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cached Qloo responses and the showcase bundle are git-ignored (never in the public repo).
  // They ship only inside the private Vercel deployment, uploaded from a local `vercel deploy`.
  outputFileTracingIncludes: { "/**": ["./.cache/qloo/**/*.json", "./.data/showcase.json"] },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
