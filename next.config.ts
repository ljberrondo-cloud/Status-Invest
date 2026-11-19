import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Rutas anteriores (en español) → nuevas (en portugués).
  async redirects() {
    return [
      { source: "/activos", destination: "/ativos", permanent: true },
      { source: "/analisis", destination: "/analise", permanent: true },
      { source: "/invertir", destination: "/investir", permanent: true },
    ];
  },
  // Los archivos de data/ se leen en runtime desde las rutas API: incluirlos en el bundle serverless.
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*.json"],
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
