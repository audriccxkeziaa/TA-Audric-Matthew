/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint tidak dijalankan saat build produksi (belum dipasang sebagai
  // dependency) — pengecekan dilakukan terpisah bila diperlukan.
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
