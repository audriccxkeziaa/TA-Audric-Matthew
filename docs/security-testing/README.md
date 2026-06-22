# Pengujian Keamanan — POS CV Asia Jaya Maju

Dokumentasi pengujian keamanan untuk Bab Pengujian skripsi,
menguji **Keamanan Berlapis 4 Lapisan** yang dirancang di laporan.

## Isi Folder

| Berkas | Lapisan Diuji |
| --- | --- |
| [01-sql-injection.md](./01-sql-injection.md) | Lapisan 1 — Anti SQL Injection |
| [02-rbac-jwt.md](./02-rbac-jwt.md) | Lapisan 2 & 3 — RBAC + Integritas JWT |
| [03-http-headers.md](./03-http-headers.md) | Lapisan 4 — HTTP Security Headers |

## Ringkasan Pengujian

| No | Pengujian | Alat | Target | Hasil |
| --- | --- | --- | --- | --- |
| 1 | SQL Injection | sqlmap | 0 vulnerability | _isi_ |
| 2 | RBAC Privilege Escalation | skrip `tests/security/` | 403 / 401 sesuai | _isi_ |
| 3 | JWT Tampering | skrip `tests/security/` | semua ditolak 401 | _isi_ |
| 4 | HTTP Headers | securityheaders.com / ssllabs.com | grade A / A− | _isi_ |

## Skrip Otomatis

Pengujian RBAC & JWT (No. 2 & 3) dapat dijalankan otomatis:

```bash
node tests/security/rbac-jwt-test.js
```

Lihat [02-rbac-jwt.md](./02-rbac-jwt.md) untuk detail.

> ⚠️ **Integritas akademik:** hasil sqlmap, securityheaders.com, dan
> ssllabs.com WAJIB berasal dari run nyata di lingkungan Anda. Lampirkan
> screenshot/log asli sebagai bukti — jangan diisi manual.

## Catatan Etika

Pengujian keamanan ini **hanya** dilakukan terhadap sistem milik sendiri
(skripsi) dengan izin penuh. Jangan menjalankan sqlmap atau alat sejenis
terhadap sistem pihak lain tanpa izin tertulis.
