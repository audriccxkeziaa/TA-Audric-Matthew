# Pengujian SQL Injection (Lapisan 1)

Menguji bahwa seluruh query backend kebal SQL Injection. Sistem memakai
`supabase-js` yang melakukan parameterisasi otomatis — tidak ada
penggabungan string SQL mentah.

## Alat

[sqlmap](https://sqlmap.org/) — alat uji penetrasi SQL Injection otomatis.

## Endpoint Sasaran

Endpoint yang menerima input user dan menyentuh database, mis.
`GET /api/products?q=` (parameter pencarian `q`).

## Prosedur

1. Login untuk mendapat JWT yang valid:

   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"admin@asiajaya.com\",\"password\":\"PASSWORD\"}"
   ```

   Salin nilai `session.access_token`.

2. Jalankan sqlmap terhadap parameter `q`:

   ```bash
   sqlmap -u "http://localhost:5000/api/products?q=test" \
     --headers="Authorization: Bearer {ACCESS_TOKEN}" \
     --batch --level=2 --risk=2
   ```

3. (Opsional) Uji juga endpoint lain yang menerima query string, mis.
   `GET /api/sales?from=&to=` dan `GET /api/audit-logs`.

## Hasil yang Diharapkan

sqlmap melaporkan parameter **tidak injectable**:

```
[INFO] GET parameter 'q' does not seem to be injectable
... all tested parameters do not appear to be injectable
```

**Target: 0 vulnerability ditemukan.**

## Tabel Hasil

| No | Endpoint | Parameter | Temuan sqlmap | Status |
| --- | --- | --- | --- | --- |
| 1 | `/api/products` | `q` | _isi_ | _Aman / Rentan_ |
| 2 | `/api/sales` | `from`,`to` | _isi_ | _Aman / Rentan_ |
| 3 | `/api/audit-logs` | `rule`,`action` | _isi_ | _Aman / Rentan_ |

Lampirkan log/screenshot output sqlmap sebagai bukti.

## Analisis

Pertahanan utama: semua akses DB lewat `supabase-js` (`.eq()`, `.ilike()`,
`.rpc()`) yang mem-parameterkan nilai — input user tidak pernah
digabung sebagai string SQL. Lihat `apps/backend/src/repositories/`.
