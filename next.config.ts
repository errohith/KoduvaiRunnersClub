import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Next.js inlines small bootstrap scripts; tighten with nonces if you add a CSP reporting pipeline.
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "frame-src https://www.google.com https://maps.google.com https://www.openstreetmap.org",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "nodemailer"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.APP_ENV === "production") {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
    }
    return [{ source: "/(.*)", headers }];
  },
};

export default config;
