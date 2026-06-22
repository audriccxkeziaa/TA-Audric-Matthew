# POS — CV Asia Jaya Maju

Sistem Point of Sale berbasis web untuk toko suku cadang sepeda motor
**CV Asia Jaya Maju (Banjarbaru)**, dibuat untuk skripsi S1 Informatika
UK Petra (Audric Matthew Wirawan, C14220332).

Mengintegrasikan:

- **OCR input stok masuk** dari nota supplier (cetak & tulisan tangan).
  Pipeline: preprocessing citra (`sharp`; `@u4/opencv4nodejs` opsional untuk
  jalur tulisan tangan) → **Tesseract.js** sebagai baseline → **Groq Vision
  (LLM multimodal)** sebagai lapisan ekstraksi utama → pencocokan ke katalog
  via **Levenshtein** (top-3). Hasil selalu **divalidasi user** sebelum
  disimpan. Jalur PDF lahir-digital diekstrak via Groq Text.
  > Catatan: bila `GROQ_API_KEY` tidak diset, sistem fallback ke hasil
  > Tesseract + parser regex.
- **Rule-Based System** untuk menjaga konsistensi data persediaan
  (R1 Pencegahan Stok Negatif, R2 Validasi Stok Masuk, R3 Stok Terpusat,
  R4 Konsistensi Stok, R5 Rekomendasi Restock) — ditegakkan **dua lapis**
  (service Express + trigger/fungsi PostgreSQL).
- **Dashboard analitik** (tren penjualan & statistik kunci), **audit
  trail**, **laporan** penjualan/pembelian, **manajemen pengguna (RBAC)**,
  serta modul tambahan: **retur/penyesuaian stok**, **pengeluaran &
  ringkasan keuangan**, dan **notifikasi stok menipis**.

## Struktur Repo

```
.
├── apps/
│   ├── backend/                Express.js (Node) — REST API
│   │   ├── src/                routes → middleware → controllers → services → repositories
│   │   └── database/
│   │       ├── migrations/     *.sql — SATU-SATUNYA sumber migrasi (apply manual di Supabase)
│   │       └── seed.js         data demo (idempotent)
│   └── frontend/               Next.js 15 (React 18) — Web UI (App Router, feature-based)
│       ├── app/(app)/<fitur>/  page.jsx tipis → re-export dari features/
│       ├── features/<fitur>/   hooks + components + lib per fitur
│       └── lib/                api.js (service layer tunggal) + api-client.js + supabase.js
└── tests/
    ├── perf/                   Skrip uji beban k6 (sales & purchases)
    └── security/               Skrip uji RBAC & JWT tampering
```

> **Penting:** migrasi database hanya ada di **`apps/backend/database/migrations/`**.
> (Folder `database/` lama di root sudah dihapus karena duplikat & membingungkan.)

## Tech Stack

| Layer       | Teknologi                                                          |
| ----------- | ------------------------------------------------------------------ |
| Frontend    | Next.js 15 (App Router) · React 18 · Tailwind 3 · React Query      |
| Backend     | Node.js · Express 5 · Multer · Sharp · Tesseract.js · pdf-parse    |
| OCR         | Tesseract.js + Groq Vision (LLM) · `@u4/opencv4nodejs` (opsional) · fast-levenshtein |
| Database    | PostgreSQL via Supabase (Auth + Storage + RLS)                     |
| Keamanan    | JWT (Supabase Auth) · RBAC middleware · Helmet · RLS · rate-limit  |
| Charts      | Recharts                                                           |

## Quick Start (development)

