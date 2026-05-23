# Skenario UAT — POS CV Asia Jaya Maju

Isi kolom **Hasil Aktual** dan **Status** (Pass / Fail) saat sesi UAT
berlangsung. Jika Fail, catat masalahnya di kolom **Catatan**.

Lingkungan: _isi tanggal_ · Responden: _R1 / R2 / R3_

---

## A. Login & Autentikasi

| No | Skenario | Langkah | Hasil Diharapkan | Hasil Aktual | Status | Catatan |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Login berhasil | Buka `/login`, masukkan email & password valid | Masuk ke dashboard (admin) / halaman kasir (kasir) sesuai role | | | |
| A2 | Login gagal | Masukkan password salah | Muncul pesan "Email atau password salah", tetap di halaman login | | | |
| A3 | Akses tanpa login | Buka `/dashboard` langsung tanpa login | Diarahkan otomatis ke `/login` | | | |
| A4 | Logout | Klik tombol "Keluar" | Sesi berakhir, kembali ke `/login` | | | |
| A5 | Batas hak akses kasir | Login kasir, coba buka `/audit-trail` | Diarahkan kembali (akses ditolak) | | | |

## B. Transaksi Penjualan (POS) — 5 Transaksi

| No | Skenario | Langkah | Hasil Diharapkan | Hasil Aktual | Status | Catatan |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Transaksi normal #1 | Cari barang, tambah ke keranjang, proses | Struk muncul, stok berkurang | | | |
| B2 | Transaksi normal #2 (multi-item) | Tambah 3 barang berbeda, proses | Semua subtotal & total benar, transaksi sukses | | | |
| B3 | Transaksi normal #3 | Ubah qty pakai tombol +/−, proses | Total ikut berubah, transaksi sukses | | | |
| B4 | Transaksi normal #4 | Proses lalu klik "Cetak Struk" | Struk tercetak/preview rapi | | | |
| B5 | Transaksi stok kurang (R1) | Masukkan qty melebihi stok, proses | Transaksi DITOLAK, pesan R1 jelas, stok tidak berubah | | | |

## C. Stok Masuk OCR — 3 Jenis Nota

| No | Skenario | Langkah | Hasil Diharapkan | Hasil Aktual | Status | Catatan |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Nota cetak komputer | Upload foto nota cetak, proses OCR | Field terbaca dengan confidence tinggi, masuk form validasi | | | |
| C2 | Nota tulisan tangan rapi | Upload nota tulis tangan jelas, proses OCR | Sebagian field terbaca, field confidence < 70  disorot kuning | | | |
| C3 | Nota tulisan tangan jelek | Upload nota tulis tangan sulit dibaca | Sistem fallback ke input manual ("kualitas OCR terlalu rendah") | | | |
| C4 | Validasi & simpan | Cocokkan produk, lengkapi field, klik "Konfirmasi & Simpan" | Stok bertambah, tercatat di audit trail (R2 + R4) | | | |
| C5 | Commit tanpa validasi | Coba simpan sebelum melengkapi item | Tombol konfirmasi nonaktif / ditolak (R2) | | | |

## D. Dashboard Admin (Akses dari Luar Toko)

| No | Skenario | Langkah | Hasil Diharapkan | Hasil Aktual | Status | Catatan |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Akses dashboard jarak jauh | Login admin dari perangkat di luar toko | Dashboard tampil normal | | | |
| D2 | Kartu metrik | Amati kartu ringkasan | Angka transaksi/revenue/stok sesuai kondisi | | | |
| D3 | Grafik tren penjualan | Amati line chart 30 hari | Grafik tampil & terbaca | | | |
| D4 | Grafik produk terlaris | Amati bar chart top 10 | Grafik tampil & terbaca | | | |
| D5 | Heatmap stok menipis | Amati grid heatmap | Barang menipis ditandai warna sesuai tingkat kritis | | | |

## E. Audit Trail

| No | Skenario | Langkah | Hasil Diharapkan | Hasil Aktual | Status | Catatan |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | Lihat audit trail | Buka `/audit-trail` sebagai admin | Daftar log perubahan/penolakan stok tampil | | | |
| E2 | Filter audit | Filter berdasarkan rule R1 | Hanya log R1 yang tampil | | | |
| E3 | Detail log | Klik "Detail" pada satu baris | Context payload & perubahan stok tampil | | | |
| E4 | Export CSV | Klik "Export CSV" | File CSV terunduh & isinya benar | | | |

---

## Rekapitulasi

| Modul | Jumlah Skenario | Pass | Fail |
| --- | --- | --- | --- |
| A. Login & Autentikasi | 5 | | |
| B. Transaksi Penjualan | 5 | | |
| C. Stok Masuk OCR | 5 | | |
| D. Dashboard Admin | 5 | | |
| E. Audit Trail | 4 | | |
| **Total** | **24** | | |

**Kesimpulan UAT:** _isi setelah sesi — mis. "X dari 24 skenario Pass,
sistem dinilai layak digunakan / perlu perbaikan pada ..."_
