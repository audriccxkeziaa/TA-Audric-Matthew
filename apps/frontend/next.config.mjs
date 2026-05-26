/** @type {import('next').NextConfig} */
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
  // ESLint tidak dijalankan saat build produksi (belum dipasang sebagai
  // dependency) — pengecekan dilakukan terpisah bila diperlukan.
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
