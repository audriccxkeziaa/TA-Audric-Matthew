/** @type {import('next').NextConfig} */
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Header keamanan untuk domain frontend (target securityheaders.com grade A).
// CSP dibuat permisif untuk Next.js (inline/eval hydration) + Supabase (https/wss)
// + kamera (blob/media) agar tidak memecah aplikasi.
// Di DEVELOPMENT (run lokal), izinkan backend Express http://localhost:5000 + HMR ws.
// Di PRODUCTION tetap ketat (https/wss saja) agar securityheaders.com grade A.
const isDev = process.env.NODE_ENV !== "production";
const connectSrc = isDev
  ? "connect-src 'self' https: wss: http://localhost:5000 ws://localhost:*"
  : "connect-src 'self' https: wss:";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      connectSrc,
      "media-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig = {
  reactStrictMode: true,
  // ESLint tidak dijalankan saat build produksi (belum dipasang sebagai
  // dependency) — pengecekan dilakukan terpisah bila diperlukan.
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: __dirname,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
