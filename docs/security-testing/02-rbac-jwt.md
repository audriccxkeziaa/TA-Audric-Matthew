# Pengujian RBAC & Integritas JWT (Lapisan 2 & 3)

Menguji kontrol akses berbasis role (RBAC) dan ketahanan verifikasi JWT
terhadap manipulasi.

## Skrip Otomatis

```bash
node tests/security/rbac-jwt-test.js
```

Variabel lingkungan (punya default):

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:5000/api` | URL backend |
| `KASIR_EMAIL` | `kasir@asiajaya.com` | Akun role kasir |
| `KASIR_PASSWORD` | `kasir123` | Password kasir |

Contoh:

```bash
node tests/security/rbac-jwt-test.js
# atau
$env:KASIR_EMAIL="kasir@asiajaya.com"; $env:KASIR_PASSWORD="rahasia"
node tests/security/rbac-jwt-test.js
```

## Kasus Uji

### A. RBAC Privilege Escalation

| No | Skenario | Ekspektasi |
| --- | --- | --- |
| A1 | Kasir POST `/api/users` (endpoint admin) | HTTP **403** |
| A2 | Akses `/api/users` tanpa JWT | HTTP **401** |
| A3 | Kasir GET `/api/audit-logs` (admin only) | HTTP **403** |

### B. JWT Tampering

| No | Skenario | Ekspektasi |
| --- | --- | --- |
| B1 | Ubah 1 karakter signature JWT | HTTP **401** |
| B2 | Ubah payload `role` → `admin` tanpa re-sign valid | HTTP **401** |
| B3 | JWT dengan format rusak / bukan token | HTTP **401** |

### C. Diuji Manual (perlu data tambahan)

| No | Skenario | Ekspektasi | Cara |
| --- | --- | --- | --- |
| C1 | JWT kedaluwarsa | HTTP **401** | Tunggu token expired lalu pakai ulang |
| C2 | JWT user A dipakai atas nama user B | HTTP **401** | Verifikasi klaim `sub` — backend `getUser()` menolak token bukan miliknya |

## Hasil yang Diharapkan

Skrip mencetak ringkasan, contoh:

```
[A1] Kasir POST /api/users               → 403  PASS
[A2] GET /api/users tanpa JWT            → 401  PASS
[A3] Kasir GET /api/audit-logs           → 403  PASS
[B1] Signature di-tamper                 → 401  PASS
[B2] Payload role di-tamper jadi admin   → 401  PASS
[B3] JWT format rusak                    → 401  PASS

6/6 PASS
```

## Tabel Hasil

| No | Skenario | HTTP Aktual | Status |
| --- | --- | --- | --- |
| A1 | Kasir akses endpoint admin | | |
| A2 | Akses tanpa JWT | | |
| A3 | Kasir akses audit-trail | | |
| B1 | Signature di-tamper | | |
| B2 | Payload role di-tamper | | |
| B3 | JWT format rusak | | |

## Analisis

- **Lapisan 2 (RBAC):** `authMiddleware` memverifikasi JWT lalu
  `roleMiddleware('admin')` menolak role lain dengan 403.
- **Lapisan 3 (JWT Integrity):** `supabase.auth.getUser(token)`
  memverifikasi signature, masa berlaku, dan klaim `sub` ke Supabase
  Auth. Token yang di-tamper otomatis ditolak 401.
