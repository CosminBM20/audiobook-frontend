import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Explicit entry for Cloudinary — enables per-host optimisation hints
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Wildcard fallback for any other HTTPS host (book covers entered manually,
      // placeholder services, etc.).  HTTP is intentionally excluded.
      { protocol: 'https', hostname: '**' },
    ],
  },

  // ── SSR exclusions ────────────────────────────────────────────────────────
  // These packages contain native binaries / Node.js-only code.
  // Telling Next.js to treat them as external prevents them from being bundled
  // into the server-side render of client components (including the dashboard
  // that references the AI summarizer worker).
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node', 'sharp'],

  // ── Turbopack (Next.js 16 default for `next dev`) ─────────────────────────
  // No resolveAlias needed: @xenova/transformers detects the browser/Worker
  // environment at runtime and uses its WASM backend (onnxruntime-web).
  // The Node.js-only imports (onnxruntime-node, sharp) are never reached in
  // browser context, so Turbopack's tree-shaking drops them automatically.
  turbopack: {},

  // ── Webpack (used by `next build` for production) ─────────────────────────
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$':            false,
      'onnxruntime-node$': false,
    };
    return config;
  },
};

export default nextConfig;
