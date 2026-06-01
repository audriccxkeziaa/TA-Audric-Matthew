// Definisi badge tipe & status retur/penyesuaian.

export const TYPE_BADGES = {
  return_supplier: { label: "Retur Supplier", tone: "amber" },
  sales_return: { label: "Retur Pelanggan", tone: "blue" },
  stock_adjustment: { label: "Penyesuaian Stok", tone: "red" },
};

export const STATUS_BADGES = {
  pending:   { label: "Menunggu",   tone: "amber" },
  approved:  { label: "Disetujui",  tone: "green" },
  rejected:  { label: "Ditolak",    tone: "red" },
  selesai:   { label: "Selesai",    tone: "green" },
  cancelled: { label: "Dibatalkan", tone: "slate" },
};

// Context-aware: return_supplier+approved berarti "Menunggu Barang Ganti" (belum selesai).
export function getStatusBadge(type, status) {
  if (type === "return_supplier" && status === "approved") {
    return { label: "Menunggu Barang Ganti", tone: "amber" };
  }
  return STATUS_BADGES[status] || { label: status, tone: "slate" };
}
