import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Only OUR Supabase project may be fetched/optimised or connected to (a wildcard would let anyone use our free image quota).
const supabaseHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname; } catch { return null; } })();
const sb = supabaseHost ?? "*.supabase.co";

/**
 * Content-Security-Policy. Scripts keep 'unsafe-inline' because Next.js emits inline bootstrap/RSC scripts and a
 * nonce-based policy would force every page to render dynamically (losing static caching). Everything else is tightly allow-listed.
 * Third parties: Supabase (storage/API), YouTube (privacy-enhanced embeds + thumbnails), Vimeo, Razorpay Checkout.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${sb} https://i.ytimg.com`,
  "font-src 'self' data:",
  `media-src 'self' blob: https://${sb}`,
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://api.razorpay.com https://checkout.razorpay.com",
  `connect-src 'self' https://${sb} wss://${sb} https://api.razorpay.com https://lumberjack.razorpay.com${dev ? " ws: http://localhost:*" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://api.razorpay.com",
  "frame-ancestors 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: { remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/public-media/**" }] : [] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
