// =================================================================
// tests/perf/purchases-load.js — Uji Beban POST /api/purchases/commit (k6)
// =================================================================
// Skenario (sub-bab Pengujian Performa laporan):
//   Stage 1 — ramp-up ke 1 RPS selama 1 menit  (baseline)
//   Stage 2 — ramp-up ke 10 RPS selama 5 menit (beban konkuren)
// Target verifikasi: p95 latency < 500 ms.
//
// Cara menjalankan:
//   k6 run -e BASE_URL=http://localhost:5000/api \
//          -e EMAIL=kasir@asiajaya.com -e PASSWORD=rahasia123 \
//          --summary-export=hasil-purchases.json \
//          tests/perf/purchases-load.js
//
// Catatan: commit pembelian MENAMBAH stok — tidak ada masalah deplesi.
// Payload mengirim status_validasi='tervalidasi' supaya lolos R2.
// =================================================================

import http from "k6/http";
import { check, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000/api";
const EMAIL = __ENV.EMAIL;
const PASSWORD = __ENV.PASSWORD;

export const options = {
  scenarios: {
    purchases: {
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

  const prodRes = http.get(`${BASE_URL}/products?status=aktif&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const products = prodRes.json("data") || [];
  if (!products.length) fail("Tidak ada produk untuk diuji — seed data dulu.");

  return { token, product_id: products[0].id };
}

// ---------- default(): satu commit stok masuk ----------
export default function (data) {
  const payload = JSON.stringify({
    no_nota_supplier: `PERF-${Date.now()}`,
    file_nota_url: null,
    // R2: status_validasi 'tervalidasi' — payload sudah dikonfirmasi.
    status_validasi: "tervalidasi",
    items: [
      {
        action: "restock",
        product_id: data.product_id,
        qty: 1,
        harga_beli: 1000,
        diskon_persen: 0,
        source: "manual",
      },
    ],
  });

  const res = http.post(`${BASE_URL}/purchases/commit`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.token}`,
    },
  });

  check(res, {
    "status 201": (r) => r.status === 201,
    "latency < 500ms": (r) => r.timings.duration < 500,
  });
}
