# Frontend — POS CV Asia Jaya Maju

Aplikasi web Next.js (App Router, JavaScript) untuk sistem Point of Sale.

## Tech Stack

- **Next.js 14** (App Router) — JavaScript (.jsx)
- **Tailwind CSS** — styling
- **React Query** (`@tanstack/react-query`) — caching server state
- **Recharts** — grafik dashboard
- **@supabase/supabase-js** — refresh JWT session di sisi browser

## Setup

```bash
cd apps/frontend
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run dev                  # http://localhost:3000
```

### Variabel Lingkungan (`.env.local`)

| Variabel | Keterangan |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | URL backend Express, mis. `http://localhost:5000/api` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key Supabase (publik) |

Backend (`apps/backend/`) harus berjalan lebih dulu.

## Struktur

```
app/
  login/                  Halaman login
  (app)/                  Route group terproteksi (sidebar + guard)
    dashboard/            Dashboard analitik admin
    dashboard/restock/    Rekomendasi restock (R5)
    kasir/                Point of Sale (kasir)
    stok-masuk/           Input stok masuk via OCR
    master-barang/        CRUD master barang
    laporan/              Laporan penjualan & pembelian
    audit-trail/          Audit trail stock_logs
    users/                Manajemen user
components/               Komponen UI (Sidebar, Topbar, ui.jsx, dll)
hooks/                    useAuth, useToast, useDebounce
lib/                      api-client, api, supabase, format, receipt
```

## Hak Akses Halaman (RBAC)

| Halaman | Admin | Kasir |
| --- | :---: | :---: |
| Dashboard, Laporan, Audit Trail, Restock, Users | ✓ | — |
| Kasir (POS) | — | ✓ |
| Master Barang, Stok Masuk | ✓ | ✓ |

Guard sisi klien ada di `app/(app)/layout.jsx`; backend tetap mengecek
JWT + role pada setiap request (Lapisan 2/3).

## Build Produksi

```bash
npm run build
npm run start
```
