# Pengujian HTTP Security Headers (Lapisan 4)

Menguji header keamanan HTTP yang dipasang lewat middleware `helmet`
di backend Express (`apps/backend/src/server.js`).

## Header yang Diharapkan Aktif

| Header | Nilai yang Diharapkan |
| --- | --- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

## Cara 1 — Periksa Langsung dengan curl

```bash
curl -I http://localhost:5000/api/health
```

Pastikan kelima header di atas muncul pada respons.

## Cara 2 — Pemindai Online (untuk URL produksi)

Setelah aplikasi di-deploy (HTTPS):

1. **securityheaders.com** — masukkan URL produksi.
   - Target: **grade A**.
2. **ssllabs.com/ssltest** — masukkan domain produksi.
   - Target: **grade A−** atau lebih baik.

Simpan screenshot hasil sebagai bukti lampiran skripsi.

## Tabel Hasil

| Header | Aktif? | Nilai Aktual |
| --- | --- | --- |
| Strict-Transport-Security | | |
| Content-Security-Policy | | |
| X-Frame-Options | | |
| X-Content-Type-Options | | |
| Referrer-Policy | | |

| Pemindai | Grade Target | Grade Aktual |
| --- | --- | --- |
| securityheaders.com | A | |
| ssllabs.com | A− | |

## Catatan

`Strict-Transport-Security` hanya efektif pada koneksi HTTPS. Saat
pengujian lokal (HTTP) header tetap terkirim, namun grade A di
securityheaders.com baru tercapai setelah deploy dengan HTTPS.
