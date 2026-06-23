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

  // ── Turbopack (Next.js 16 default for `next dev`) ─────────────────────────
  turbopack: {},
};

export default nextConfig;
