// Definisi badge tipe & status retur/penyesuaian. Dipindahkan apa adanya.

export const TYPE_BADGES = {
  return_supplier: { label: "Retur Supplier", tone: "amber" },
  sales_return: { label: "Retur Pelanggan", tone: "blue" },
  stock_adjustment: { label: "Penyesuaian Stok", tone: "red" },
};

export const STATUS_BADGES = {
  pending: { label: "Menunggu", tone: "amber" },
  approved: { label: "Disetujui", tone: "green" },
  rejected: { label: "Ditolak", tone: "red" },
};
