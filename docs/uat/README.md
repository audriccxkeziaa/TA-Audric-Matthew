# User Acceptance Testing (UAT) — POS CV Asia Jaya Maju

Berkas pada folder ini adalah **kerangka/template** pelaksanaan UAT untuk
Bab Pengujian skripsi (Pertemuan 11). Diisi **setelah** sesi UAT nyata
bersama pemilik dan karyawan CV Asia Jaya Maju.

> ⚠️ **Integritas akademik:** Hasil aktual, skor SUS, dan transcript
> wawancara WAJIB berasal dari responden sungguhan. Jangan mengisi data
> fiktif. Template ini hanya menyeragamkan cara pencatatan.

## Isi Folder

| Berkas | Keterangan |
| --- | --- |
| [01-skenario-uat.md](./01-skenario-uat.md) | Tabel skenario UAT + kolom Pass/Fail |
| [02-kuesioner-sus.md](./02-kuesioner-sus.md) | Kuesioner SUS 10 pertanyaan + cara hitung skor |
| [03-wawancara.md](./03-wawancara.md) | Panduan & template transcript wawancara terbuka |

## Responden

| Kode | Peran | Posisi di Toko |
| --- | --- | --- |
| R1 | Pemilik / Owner | _isi nama_ |
| R2 | Kasir / Karyawan | _isi nama_ |
| R3 | _opsional_ | _isi nama_ |

## Alur Pelaksanaan UAT

1. Jelaskan tujuan UAT ke responden (bukan menguji orangnya, tapi sistemnya).
2. Dampingi responden menjalankan tiap skenario di `01-skenario-uat.md`,
   catat hasil aktual + status Pass/Fail.
3. Setelah semua skenario, minta responden mengisi kuesioner SUS
   (`02-kuesioner-sus.md`) secara mandiri.
4. Lakukan wawancara terbuka (`03-wawancara.md`) untuk masukan kualitatif.
5. Hitung skor SUS tiap responden dan rata-ratanya. **Target: > 70.**

## Lingkungan UAT

- Perangkat: laptop kasir + HP (untuk uji kamera OCR) + perangkat admin
  yang mengakses dashboard dari luar toko.
- Data: gunakan database hasil seed agar realistis.
- Periode pelaksanaan: _isi tanggal_.
