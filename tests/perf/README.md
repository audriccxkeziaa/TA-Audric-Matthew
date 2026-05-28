# Pengujian Performa — k6

Skrip uji beban untuk Bab Pengujian. Mengukur latency
endpoint kritis di bawah beban, sesuai target laporan: **p95 < 500 ms**.

## Prasyarat

1. **Install k6** — <https://grafana.com/docs/k6/latest/set-up/install-k6/>
   - Windows: `winget install k6` atau `choco install k6`
2. **Backend berjalan** (`npm run dev` di `apps/backend/`).
3. **Database sudah di-seed** — minimal ada 1 produk aktif. Untuk
   `sales-load.js`, siapkan produk uji ber-stok besar (mis. 100.000)
   agar transaksi tidak tertolak R1 di tengah uji beban panjang.
4. Punya akun (email + password) role kasir atau admin.

## Skenario Beban

Kedua skrip memakai executor `ramping-arrival-rate`:

| Stage | Durasi | Target | Tujuan |
| --- | --- | --- | --- |
| 1 | 1 menit | 1 RPS | Baseline 1 user |
| 2 | 5 menit | 10 RPS | Beban 10 request konkuren |

## Menjalankan

```bash
# Uji beban POST /api/sales
k6 run -e BASE_URL=http://localhost:5000/api \
       -e EMAIL=kasir@asiajaya.com -e PASSWORD=passwordkasir \
       --summary-export=hasil-sales.json \
       tests/perf/sales-load.js

# Uji beban POST /api/purchases/commit
k6 run -e BASE_URL=http://localhost:5000/api \
       -e EMAIL=kasir@asiajaya.com -e PASSWORD=passwordkasir \
       --summary-export=hasil-purchases.json \
       tests/perf/purchases-load.js
```

## Membaca Hasil

k6 mencetak ringkasan di terminal. Ambil baris `http_req_duration`:

```
http_req_duration..............: avg=...  p(50)=...  p(95)=...  p(99)=...
```

- **p50 / p95 / p99** → masukkan ke tabel hasil pengujian performa skripsi.
- Baris `✓ http_req_duration..p(95)<500` artinya threshold target tercapai.
- File `hasil-*.json` (dari `--summary-export`) bisa dilampirkan sebagai bukti
  mentah dan untuk membuat grafik latency.

> Catatan integritas: angka p50/p95/p99 yang ditulis di skripsi HARUS berasal
> dari hasil run nyata di lingkungan Anda — jangan diisi manual.
