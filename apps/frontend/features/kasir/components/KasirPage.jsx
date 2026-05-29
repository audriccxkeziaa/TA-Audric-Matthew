"use client";
// /kasir — Point of Sale. Orkestrator UI: barcode bar, panel cari, keranjang,
// modal bayar & struk. Semua logika ada di hook useKasir.

import { PageShell, PageHeader } from "@/components/ui";
import { useKasir } from "../hooks/useKasir";
import { BarcodeBar } from "./BarcodeBar";
import { SearchPanel } from "./SearchPanel";
import { CartPanel } from "./CartPanel";
import { BayarModal } from "./BayarModal";
import { ReceiptModal } from "./ReceiptModal";

export default function KasirPage() {
  const k = useKasir();

  return (
    <PageShell>
      <PageHeader
        title="Kasir — Transaksi Penjualan"
        description="Scan barcode / ketik kode produk lalu Enter."
      />

      <BarcodeBar
        value={k.barcode}
        onChange={k.setBarcode}
        onSubmit={k.handleBarcodeSubmit}
        inputRef={k.barcodeRef}
        onBrowse={k.toggleSearch}
      />

      {k.searchOpen && (
        <SearchPanel
          q={k.q}
          onQChange={k.setQ}
          onClose={() => k.setSearchOpen(false)}
          searchRef={k.searchRef}
          results={k.results}
          searchFetching={k.searchFetching}
          onPick={(p) => {
            k.addToCart(p, 1);
            k.setQ("");
            k.barcodeRef.current?.focus();
          }}
        />
      )}

      <CartPanel
        cart={k.cart}
        setQty={k.setQty}
        setDiskon={k.setDiskon}
        removeItem={k.removeItem}
        lineSubtotal={k.lineSubtotal}
        lastQtyRef={k.lastQtyRef}
        subtotal={k.subtotal}
        totalDiskon={k.totalDiskon}
        total={k.total}
        totalQty={k.totalQty}
        overStock={k.overStock}
        clearCart={k.clearCart}
        onCheckout={() => k.setBayarOpen(true)}
        saleProcessing={k.saleProcessing}
      />

      <BayarModal
        open={k.bayarOpen}
        onClose={() => k.setBayarOpen(false)}
        total={k.total}
        cart={k.cart}
        onConfirm={k.confirmBayar}
        processing={k.saleProcessing}
      />

      <ReceiptModal receipt={k.receipt} onClose={() => k.setReceipt(null)} />
    </PageShell>
  );
}
