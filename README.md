# POS — CV Asia Jaya Maju

Sistem Point of Sale berbasis web untuk toko suku cadang sepeda motor
**CV Asia Jaya Maju (Surabaya)**, dibuat untuk skripsi S1 Informatika
UK Petra (Audric Matthew Wirawan, C14220332).

Mengintegrasikan:

- **Tesseract OCR** untuk input stok masuk dari nota supplier (cetak
  & tulisan tangan), dengan preprocessing OpenCV + string matching
  Levenshtein.
- **Rule-Based System** untuk menjaga konsistensi data persediaan
  (R1 Pencegahan Stok Negatif, R2 Validasi Stok Masuk, R3 Stok Terpusat,
  R4 Konsistensi Stok, R5 Rekomendasi Restock).
- **Dashboard analitik** + audit trail + laporan penjualan/pembelian
  + manajemen pengguna.

## Struktur Repo

```
.
├── apps/
│   ├── backend/         Express.js (Node) — REST API
│   └── frontend/        Next.js 14 (React 18) — Web UI
├── database/
│   └── migrations/      *.sql — di-apply manual di Supabase
├── docs/
│   ├── black-box-testing/   Tabel skenario pengujian (67 skenario)
│   ├── security-testing/    Prosedur uji keamanan 4 lapisan
│   └── uat/                 Template UAT + kuesioner SUS
└── tests/
    ├── perf/            Skrip uji beban k6 (sales & purchases)
    └── security/        Skrip uji RBAC & JWT tampering
```

## Tech Stack

| Layer       | Teknologi                                                       |
| ----------- | --------------------------------------------------------------- |
| Frontend    | Next.js 14 (App Router) · React 18 · Tailwind 3 · React Query   |
| Backend     | Node.js · Express 5 · Multer · Sharp · Tesseract.js             |
| OCR (HW)    | `@u4/opencv4nodejs` (preprocessing) · fast-levenshtein          |
| Database    | PostgreSQL via Supabase (Auth + Storage + RLS)                  |
| Charts      | Recharts                                                         |

## Quick Start (development)

Prasyarat:
- Node.js ≥ 20
- Akun Supabase (project baru)
- Untuk OCR tulisan tangan (opsional): Visual Studio Build Tools
  (C++ workload) + CMake — supaya `@u4/opencv4nodejs` autobuild.

### 1. Clone dan install

```bash
git clone <repo>
cd TA-Audric_Matthew

cd apps/backend && npm install && cd ../..
cd apps/frontend && npm install && cd ../..
```

### 2. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Salin **Project URL**, **anon key**, dan **service role key**
   ke clipboard.
3. Di SQL Editor Supabase, jalankan migrasi **secara berurutan** dari
   `database/migrations/`:
   ```
   001_users.sql       → 002_products.sql      → 003_sales.sql
   004_purchases.sql   → 005_stock_logs.sql    → 006_triggers_R3_R4.sql
   007_view_R5.sql     → 008_fn_create_sale.sql
   009_fn_commit_purchase.sql                  → 010_view_R5_avg_sales.sql
   011_fn_commit_purchase_v2.sql               → 012_users_is_active.sql
   ```
   Plus migrasi yang ada di `apps/backend/database/migrations/` (saat ini
   `010_purchase_drafts.sql`).
4. Di Storage, buat bucket bernama **`nota-supplier`** (private).

### 3. Konfigurasi env

```bash
# apps/backend/.env (salin dari .env.example, lalu isi)
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
FRONTEND_URL=http://localhost:3000

# apps/frontend/.env (salin dari .env.example)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

`FRONTEND_URL` bisa comma-separated (`http://localhost:3000,http://192.168.1.10:3000`)
supaya satu backend melayani laptop dan HP via LAN bersamaan untuk
testing live-scan kamera.

### 4. Seed data demo

```bash
cd apps/backend
npm run seed
```

Membuat 2 user, 50+ produk suku cadang motor, 6 stok masuk, dan 25
transaksi penjualan terdistribusi 14 hari ke belakang. Idempotent
(aman dijalankan ulang).

Login demo:
- `admin@asiajaya.local` / `password123` (admin/owner)
- `kasir@asiajaya.local` / `password123` (kasir)

> Ganti password setelah demo selesai.

### 5. Jalankan

```bash
# Terminal 1 — backend
cd apps/backend
npm run dev          # nodemon-like via node --watch

# Terminal 2 — frontend
cd apps/frontend
npm run dev          # Next.js di http://localhost:3000
```

Akses: <http://localhost:3000> → otomatis redirect ke `/login`.

## Aturan Bisnis (Rule-Based System)

| Kode | Aturan                              | Letak penegakan                                  |
| ---- | ----------------------------------- | ------------------------------------------------ |
| R1   | Pencegahan Stok Negatif             | Service layer `salesService` + trigger DB        |
| R2   | Validasi Stok Masuk                 | `purchasesService` (semua item harus terverifikasi user) |
| R3   | Stok Terpusat                       | Trigger `BEFORE UPDATE products` (45R03)         |
| R4   | Konsistensi Stok                    | Trigger `AFTER INSERT sale_items / purchase_items` |
| R5   | Rekomendasi Restock                 | View `v_restock_recommendation` (read-only)      |

Semua perubahan stok ter-audit di `stock_logs` (kolom `rule_triggered`
+ `rule_action` IN `TRIGGERED|REJECTED|ACCEPTED`).

## Pengujian

| Jenis | Lokasi | Keterangan |
| --- | --- | --- |
| Black-box | [`docs/black-box-testing/`](./docs/black-box-testing/) | 67 skenario fungsional ter-tabulasi |
| Performa | [`tests/perf/`](./tests/perf/) | Skrip k6 — target p95 < 500 ms |
| Keamanan | [`docs/security-testing/`](./docs/security-testing/) · [`tests/security/`](./tests/security/) | SQL injection, RBAC/JWT, HTTP headers |
| UAT | [`docs/uat/`](./docs/uat/) | Template skenario UAT + kuesioner SUS |

Uji RBAC & JWT otomatis: `node tests/security/rbac-jwt-test.js`
(backend harus hidup). Uji beban: `k6 run tests/perf/sales-load.js`.

## Deployment

- **Frontend**: Vercel (set env vars `NEXT_PUBLIC_*`).
- **Backend**: Railway / Render / fly.io (set env vars + `npm start`).
- **Database & Storage**: Supabase (cukup project gratis untuk skala
  toko kecil).

Untuk deploy ke Railway, lihat `DEPLOY_RAILWAY.md` di root repository.

Untuk produksi:
1. Update `FRONTEND_URL` di backend dengan domain Vercel atau Railway.
2. Update `NEXT_PUBLIC_API_URL` di frontend dengan URL backend.
3. Ganti password user demo.
4. Aktifkan Supabase Auth email confirmation (saat ini auto-confirm
   di seed).

## Lisensi

Dibuat untuk keperluan akademis. Hak cipta naskah ada pada penulis.
