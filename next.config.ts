import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Los archivos de data/ se leen en runtime desde las rutas API: incluirlos en el bundle serverless.
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*"],
  },
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
