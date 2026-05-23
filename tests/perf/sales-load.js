// =================================================================
// tests/perf/sales-load.js — Uji Beban POST /api/sales (k6)
// =================================================================
// Skenario (sub-bab Pengujian Performa laporan):
//   Stage 1 — ramp-up ke 1 RPS selama 1 menit  (baseline)
//   Stage 2 — ramp-up ke 10 RPS selama 5 menit (beban konkuren)
// Target verifikasi: p95 latency < 500 ms.
//
// Cara menjalankan:
//   k6 run -e BASE_URL=http://localhost:5000/api \
//          -e EMAIL=kasir@asiajaya.com -e PASSWORD=rahasia123 \
//          --summary-export=hasil-sales.json \
//          tests/perf/sales-load.js
//
// Catatan: tiap transaksi mengurangi stok. Untuk uji beban panjang,
// siapkan produk uji ber-stok besar di database (lihat README.md).
// Respons 409 (R1 — stok habis) tetap dihitung valid karena endpoint
// tetap memproses request; yang diukur adalah latency.
// =================================================================

import http from "k6/http";
import { check, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000/api";
const EMAIL = __ENV.EMAIL;
const PASSWORD = __ENV.PASSWORD;

export const options = {
  scenarios: {
    sales: {
      executor: "ramping-arrival-rate",
      startRate: 0,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: 50,
      stages: [
        { duration: "1m", target: 1 }, // Stage 1: baseline 1 RPS
        { duration: "5m", target: 10 }, // Stage 2: konkuren 10 RPS
      ],
    },
  },
  thresholds: {
    // Target laporan: p95 < 500 ms
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.05"],
  },
};

// ---------- setup(): login + ambil 1 produk uji ----------
export function setup() {
  if (!EMAIL || !PASSWORD) {
    fail("Wajib set -e EMAIL=... -e PASSWORD=... (akun kasir/admin)");
  }
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(loginRes, { "login 200": (r) => r.status === 200 }) ||
    fail(`Login gagal: ${loginRes.status} ${loginRes.body}`);
  const token = loginRes.json("session.access_token");

  // Ambil produk aktif ber-stok untuk dijadikan item transaksi.
  const prodRes = http.get(`${BASE_URL}/products?status=aktif&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const products = prodRes.json("data") || [];
  const product =
    products.find((p) => Number(p.stok) > 0) || products[0];
  if (!product) fail("Tidak ada produk untuk diuji — seed data dulu.");

  return {
    token,
    product_id: product.id,
    harga_satuan: Number(product.harga_jual),
  };
}

// ---------- default(): satu transaksi penjualan ----------
export default function (data) {
  const payload = JSON.stringify({
    // harga_satuan WAJIB sama dengan harga_jual DB (anti manipulasi harga).
    items: [
      {
        product_id: data.product_id,
        qty: 1,
        harga_satuan: data.harga_satuan,
      },
    ],
  });

  const res = http.post(`${BASE_URL}/sales`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.token}`,
    },
  });

  // 201 = sukses; 409 = R1 menolak (stok habis) — keduanya berarti
  // endpoint memproses request, latency-nya tetap relevan diukur.
  check(res, {
    "status 201 / 409": (r) => r.status === 201 || r.status === 409,
    "latency < 500ms": (r) => r.timings.duration < 500,
  });
}