Prasyarat:
- Node.js ≥ 20
- Akun Supabase (project baru)
- (Opsional) `GROQ_API_KEY` dari [groq.com](https://groq.com) untuk OCR LLM.
- (Opsional, OCR tulisan tangan) Visual Studio Build Tools (C++) + CMake
  agar `@u4/opencv4nodejs` ter-build.

### 1. Clone dan install

```bash
git clone <repo>
cd TA-Audric-Matthew

cd apps/backend && npm install && cd ../..
cd apps/frontend && npm install && cd ../..
```

### 2. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com); salin
   **Project URL**, **anon key**, dan **service role key**.
2. Di **SQL Editor**, jalankan SELURUH migrasi di
   `apps/backend/database/migrations/` **secara berurutan** mulai dari
   `001_initial_schema.sql` sampai migrasi tertinggi (`048_…`).
   - Termasuk `036_rls_hardening.sql` (pengetatan RLS) dan
     `037_drop_password_plain.sql` (hapus kolom password plaintext).
   - Penomoran boleh ada loncatan kecil (mis. tidak ada `035`); itu normal.
3. Di **Storage**, buat bucket **`nota-supplier`** (private).

### 3. Konfigurasi env

```bash
# apps/backend/.env
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
FRONTEND_URL=http://localhost:3000
GROQ_API_KEY=gsk_...            # opsional — untuk OCR berbasis LLM

# apps/frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

`FRONTEND_URL` boleh comma-separated (`http://localhost:3000,http://192.168.1.10:3000`)
agar satu backend melayani laptop & HP via LAN sekaligus untuk testing.

### 4. Seed data demo

```bash
cd apps/backend && npm run seed
```

Membuat 2 user, 50+ produk, 6 stok masuk, dan 25 transaksi (tersebar 14 hari).
Idempotent (aman dijalankan ulang).

**Login demo (login pakai USERNAME):**
- `owner_asia` / `password123` — admin/owner
- `kasir_lina` / `password123` — kasir

> Ganti password & bersihkan data demo sebelum dipakai operasional nyata.

### 5. Jalankan

```bash
# Terminal 1 — backend
cd apps/backend && npm run dev

# Terminal 2 — frontend
cd apps/frontend && npm run dev    # http://localhost:3000
```

## Aturan Bisnis (Rule-Based System)

| Kode | Aturan                  | Letak penegakan                                          |
| ---- | ----------------------- | -------------------------------------------------------- |
| R1   | Pencegahan Stok Negatif | Service `salesService` + fungsi/trigger DB (SQLSTATE 45R01) |
| R2   | Validasi Stok Masuk     | `purchasesService` (semua item harus tervalidasi user)   |
| R3   | Stok Terpusat           | Trigger `BEFORE UPDATE products.stok` (45R03)            |
| R4   | Konsistensi Stok        | Trigger `AFTER INSERT sale_items / purchase_items`       |
| R5   | Rekomendasi Restock     | View `v_restock_recommendation` (read-only)              |

Semua perubahan stok ter-audit di `stock_logs` (`rule_triggered` +
`rule_action` ∈ `TRIGGERED|REJECTED|ACCEPTED`). Transaksi penjualan &
pembelian dijalankan via fungsi PostgreSQL atomik (`fn_create_sale`,
`fn_commit_purchase`) dengan penguncian baris (`FOR UPDATE`).

## Keamanan

- **Autentikasi**: JWT via Supabase Auth; backend memverifikasi token tiap request.
- **RBAC**: middleware peran (admin/kasir) pada setiap route.
- **RLS** (migrasi 036): tabel transaksi read-only untuk klien; semua tulis
  hanya lewat backend (service role). Akses langsung tulis via PostgREST ditutup.
- **Password**: tidak disimpan plaintext (dikelola Supabase Auth). Reset via
  Edit user (set password baru). Lupa password admin → admin lain / Supabase
  Dashboard / `node scripts/set-admin-password.js <baru>`.
- **Lainnya**: rate-limit login, security headers (Helmet di API + `headers()`
  di Next.js), parameterized query via supabase-js.

## Pengujian

| Jenis | Lokasi | Keterangan |
| --- | --- | --- |
| Black-box | Laporan skripsi Bab 4.7.1 (Tabel 4.2) | Skenario fungsional ter-tabulasi |
| Performa | [`tests/perf/`](./tests/perf/) | Skrip k6 — target p95 < 500 ms |
| Keamanan | [`tests/security/`](./tests/security/) + Laporan Bab 4.7.7 | SQL injection, RBAC/JWT, HTTP headers |

Contoh: `node tests/security/rbac-jwt-test.js` (backend hidup) ·
`k6 run tests/perf/sales-load.js`.

## Deployment (Railway)

Sistem di-deploy sebagai **dua service terpisah di Railway** — backend & frontend — dengan
**Supabase** (basis data + storage + auth) dan **Groq** (Vision LLM) sebagai layanan eksternal.
Railway menyediakan HTTPS otomatis dan auto-deploy setiap push ke branch `main`.

### 1. Siapkan Supabase (sekali)

1. Buat project di [supabase.com](https://supabase.com); salin **Project URL**, **anon key**, dan **service role key**.
2. Di **SQL Editor**, jalankan SELURUH migrasi `apps/backend/database/migrations/*.sql` **berurutan** (`001_…` sampai migrasi tertinggi `048_…`).
3. Di **Storage**, buat bucket **`nota-supplier`** (private).

### 2. Deploy Backend (service ke-1)

1. Railway → **New Project → Deploy from GitHub repo** → pilih repo ini.
2. **Settings → Root Directory:** `apps/backend`
3. **Start Command** terdeteksi otomatis dari `package.json`: `node src/server.js`.
4. **Settings → Variables:**

   ```
   PORT=5000
   NODE_ENV=production
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_ANON_KEY=...
   FRONTEND_URL=https://<domain-frontend>.up.railway.app
   GROQ_API_KEY=gsk_...
   GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
   ```

5. Deploy → catat domain backend (mis. `https://backend-xxx.up.railway.app`).

### 3. Deploy Frontend (service ke-2)

1. Di project Railway yang sama → **+ New → GitHub Repo** (repo yang sama).
2. **Settings → Root Directory:** `apps/frontend`
3. **Build:** `npm run build` · **Start:** `npm run start` (Next.js, terdeteksi otomatis).
4. **Settings → Variables:**

   ```
   NEXT_PUBLIC_API_URL=https://<domain-backend>.up.railway.app/api
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

5. Deploy → buka domain frontend.
6. **Kembali ke service backend**, isi `FRONTEND_URL` dengan domain frontend (untuk CORS) → redeploy backend.

> `FRONTEND_URL` boleh comma-separated bila perlu beberapa origin
> (mis. `https://app.up.railway.app,http://localhost:3000`).

### Checklist sebelum operasional nyata

1. Jalankan SEMUA migrasi di Supabase (termasuk `036_rls_hardening` & `037_drop_password_plain`).
2. Ganti password user demo & **bersihkan data seed**.
3. Pastikan `FRONTEND_URL` (backend) & `NEXT_PUBLIC_API_URL` (frontend) menunjuk domain produksi.
4. Pertimbangkan strategi backup data Supabase untuk data toko nyata.

## Lisensi

Dibuat untuk keperluan akademis. Hak cipta naskah ada pada penulis.
