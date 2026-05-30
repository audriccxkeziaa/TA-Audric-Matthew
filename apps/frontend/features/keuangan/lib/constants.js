// Konstanta jenis pengeluaran operasional + tone badge + hint deskripsi.
// Dipindahkan apa adanya dari page.jsx.

// Opsi yang muncul di form input manual (admin).
// 'refund_pelanggan' sengaja tidak di sini — dibuat otomatis via proses retur.
export const JENIS_OPTIONS = [
  { value: "gaji", label: "Gaji Karyawan" },
  { value: "listrik", label: "Listrik" },
  { value: "air", label: "Air (PDAM)" },
  { value: "custom", label: "Custom" },
];

// Label tampilan semua jenis, termasuk yang dibuat otomatis oleh sistem.
export const JENIS_LABELS = {
  gaji: "Gaji Karyawan",
  listrik: "Listrik",
  air: "Air (PDAM)",
  custom: "Custom",
  refund_pelanggan: "Refund Pelanggan",
};

export const JENIS_TONE = {
  gaji: "indigo",
  listrik: "amber",
  air: "blue",
  custom: "green",
  refund_pelanggan: "red",
};

// Placeholder & label deskripsi tergantung jenis pengeluaran.
export const DESKRIPSI_HINT = {
  gaji: { label: "Deskripsi", placeholder: "mis. Gaji kasir Lina bulan Mei" },
  listrik: { label: "Deskripsi", placeholder: "mis. Tagihan PLN April" },
  air: { label: "Deskripsi", placeholder: "mis. Tagihan PDAM April" },
  supplier: {
    label: "Nama Supplier",
    placeholder: "mis. PT Sumber Motor Jaya (kabel & aksesoris)",
  },
  custom: {
    label: "Label Pengeluaran (custom)",
    placeholder: "mis. Beli stempel toko / servis printer",
  },
};
