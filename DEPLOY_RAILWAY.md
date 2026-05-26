# Deploy ke Railway

Panduan cepat untuk deploy project POS ini ke Railway.

## 1. Buat dua Railway service

Karena project ini adalah monorepo dengan dua aplikasi terpisah, buat:

1. `backend` service — root `apps/backend`
2. `frontend` service — root `apps/frontend`

### Backend service
- Root path: `apps/backend`
- Build command: `npm install`
- Start command: `npm run start`
- Port: Railway akan otomatis gunakan `PORT` dari env

### Frontend service
- Root path: `apps/frontend`
- Build command: `npm install && npm run build`
- Start command: `npm run start`

> Railway akan mendeteksi `package.json` di masing-masing folder.

## 2. Set environment variables

### Backend env vars

- `PORT=5000`
- `NODE_ENV=production`
- `SUPABASE_URL=https://<your-supabase-project>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`
- `SUPABASE_ANON_KEY=<anon-key>`
- `FRONTEND_URL=https://<frontend-domain>.railway.app`

Jika frontend juga ingin diakses dari local saat backend berjalan di Railway, bisa tambahkan origin tambahan:

- `FRONTEND_URL=https://<frontend-domain>.railway.app,http://localhost:3000`

### Frontend env vars

- `NEXT_PUBLIC_API_URL=https://<backend-domain>.railway.app/api`
- `NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-project>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>`

> Jangan pernah memasukkan `SUPABASE_SERVICE_ROLE_KEY` ke frontend.

## 3. Konfigurasi Supabase

Sebelum deploy, pastikan:

- Supabase project sudah dibuat
- Database migrasi sudah dijalankan di SQL Editor
- Storage bucket `nota-supplier` sudah ada
- RLS dan policies sudah aktif sesuai repo

Jika perlu, jalankan seed data dari `apps/backend/database/seed.js`.

## 4. Cara deploy cepat

Jika sudah login Railway dan repo sudah terhubung:

1. Buat project baru untuk `backend`
2. Pilih root `apps/backend`
3. Set env vars di atas
4. Deploy
5. Ambil domain backend dari Railway
6. Buat project baru untuk `frontend`
7. Pilih root `apps/frontend`
8. Set env vars frontend menggunakan domain backend
9. Deploy

## 5. Cek setelah deploy

- Backend health: `https://<backend-domain>.railway.app/api/health`
- Frontend: `https://<frontend-domain>.railway.app`
- Pastikan login berhasil dan api call ke backend tidak blocked CORS

## 6. Tips cepat untuk demo besok

- Deploy backend dulu, lalu deploy frontend setelah backend live
- Set `FRONTEND_URL` di backend ke domain Railway frontend
- Terapkan env `NEXT_PUBLIC_API_URL` dengan path `/api`
- Jika ingin test data cepat, jalankan `npm run seed` di backend sebelum deploy atau di local

## 7. Jika ingin deploy satu service saja

Jika ingin backend saja di Railway untuk sekarang, Anda bisa tetap jalankan frontend lokal dengan `npm run dev` di `apps/frontend` dan set `NEXT_PUBLIC_API_URL` ke domain backend.
